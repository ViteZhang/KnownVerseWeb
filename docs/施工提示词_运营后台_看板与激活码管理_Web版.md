# 施工提示词 · 运营后台:用量看板 + 激活码管理(Web 版)

> 用途:粘贴给 Claude Code 作为开发任务规格。
> 栈:Next.js(Web,部署在 Vercel · knowledgeverse.space)· Supabase(Auth + Postgres + RLS)· 通义千问(不涉及)
> 前置(均在跑,别重写):`app_users` / `spaces` / `credit_ledger` / `user_credits` / `learning_events` / `credit_codes` 表;`generate_credit_codes(p_count,p_credits,p_batch,p_note)`、`redeem_credit_code`、`grant_credits`、`spend_credits` 函数;完整 RLS。
> 目标产物:一个**仅管理员可见的 `/admin` 网页后台**,三个模块 —— ① 用量看板(看用户与用量)② 生成激活码 ③ 激活码管理。
> 依据文档:《施工提示词 · 纯积分制与激活码兑换(终版)》(库结构与函数以它为准)、《知识宇宙 · 运营后台原型 V1》(**所有 UI 以它为准**,已验收)。
> **安全原则(本步的全部重点)**:后台要做的两件事 —— **跨用户读**(看板)与**生成/管理激活码** —— 恰恰是现有 RLS **按设计不放行**的(`credit_codes` 无任何策略=客户端读不到;`user_credits`/`credit_ledger`/`spaces` 只能读自己;`generate_credit_codes` 已 revoke)。因此**整个后台不直连表**,一律走**带 `is_admin` 门禁的 SECURITY DEFINER RPC**。这次连"读"也要收口在服务端。

---

## 0. 给 Claude Code 的前置说明

- **先勘察再动手**:读 `credit_codes` 表结构与"故意不建 RLS 策略"那段注释、`generate_credit_codes` / `redeem_credit_code` / `grant_credits` 定义、`credit_ledger` 的 `reason` 取值、`learning_events` 写入点、以及现有 Web 端的 Supabase 客户端封装与页面路由结构、交互原型的 CSS 设计 token(`:root` 变量)。
- **别碰积分内核**:本步**不改** `generate_credit_codes` / `redeem_credit_code` / `grant_credits` / `spend_credits` / `billing_config` / `apply_referral` 一个字节。只**新增** `is_admin` 门禁助手 + 一组 `admin_*` 包装 RPC + 一个 `/admin` 前端页。
- 按 §7 顺序**逐切片**做,每片停下让我验证;**每片都试着"弄坏它"**(见 §8),尤其是**越权**。
- 这是一个**读 + 管码**的运营工具,不是给用户用的功能。**不扩大范围**(见 §9):不做多管理员角色、不做手动改额度/发积分/封号、不做导出报表、不做 App 端后台。有更优实现先说明再改。

### 已锁定的约束

| 项 | 值 |
|---|---|
| 后台形态 | 现有 Next.js Web 里新增 `/admin` 路由,**不新建应用、不新建 Edge Function** |
| 权限模型 | `app_users.is_admin`(布尔),**单一管理员足够**,不做角色细分 |
| 数据通道 | 全部走 `admin_*` SECURITY DEFINER RPC(`grant execute to authenticated` + 函数内 `is_admin` 硬门禁);**前端不直连任何表** |
| 激活码生成 | **包装**现有 `generate_credit_codes`,不改原函数;新增可选 `price_cny` 记营收 |
| 面额报价 | 300/1000/2500 ↔ ¥9.9/¥29.9/¥68(前端常量,非 `billing_config`);自定义面额价可留空 |
| 退出线 | 每周核销 >10 笔 或 月流水 >¥3000 → 该上正式支付(看板第一屏盯它) |
| 邮箱 | RPC 返回**全量邮箱**(管理员对账要用);是否打码由前端决定 |

---

## 1. 数据模型:两处小增量(纯 additive,不破坏)

```sql
-- 1.1 管理员标记
alter table public.app_users
  add column if not exists is_admin boolean not null default false;

-- 1.2 激活码售价(用于 ¥营收/退出线统计;活动码/白嫖码留空 = 不计入营收)
alter table public.credit_codes
  add column if not exists price_cny numeric;
comment on column public.credit_codes.price_cny is
  '该码对应的人民币售价;活动/白嫖码留空 = 不计入营收流水';
```

> `is_admin` 由**创始人手动开自己那一行**(见 §6),不提供任何"自助升管理员"的入口。`price_cny` 可空:小红书活动码、朋友白嫖码留空,只有真实付费码才带价,这样 ¥流水天然只统计真金白银。

---

## 2. 门禁助手:`is_current_user_admin()`

所有 `admin_*` RPC 的第一行都调它;非管理员一律 `FORBIDDEN`。

```sql
create or replace function public.is_current_user_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select is_admin from public.app_users where id = auth.uid()), false);
$$;
revoke all on function public.is_current_user_admin() from public;
grant execute on function public.is_current_user_admin() to authenticated;
```

> 设计说明:`admin_*` 系列都 `grant execute to authenticated`,意味着**任何登录用户都能调用**——但函数内第一行的 `is_admin` 判断会挡掉非管理员,返回 `FORBIDDEN`、不吐任何数据。这就是门禁所在;别把安全寄托在"前端不显示入口"上。

---

## 3. 看板 RPC(看用户与用量)

```sql
-- 3.1 顶部聚合 + 退出线
create or replace function public.admin_dashboard_stats()
returns jsonb language plpgsql security definer set search_path = public as $$
declare j jsonb;
begin
  if not public.is_current_user_admin() then raise exception 'FORBIDDEN' using errcode='42501'; end if;
  select jsonb_build_object(
    'total_users',           (select count(*) from public.app_users),
    'new_users_7d',          (select count(*) from auth.users where created_at > now()-interval '7 days'),
    -- 活跃学习者:近 7 天有 learning_events(单元完成/提问,不含签到)—— 对齐《终版》§9 埋点口径
    'active_learners_7d',    (select count(distinct user_id) from public.learning_events
                                where created_at > now()-interval '7 days'),
    'month_spend',           coalesce((select -sum(delta) from public.credit_ledger
                                where delta<0 and created_at >= date_trunc('month', now())),0),
    'codes_redeemed_total',  (select count(*) from public.credit_codes where redeemed_by is not null),
    'credits_redeemed_total',coalesce((select sum(credits) from public.credit_codes where redeemed_by is not null),0),
    -- 退出线两项
    'redeemed_7d',           (select count(*) from public.credit_codes where redeemed_at > now()-interval '7 days'),
    'revenue_month',         coalesce((select sum(price_cny) from public.credit_codes
                                where redeemed_at >= date_trunc('month', now())),0)
  ) into j;
  return j;
end $$;
revoke all on function public.admin_dashboard_stats() from public;
grant execute on function public.admin_dashboard_stats() to authenticated;

-- 3.2 用户列表(搜索 + 排序 + 分页)
create or replace function public.admin_list_users(
  p_search text default null, p_sort text default 'active',
  p_limit int default 50, p_offset int default 0)
returns table(user_id uuid, display_name text, email text,
  free_balance int, paid_balance int, spaces_count int,
  total_spend int, invites_count int, last_active_at timestamptz, created_at timestamptz)
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_current_user_admin() then raise exception 'FORBIDDEN' using errcode='42501'; end if;
  return query
  with enriched as (
    select u.id, u.display_name, au.email, au.created_at as reg_at, au.last_sign_in_at,
           coalesce(uc.free_balance,0) as fb, coalesce(uc.paid_balance,0) as pb,
           (select count(*)::int from public.spaces s where s.user_id=u.id) as sc,
           coalesce((select -sum(cl.delta)::int from public.credit_ledger cl
                     where cl.user_id=u.id and cl.delta<0),0) as spend,
           (select count(*)::int from public.app_users iv where iv.invited_by=u.id) as inv,
           coalesce((select max(le.created_at) from public.learning_events le where le.user_id=u.id),
                    au.last_sign_in_at) as last_act
    from public.app_users u
    join auth.users au on au.id = u.id
    left join public.user_credits uc on uc.user_id = u.id
  )
  select id, display_name, email, fb, pb, sc, spend, inv, last_act, reg_at
  from enriched
  where p_search is null or p_search=''
     or display_name ilike '%'||p_search||'%'
     or email ilike '%'||p_search||'%'
  order by
    case when p_sort='spend'  then spend                          end desc nulls last,
    case when p_sort='paid'   then pb                             end desc nulls last,
    case when p_sort='reg'    then extract(epoch from reg_at)     end desc nulls last,
    case when p_sort='active' then extract(epoch from last_act)   end desc nulls last,
    last_act desc nulls last
  limit p_limit offset p_offset;
end $$;
revoke all on function public.admin_list_users(text,text,int,int) from public;
grant execute on function public.admin_list_users(text,text,int,int) to authenticated;

-- 3.3 单用户流水(抽屉用)
create or replace function public.admin_user_ledger(p_user_id uuid, p_limit int default 50)
returns table(delta int, reason text, balance_after int, created_at timestamptz)
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_current_user_admin() then raise exception 'FORBIDDEN' using errcode='42501'; end if;
  return query
  select cl.delta, cl.reason, cl.balance_after, cl.created_at
  from public.credit_ledger cl
  where cl.user_id = p_user_id
  order by cl.created_at desc
  limit p_limit;
end $$;
revoke all on function public.admin_user_ledger(uuid,int) from public;
grant execute on function public.admin_user_ledger(uuid,int) to authenticated;
```

> `admin_list_users` 读 `auth.users` 拿邮箱/注册/最近登录 —— SECURITY DEFINER 以属主(postgres)身份运行,可读 `auth` schema 并越过各表 RLS。`last_active_at` = 最后一次学习事件时间,退化到最后登录时间(无学习事件时)。

---

## 4. 激活码 RPC(生成 / 列表 / 汇总 / 作废)

```sql
-- 4.1 生成:包装现有 generate_credit_codes,不改原函数;附带 price_cny
create or replace function public.admin_generate_codes(
  p_count int, p_credits int, p_batch text default null,
  p_note text default null, p_price_cny numeric default null)
returns table(code text) language plpgsql security definer set search_path = public as $$
declare v_code text;
begin
  if not public.is_current_user_admin() then raise exception 'FORBIDDEN' using errcode='42501'; end if;
  if p_count < 1 or p_count > 200 then raise exception 'INVALID_COUNT'; end if;
  if p_credits < 1 then raise exception 'INVALID_CREDITS'; end if;

  for v_code in
    select gc.code from public.generate_credit_codes(p_count, p_credits, p_batch, p_note) gc
  loop
    if p_price_cny is not null then
      update public.credit_codes set price_cny = p_price_cny where credit_codes.code = v_code;
    end if;
    code := v_code; return next;
  end loop;
end $$;
revoke all on function public.admin_generate_codes(int,int,text,text,numeric) from public;
grant execute on function public.admin_generate_codes(int,int,text,text,numeric) to authenticated;

-- 4.2 列表(状态推导 + 批次/状态/关键词过滤 + 分页 + 兑换人名)
create or replace function public.admin_list_codes(
  p_status text default 'all', p_batch text default 'all',
  p_search text default null, p_limit int default 100, p_offset int default 0)
returns table(code text, credits int, price_cny numeric, batch text, note text,
  status text, redeemer text, redeemed_at timestamptz, created_at timestamptz)
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_current_user_admin() then raise exception 'FORBIDDEN' using errcode='42501'; end if;
  return query
  select * from (
    select c.code, c.credits, c.price_cny, c.batch, c.note,
      case when not c.active then 'void'
           when c.redeemed_by is not null then 'used'
           when c.expires_at is not null and c.expires_at < now() then 'expired'
           else 'unused' end as status,
      (select a.display_name from public.app_users a where a.id = c.redeemed_by) as redeemer,
      c.redeemed_at, c.created_at
    from public.credit_codes c
    where (p_batch='all' or c.batch = p_batch)
      and (p_search is null or p_search=''
           or c.code ilike '%'||p_search||'%' or c.note ilike '%'||p_search||'%')
  ) t
  where (p_status='all' or t.status = p_status)
  order by t.created_at desc
  limit p_limit offset p_offset;
end $$;
revoke all on function public.admin_list_codes(text,text,text,int,int) from public;
grant execute on function public.admin_list_codes(text,text,text,int,int) to authenticated;

-- 4.3 汇总条(已发/已核销/未兑沉淀/营收)
create or replace function public.admin_codes_summary(p_batch text default 'all')
returns jsonb language plpgsql security definer set search_path = public as $$
declare j jsonb;
begin
  if not public.is_current_user_admin() then raise exception 'FORBIDDEN' using errcode='42501'; end if;
  select jsonb_build_object(
    'issued',         count(*),
    'used',           count(*) filter (where redeemed_by is not null),
    'used_credits',   coalesce(sum(credits) filter (where redeemed_by is not null),0),
    'unused_credits', coalesce(sum(credits) filter
                        (where redeemed_by is null and active and (expires_at is null or expires_at>now())),0),
    'revenue',        coalesce(sum(price_cny) filter (where redeemed_by is not null),0)
  ) into j
  from public.credit_codes
  where p_batch='all' or batch=p_batch;
  return j;
end $$;
revoke all on function public.admin_codes_summary(text) from public;
grant execute on function public.admin_codes_summary(text) to authenticated;

-- 4.4 作废(只对未兑换的码;已兑换的作废无意义且不能动用户到账积分)
create or replace function public.admin_void_code(p_code text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_norm text; v_n int;
begin
  if not public.is_current_user_admin() then raise exception 'FORBIDDEN' using errcode='42501'; end if;
  v_norm := upper(trim(p_code));
  update public.credit_codes set active = false
   where code = v_norm and redeemed_by is null and active;
  get diagnostics v_n = row_count;
  if v_n = 0 then
    return jsonb_build_object('ok', false, 'reason', 'not_voidable');  -- 不存在/已兑换/已停用
  end if;
  return jsonb_build_object('ok', true);
end $$;
revoke all on function public.admin_void_code(text) from public;
grant execute on function public.admin_void_code(text) to authenticated;
```

> `admin_generate_codes` 内部调 `generate_credit_codes`:后者虽已对 `public/authenticated` revoke,但 SECURITY DEFINER 以属主身份运行,属主仍有执行权,故可正常内部调用 —— **原函数一行不改**。

---

## 5. 前端:`/admin` 页(三模块,对着原型实现)

**所有数字来自上面的 RPC,一律不写死。** 复用交互原型 `:root` 里的设计 token(paper/amber/sage/ink 那套),视觉与《运营后台原型 V1》一致。

**① 路由守卫(先做,安全关键)**
- 进入 `/admin` 时调 `is_current_user_admin`(或直接调 `admin_dashboard_stats`,捕获 `FORBIDDEN`)。
- 非管理员 / 未登录 → 渲染"无权限"或重定向首页;**不渲染任何后台内容**。
- 真正的门禁在 RPC 里(§2);路由守卫只是体验层,别把它当唯一防线。
- 普通用户界面**不出现**任何 `/admin` 入口链接。

**② 用量看板**(原型 tab 1)
- 顶部四张卡:总用户 / 本周活跃学习者 / 本月消耗积分 / 累计核销 —— 取 `admin_dashboard_stats`。
- **退出线监控条**:本周核销笔数(`redeemed_7d` / 10)+ 本月流水(`revenue_month` / 3000),用原型里的进度条;接近阈值变色(warn/hot)。
- 用户表:`admin_list_users`,搜索框(防抖)+ 排序下拉(active/spend/paid/reg)。余额用"免/充"两色 chip。
- **点行 → 抽屉**:`admin_user_ledger(user_id)`,顶部四格(免费桶/充值桶/空间数/累计消耗)+ 下方流水(正绿负灰,带 reason)。

**③ 生成激活码**(原型 tab 2)
- 面额 quick-pick:300/1000/2500(带 ¥ 标)+ 自定义;选标准档时把对应 ¥ 作为 `p_price_cny` 传入,自定义档给一个可选价格输入(留空=不计营收)。
- 数量(1–200)、批次 `batch`(默认当前年月,如 `2026-07`)、备注 `note`(对账:对应谁的哪笔转账)。
- 提交 → `admin_generate_codes` → 结果区列出 `KV-XXXX-XXXX-XXXX`,支持单个复制 / 复制全部。
- 生成后刷新"激活码管理"列表(新码为"未用"态)。

**④ 激活码管理**(原型 tab 3)
- 汇总条:`admin_codes_summary`(已发/已核销+积分/未兑沉淀/营收 ¥)。
- 过滤:状态 chips(全部/未用/已用/已停用)+ 批次下拉 + 搜索(码/备注)→ `admin_list_codes`。
- 表格列:码 / 面额(+¥)/ 批次 / 备注 / 状态徽章 / 兑换人+时间 / 操作。
- "作废"按钮**仅对"未用"态可点** → `admin_void_code` → 成功后刷新列表 + 汇总;返回 `not_voidable` 给轻提示。

**⑤ 数据获取约定**
- 用现有 Web 端的 Supabase 客户端 `supabase.rpc('admin_...', {...})`。
- 客户端 bundle **绝不含 service role key**(这些 RPC 用普通登录态即可调,门禁在服务端)。
- 列表默认分页(用户 50 / 码 100),先不做无限滚动,"加载更多"按钮足够。

---

## 6. 角色分工

| 任务 | 归属 |
|---|---|
| §1 migration(`is_admin` / `price_cny`)、§2–§4 全部 RPC、§5 `/admin` 前端 | **Claude Code** |
| 跑 migration;**把自己那行 `is_admin=true`**(需先在 Supabase Auth 里查到自己的 user_id) | **创始人** |
| 决定 `/admin` 是否额外加 Next.js middleware 层守卫(可选加固) | 创始人 |
| 浏览器验收(含用**非管理员账号**验越权被挡) | 创始人 |

**创始人开管理员(migration 后手动跑一次):**
```sql
-- 在 Supabase → Authentication 找到自己的 user id,替换下面
update public.app_users set is_admin = true where id = '<你的 user_id>';
```

---

## 7. 建议开发顺序(每片停下来验证)

1. **门禁地基**:§1 两列 + §2 `is_current_user_admin()`;创始人开自己 `is_admin=true`。
   手测:`select public.is_current_user_admin();` 自己 = true;拿另一个测试账号 = false。
2. **看板 RPC**:§3 三个。先用 `supabase.rpc` / SQL 手调:**管理员有数据、非管理员全部 `FORBIDDEN`**;数字与手查一致。
3. **激活码 RPC**:§4 四个。SQL 手调:生成进库且带 `price_cny`;list 状态推导正确;void 只对未用生效、对已兑换返回 `not_voidable`;每个都验非管理员 `FORBIDDEN`。
4. **前端 · 守卫 + 看板**:§5① 路由守卫先立住(非管理员进不去),再接看板 + 用户抽屉。
5. **前端 · 生成 + 管理**:§5③④ 两模块接线,复制 / 过滤 / 作废 / 汇总跑通。
6. **收尾**:空态、防抖、错误轻提示、分页"加载更多";与原型逐屏比对。

---

## 8. 验收标准(重点:试着弄坏它 —— 越权是头号)

**越权(最重要)**
- [ ] 用**非管理员**账号逐个调 `admin_dashboard_stats / admin_list_users / admin_user_ledger / admin_generate_codes / admin_list_codes / admin_codes_summary / admin_void_code` → **全部 `FORBIDDEN`,拿不到任何数据**
- [ ] 非管理员 / 未登录直接访问 `/admin` → **被守卫挡住,不渲染任何后台内容**
- [ ] 普通用户仍**不能**直接 `select * from credit_codes`(RLS 未改,依旧读不到)
- [ ] 普通用户仍**不能**读别人的 `user_credits` / `credit_ledger` / `spaces`(RLS 未改)

**生成**
- [ ] 数量 >200 或 <1、面额 <1 → 被拒(`INVALID_COUNT` / `INVALID_CREDITS`)
- [ ] 选标准面额生成 → 码带上对应 `price_cny`(9.9/29.9/68);自定义留空价 → `price_cny` 为空
- [ ] 生成的码 `KV-XXXX-XXXX-XXXX`、进库为"未用"态、能被"激活码管理"看到

**列表 / 状态 / 作废**
- [ ] 状态推导正确:未兑=未用 / 已兑=已用 / `active=false`=已停用 / 过期=已过期
- [ ] 状态、批次、关键词过滤与汇总数字自洽
- [ ] "作废"只对未用码生效;对**已兑换**的码作废 → `not_voidable`,且**用户已到账积分不受影响**
- [ ] 已停用的码**不能再被用户兑换**(`redeem_credit_code` 原有 `active` 守卫,回归验证一次)

**看板数字**
- [ ] `total_users / active_learners_7d / month_spend / revenue_month` 与手工 SQL 查询一致
- [ ] 退出线两项(本周核销笔数、本月 ¥流水)与 `credit_codes` 手查一致
- [ ] 用户抽屉流水与该用户 `credit_ledger` 倒序一致

**通用**
- [ ] 前端所有数字来自 RPC,**无写死**
- [ ] 客户端 bundle 内**无 service role key**
- [ ] 现有积分 / 学习 / 签到 / 兑换 / 邀请流程**完全不受影响**(没碰内核,回归抽验一遍)

---

## 9. 明确不做(范围纪律)

- ✗ **App 端后台**(App 已冻结,仅 Web `/admin`)
- ✗ 改 `generate_credit_codes` / `redeem_credit_code` / 积分内核任何一行(只**包装**)
- ✗ 多管理员**角色/细分权限**(单一 `is_admin` 布尔;要分级下一迭代)
- ✗ **手动改用户额度 / 手动发积分 / 封号**(本后台只读 + 管码;要补偿积分暂时走"发一张码"或 SQL,将来接 `grant_credits` 很容易)
- ✗ **在线支付对账自动化**(`price_cny` 由前端按档位带入 / 手填)
- ✗ **导出 CSV / 图表报表 / 时间序列曲线**(先表格 + 汇总数字;要导出下一迭代)
- ✗ **操作审计留痕**(谁在何时作废了哪个码 —— 本版靠 Supabase 日志;要落库下一迭代)
- ✗ 后端迁移 / 备案相关改造

> 如对实现有更优建议,先说明再改,不要默默扩大范围。

---

> 做完本步:你在 `knowledgeverse.space/admin` 就能看用户与用量、批量出激活码、按批次对账管码,且第一屏盯着退出线 —— 什么时候该把"人肉充值"换成正式支付,一眼就知道。
> **一条尾巴**:等你真接在线支付了,`price_cny` 这列和 `admin_generate_codes` 的价参数正好复用成营收口径,不用返工。
