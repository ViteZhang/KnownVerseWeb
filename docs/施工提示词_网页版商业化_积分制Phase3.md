# 施工提示词 · 网页版商业化:Paddle 订阅 + 积分制 + 付费墙(Web · Phase 3)

> 用途:粘贴给 Claude Code 作为开发任务规格。
> 栈:Next.js(Vercel)· Supabase(Auth + Postgres + RLS + Edge Function)· Paddle(Merchant of Record)· 通义千问(`callLLM()` 适配层)
> 前置:App/Web 已上线,共用 Supabase 后端;`app_users` 上已有可累加空间额度(`base_space_quota=2` / `referral_bonus` / `invite_space_bonus` / `member_space_quota`(预埋恒 0)/ generated `space_quota`)、`enforce_space_limit()` 触发器、`apply_referral` RPC、`llm_usage` 计量表 + `llm_usage_daily` 视图、`callLLM()` / `ai-task` Edge Function 均已在跑。
> 本 Phase 目标产物:① `subscriptions` + `user_credits` + 审计流水 + `billing_config` 单一真源;② Paddle webhook → Edge Function 驱动"订阅→积分发放+空间解锁"(**灵魂链路**);③ `spend_credits` 服务端扣费 + 免费档懒重置;④ 把扣费接到"单元生成(10)/问 AI(1)"两处,其余动作零扣费;⑤ 网页付费墙(积分余额条 + 积分墙 + 空间墙)+ Paddle Checkout + customer portal;⑥ 公开定价页(SSR/SSG,SEO)。
> 关联文档:《商业化 Phase 3 · 策划 V2(积分制)》(规则以它为准)、《商业化原型 · 网页版付费 V1》(UI 以它为准)、《施工提示词 · 开放验证版额度改造》(被本 Phase 复用的额度骨架)。
> **安全原则(贯穿全篇)**:积分 / 订阅 / 空间额度的**判断与写入一律在服务端**(SECURITY DEFINER 函数 / service role / Edge Function)。**客户端只读权益结果,绝不能写自己的积分、订阅、额度列;Paddle 密钥与 webhook 验签只在 Edge Function。**

---

## 0. 给 Claude Code 的前置说明

- **先勘察再动手**:读现有 `app_users` 额度四分量与 generated `space_quota`、`enforce_space_limit()`、`apply_referral`、`handle_new_user`、`llm_usage` 写入点、`ai-task` / `callLLM()` 结构、Web 端建空间与"单元生成/问 AI"的调用链、以及既有 `app_config`(有没有 `registration_open` 那类配置表)。**别重写能用的部分**,积分是"接在旁边",不是"推翻重来"。
- 按 §13 顺序**逐切片**做,每片停下让我验证;**每片都试着"弄坏它"**(见 §14)。
- **灵魂链路(§5)必须先在 Paddle sandbox 跑通再碰任何 UI**:一笔订阅 → 积分到账 + 空间到 50 → 取消 → 下个周期回落免费额度 + 空间回 2。**先验证这个,再谈墙和定价页。**
- **不扩大范围**:多档订阅、区域定价、促销、App IAP、自动熔断本 Phase 都不做(见 §15)。有更优实现先说明再改,不要默默扩大范围。
- **本 Phase 不碰任何内容 / 学习功能**,只加"订阅—积分—计量—墙"这层外壳。

### 已锁定的默认值(写死前对一遍,全部集中进 §2 `billing_config`)

| 项 | 值 |
|---|---|
| 免费月度积分 `free_monthly_credits` | **80** |
| 会员月度积分 `member_monthly_credits` | **800** |
| 单次单元生成扣费 `cost_unit_generation` | **10** 积分 |
| 单次问 AI 扣费 `cost_ask_ai` | **1** 积分 |
| 会员空间软上限 `member_space_cap` | **50**(经 `member_space_quota` 实现,见 §7) |
| 免费空间(既有) | 2(+邀请可再解锁,既有逻辑不动) |
| 积分不跨月累积 | 月度发放**重置**;仅加购积分持久 |
| Pro 年付 / 月付 / 积分包 / 空间包 价格 | $69.99 / $8.99 / +300 积分 $4.99 / +5 空间 $6.99 |

> §2 之外任何地方**不得再写死这些数字**;服务端读 `billing_config`,客户端读它的公开视图。示意值(积分包 +300、"约 6 次单元 + 30 次问 AI"换算)待单次成本标定后在 `billing_config` 一处改。

---

## 1. 数据模型:订阅 + 积分 + 审计 + 事件去重

```sql
-- 1.1 订阅真源(Paddle 事件驱动)
create table if not exists public.subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  status text not null default 'none',                 -- none/active/past_due/canceled
  tier   text,                                          -- 'pro'(本 Phase 单档)
  current_period_end timestamptz,                       -- Paddle next_billed_at
  paddle_subscription_id text unique,
  paddle_customer_id text,
  updated_at timestamptz not null default now()
);
alter table public.subscriptions enable row level security;
create policy sub_read_own on public.subscriptions for select using (user_id = auth.uid());
-- 无 insert/update/delete 策略 = 客户端只读;写入只走 service role(Edge Function)

-- 1.2 积分余额:两个桶
create table if not exists public.user_credits (
  user_id uuid primary key references auth.users(id) on delete cascade,
  granted_balance   integer not null default 0,   -- 月度发放,到期重置
  purchased_balance integer not null default 0,   -- 加购,持久不重置
  current_period_end timestamptz,                 -- 本轮发放到期(懒重置锚点)
  updated_at timestamptz not null default now()
);
alter table public.user_credits enable row level security;
create policy uc_read_own on public.user_credits for select using (user_id = auth.uid());
-- 同样:客户端只读;写入只走 SECURITY DEFINER 函数 / service role

-- 1.3 积分流水(审计;正=发放/加购,负=消耗)
create table if not exists public.credit_ledger (
  id bigint generated always as identity primary key,
  user_id uuid not null,
  delta integer not null,
  reason text not null,                            -- 'grant_free'/'grant_member'/'purchase'/'unit_generation'/'ask_ai'
  idem_key text,                                   -- 幂等键(重试防重扣)
  balance_after integer,
  created_at timestamptz not null default now()
);
alter table public.credit_ledger enable row level security;
create unique index if not exists credit_ledger_idem on public.credit_ledger(user_id, idem_key) where idem_key is not null;
create policy cl_read_own on public.credit_ledger for select using (user_id = auth.uid());

-- 1.4 Paddle 事件去重(webhook 重放不重复发积分)
create table if not exists public.paddle_events (
  event_id text primary key,
  event_type text,
  received_at timestamptz not null default now()
);
alter table public.paddle_events enable row level security;  -- 无策略,客户端不可读
```

> 设计意图:`user_credits` 两个桶让"月度会重置"和"加购要持久"各归各位;扣费**先扣 granted、后扣 purchased**(见 §3),让会重置的桶先用掉,加购不被月度重置浪费。`credit_ledger` 是可审计真相,和 `llm_usage` 一样只服务端写、用户只读自己。`paddle_events` 保证 webhook 幂等。

---

## 2. `billing_config`:所有数字的单一真源

```sql
create table if not exists public.billing_config (
  id boolean primary key default true check (id),    -- 单行表
  free_monthly_credits int not null default 80,
  member_monthly_credits int not null default 800,
  cost_unit_generation int not null default 10,
  cost_ask_ai int not null default 1,
  member_space_cap int not null default 50,
  -- Paddle price id(你在 Paddle 后台建好后填进来,见 §12)
  price_pro_yearly text, price_pro_monthly text,
  price_credit_pack text, price_space_pack text,
  credit_pack_amount int not null default 300,       -- 积分包给多少积分
  space_pack_amount int not null default 5,
  updated_at timestamptz not null default now()
);
insert into public.billing_config (id) values (true) on conflict do nothing;

-- 客户端只读的"公开子集"(不暴露任何密钥;price id 是公开的,可给)
create or replace view public.billing_config_public as
  select free_monthly_credits, member_monthly_credits, cost_unit_generation, cost_ask_ai,
         member_space_cap, price_pro_yearly, price_pro_monthly, price_credit_pack, price_space_pack,
         credit_pack_amount, space_pack_amount
  from public.billing_config where id = true;
grant select on public.billing_config_public to anon, authenticated;
```

> Web 端建一个 `lib/billing.ts`,**只从 `billing_config_public` 取这些值**(积分单价、发放量、price id、包大小),渲染余额条 / 墙文案 / 定价页。改数字只在 `billing_config` 一处改,前后端同时生效,永不漂移。

---

## 3. `spend_credits` RPC + 免费档懒重置(扣费收口)

```sql
-- 3.1 到期懒重置:读/扣前调一次。免费用户靠它每月刷新;会员的 period 由 webhook 维护在未来,故不会触发。
create or replace function public.ensure_credit_period(p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_end timestamptz; v_status text; v_grant int; v_free int; v_member int;
begin
  select current_period_end into v_end from public.user_credits where user_id = p_user for update;
  if v_end is not null and now() < v_end then return; end if;   -- 未到期,不动

  select free_monthly_credits, member_monthly_credits into v_free, v_member from public.billing_config where id;
  select status into v_status from public.subscriptions where user_id = p_user;
  v_grant := case when v_status = 'active' then v_member else v_free end;

  update public.user_credits
     set granted_balance = v_grant,
         current_period_end = coalesce(v_end, date_trunc('month', now())) + interval '1 month',
         updated_at = now()
   where user_id = p_user;

  insert into public.credit_ledger(user_id, delta, reason, balance_after)
  values (p_user, v_grant, case when v_status='active' then 'grant_member' else 'grant_free' end,
          v_grant + (select purchased_balance from public.user_credits where user_id = p_user));
end $$;

-- 3.2 扣费:原子、防并发透支、可幂等
create or replace function public.spend_credits(p_cost int, p_reason text, p_idem text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_user uuid := auth.uid(); g int; p int; from_g int; from_p int; v_prev jsonb;
begin
  if v_user is null then return jsonb_build_object('ok', false, 'reason', 'not_authenticated'); end if;

  -- 幂等:同 idem_key 已扣过,回放旧结果不重扣
  if p_idem is not null then
    select jsonb_build_object('ok', true, 'reason', 'idempotent_replay', 'balance', balance_after)
      into v_prev from public.credit_ledger where user_id = v_user and idem_key = p_idem limit 1;
    if v_prev is not null then return v_prev; end if;
  end if;

  perform public.ensure_credit_period(v_user);

  select granted_balance, purchased_balance into g, p
    from public.user_credits where user_id = v_user for update;   -- 行锁,防两标签页并发透支

  if coalesce(g,0) + coalesce(p,0) < p_cost then
    return jsonb_build_object('ok', false, 'reason', 'insufficient_credits', 'balance', coalesce(g,0)+coalesce(p,0));
  end if;

  from_g := least(g, p_cost);            -- 先扣 granted
  from_p := p_cost - from_g;             -- 不够再扣 purchased
  update public.user_credits
     set granted_balance = g - from_g, purchased_balance = p - from_p, updated_at = now()
   where user_id = v_user;

  insert into public.credit_ledger(user_id, delta, reason, idem_key, balance_after)
  values (v_user, -p_cost, p_reason, p_idem, (g + p - p_cost));

  return jsonb_build_object('ok', true, 'balance', g + p - p_cost);
end $$;

revoke all on function public.spend_credits(int,text,text) from public;
grant execute on function public.spend_credits(int,text,text) to authenticated;
```

> **关键**:扣费**必须在服务端**执行(见 §6,由 `ai-task` Edge Function 在调 LLM 前调它),客户端拿不到"我自己少扣点"的口子。`p_idem` 用"动作唯一 id"(如单元 id + 用户 id),网络重试不会重扣。行锁挡住并发透支。

---

## 4. 新用户初始化积分 + 老用户回填

```sql
-- 4.1 扩展既有 handle_new_user:任何新用户建号即发免费积分 + 设周期(不改它已有的额度/邀请码逻辑,只追加这段)
--     在既有函数体末尾(return new 之前)插入:
insert into public.user_credits(user_id, granted_balance, current_period_end)
values (new.id, (select free_monthly_credits from public.billing_config where id),
        date_trunc('month', now()) + interval '1 month')
on conflict (user_id) do nothing;

insert into public.subscriptions(user_id, status) values (new.id, 'none')
on conflict (user_id) do nothing;

-- 4.2 老用户一次性回填(还没有 user_credits/subscriptions 行的)
insert into public.user_credits(user_id, granted_balance, current_period_end)
select id, (select free_monthly_credits from public.billing_config where id),
       date_trunc('month', now()) + interval '1 month'
from public.app_users a
where not exists (select 1 from public.user_credits u where u.user_id = a.id);

insert into public.subscriptions(user_id, status)
select id, 'none' from public.app_users a
where not exists (select 1 from public.subscriptions s where s.user_id = a.id);
```

---

## 5. Paddle webhook → Edge Function(灵魂链路 · 先跑通再谈 UI)

新建 Edge Function `paddle-webhook`。**签名验证 + 事件去重 + 写三处真源(subscriptions / user_credits / member_space_quota)全在这里。客户端永远不碰。**

**处理逻辑**:
1. 读原始 body + `Paddle-Signature` 头 → 用 **webhook secret**(§12,存 Edge Function secret)做 HMAC 验签。**验不过直接 401,不写任何库。**
2. 取 `event.event_id`,`insert into paddle_events` on conflict do nothing;若已存在(重放)→ 直接 200 返回,**不重复处理**。
3. 按 `event.event_type` 分派(Paddle Billing):
   - `subscription.created` / `subscription.updated` 且 status=`active` / `subscription.resumed`:
     - upsert `subscriptions`(status=active, tier='pro', current_period_end=Paddle `next_billed_at`, paddle_subscription_id, paddle_customer_id)。
     - **发放会员积分**:set `user_credits.granted_balance = member_monthly_credits`, `current_period_end = next_billed_at`,记 `credit_ledger('grant_member')`。(续费事件同样走这里,自然刷新。)
     - **解锁空间**:set `app_users.member_space_quota` 使总额度到 50(见 §7)。
   - `subscription.past_due`:set status=past_due。**暂不回收权益**(宽限,等 dunning);积分/空间维持到 period_end。
   - `subscription.canceled`(到期真正失效)/ `subscription.paused`:set status=canceled。**回收**:`member_space_quota=0`;积分不强制清零,靠下个周期 `ensure_credit_period` 回落免费额度(取消当期已付,让用户用完更体面)。
   - `transaction.completed` 且是**一次性加购**(price = 积分包 / 空间包,见 §11):按 price 给 `purchased_balance += credit_pack_amount` 或 `member_space_quota +=`(空间包)/ 走加购空间分量;记流水。
4. 全程 service role 写库;任何异常**返回非 2xx 让 Paddle 重试**(配合 §1.4 去重,重试安全)。

> **sandbox 验收(本切片唯一目标)**:用 Paddle sandbox 建一笔订阅 → `subscriptions.status=active`、`user_credits.granted_balance=800`、`space_quota` 到 50;取消并跨过 period_end → status=canceled、`member_space_quota=0`、下次读积分回落 80。**这条闭环通过前,不写墙、不写定价页。**

---

## 6. 计量接线:只在两处扣费,其余零扣费

在 `ai-task` / `callLLM()` 里,**调 LLM 之前**先 `spend_credits`;返回 `ok:false, reason:'insufficient_credits'` 则**不调 LLM**,把 `CREDITS_EXHAUSTED` 透传回客户端触发积分墙。

| 动作 | 扣费 | idem_key |
|---|---|---|
| **单元生成** | `spend_credits(cost_unit_generation, 'unit_generation', <unit_id>)` | 单元 id(重试不重扣) |
| **划词问 AI** | `spend_credits(cost_ask_ai, 'ask_ai', <question_id>)` | 提问 id |
| 入学访谈 / 路径生成 | **不扣**(由空间上限天然封顶,见 §7) | — |
| 阅读 / 看提问记录 / 档案归纳(后台) | **不扣** | — |

> 顺序:先 `spend_credits` 成功 → 再调 LLM → LLM 成功后照旧写 `llm_usage`(成本可见性不变)。**若 LLM 调用失败**,本 Phase 先简单处理(记一笔可选的 `refund` 流水把积分退回,或先不退但打日志——你定;建议单元生成这种大额动作失败即退,问 AI 小额可不退)。这点在切片 2 明确后实现。

---

## 7. 空间上限:`member_space_quota` 由订阅驱动

既有 `space_quota = base(2) + referral_bonus + invite_space_bonus + member_space_quota`,`enforce_space_limit()` 已读它。本 Phase **只改 `member_space_quota` 的来源**:从"恒 0"改为订阅驱动。

- 会员激活(§5)→ `member_space_quota = member_space_cap - 2`(即 48,让总额度地板 = 50;用户若另有邀请奖励则自然叠加到 50+,无害,视为"会员 + 邀请"双份福利)。
- 会员失效(§5 canceled)→ `member_space_quota = 0`,回落到"基础 2 + 邀请奖励"。
- **触发器、generated 列、客户端建空间前的 count 提示全部不动**;它们读的都是 `space_quota`,自动跟随。

> 设计取舍:保留了你刻意做的"四分量相加"模型,会员只动一个分量。若你要"会员恒定精确 50、不叠加邀请",告诉我,改成 `enforce` 里对会员取 `greatest(space_quota, 50)`——但那会破坏纯相加的优雅,默认按 +48 叠加做。

---

## 8. 写入收口(安全关键)

三张真源的敏感列**客户端一律不可写**:

```sql
-- user_credits / subscriptions:客户端只有 select 策略(§1 已设),无 update 策略 = 改不了
-- app_users:沿用既有列级 grant,确认 member_space_quota 不在可写列里
--   (既有:revoke update on app_users from authenticated; grant update(display_name, memory) ...)
--   member_space_quota 不在 grant 列表 → 客户端本就改不了,保持即可。
```

> `ensure_credit_period` / `spend_credits` 是 SECURITY DEFINER,以属主身份写 `user_credits`,不受客户端 grant 限制;`paddle-webhook` 用 service role 写全部。**Web 端 bundle 里不得出现任何 Paddle secret / webhook secret / service role key。** 客户端只用 Paddle.js 的**公开 client-side token**(见 §12)。

---

## 9. 网页付费墙 UI(照《原型 V1》)

Next.js 端实现三件,视觉/文案以原型为准:

- **积分余额条**(读 `user_credits` + `billing_config_public`):显示"本月还剩 X / 上限",低于 25% 变暖红;放在阅读页/首页顶部。数值走服务端真源,不在客户端算。
- **积分墙 modal**:后端回 `CREDITS_EXHAUSTED` 时弹。文案带「✓ 功能没被锁」那句;出口:升级会员(Paddle Checkout · 年付高亮)/ 买积分包。**会员用户撞墙时不显示"升级",只显示"买积分包 / 等下月刷新"**(按上轮你确认的取舍)。
- **空间墙 modal**:建空间被 `SPACE_LIMIT_REACHED` 拦时弹。三出口:升级会员 / 空间包 / 邀请解锁(复用既有 `apply_referral` 展示)。
- **Paddle Checkout**:用 **Paddle.js overlay checkout**,传 `billing_config_public` 里的 price id + 当前用户 email + `customData:{ user_id }`(webhook 靠它回填 user_id)。**不自建收银台。**
- **订阅管理**:接 **Paddle customer portal**(退订/换卡/发票),入口放"我的"。**不自建。**

---

## 10. 公开定价页(SSR/SSG · SEO 资产)

`/pricing`,照《原型 V1》定价页:年付(高亮)/月付切换、免费 vs 会员对照表(积分 80/800、空间 2/50,其余全 ✓)、积分包/空间包加购、Paddle 结算说明。

- **SSR 或 SSG**(当初选 Next.js 就为这类公开页的 SEO);挂 Metadata、JSON-LD(Product/Offer)、加进 sitemap。
- 价格文案从 `billing_config_public` 取,不写死。
- 与"公开分享页获客"共用同一套公开页基建(未来分享页复用这里的布局壳)。

---

## 11. 加购包(积分包 / 空间包)

- 走同一个 Paddle Checkout,price = 积分包 / 空间包(一次性 transaction)。
- `transaction.completed` webhook(§5.3)按 price 分派:积分包 → `purchased_balance += credit_pack_amount`(持久);空间包 → 加空间(建议单列 `addon_space_bonus` 或复用现有加购分量;若无则新增一个 `not null default 0` 分量并纳入 generated `space_quota` 之和)。
- **免费用户也能买**(不订阅也能多几个空间/多点积分)——这正是加购包服务的人群。

> 若新增 `addon_space_bonus` 分量,记得把它加进 `space_quota` 的 generated 表达式并做一次列级 grant 排除(客户端不可写)。

---

## 12. 分工

**你本人(Paddle 后台 / 各控制台 · 只有你能做)**
- 注册 Paddle、提交 KYB(与开发并行,§13 切片 0)。
- 在 Paddle 建 Products + Prices:Pro 年付 $69.99、Pro 月付 $8.99、积分包 $4.99、空间包 $6.99 → 把 4 个 **price id** 填进 `billing_config`。
- 取 **client-side token**(给 Web 的 Paddle.js)、**API key**、**webhook secret** → client token 进 Vercel env(公开可)、API key/webhook secret 进 **Supabase Edge Function secret**(私密)。
- 在 Paddle 配 **webhook 目标 URL** = `paddle-webhook` Edge Function 地址。
- 备并提供:**退款政策 + 订阅条款(自动续费披露 + 一键取消)**文案(Paddle 过审要看,多地法律硬要求),我把它做成 `/refund` `/terms` 页;结汇入账找会计。

**Claude Code(其余全部)**
- §1–§11 的表 / RPC / webhook Edge Function / 扣费接线 / Web UI / 定价页 / 加购。

---

## 13. 建议开发顺序(每片停下来验证)

0. **备料(你 · 并行不阻塞)**:Paddle KYB + 建 4 个 price + 拿三类密钥 + 配 webhook URL。
1. **数据模型**:§1 四张表 + §2 `billing_config` + 公开视图;§4 `handle_new_user` 扩展 + 老用户回填。(纯 SQL,手动查一条用户的两个桶初值。)
2. **灵魂链路**:§5 `paddle-webhook`(验签 + 去重 + 写三真源)+ §7 `member_space_quota` 驱动。**Paddle sandbox 跑通"订阅→积分800+空间50→取消→回落80+空间2"再往下。**
3. **扣费与限额**:§3 `spend_credits` + `ensure_credit_period`;§6 接到单元生成(10)/问 AI(1);免费懒重置生效;够则放行、不够回 `CREDITS_EXHAUSTED`。明确 LLM 失败是否退分。
4. **付费墙 UI**:§9 余额条 + 积分墙 + 空间墙 + Paddle.js Checkout + customer portal。
5. **定价页**:§10 `/pricing` 公开 SSR/SSG + SEO。
6. **加购 + 收尾**:§11 积分包/空间包;§5 past_due dunning 提示、发票入口、边界态。

---

## 14. 验收标准(重点:试着弄坏它)

- [ ] 新用户建号即有 `user_credits`(granted=80,period 在下月)+ `subscriptions.status='none'`
- [ ] 客户端直接 `update user_credits set granted_balance=9999` / `update subscriptions set status='active'` / `update app_users set member_space_quota=99`(自己)→ **全部被拒**(无写权限)
- [ ] Paddle webhook **签名错误/缺失** → 401,**零写库**
- [ ] **同一 event_id 重放** webhook → 幂等,不重复发积分(`paddle_events` 拦住)
- [ ] sandbox 订阅 → status=active、granted=800、`space_quota`≥50;续费事件 → granted 刷回 800
- [ ] 取消并跨过 period_end → status=canceled、`member_space_quota=0`、下次读积分回落 80
- [ ] `spend_credits`:余额 < 花费 → 返回 `insufficient_credits`,**不扣、不调 LLM**;余额够 → 先扣 granted 再扣 purchased,数目对
- [ ] **并发**:两标签页同时"生成单元"→ 不出现负余额(行锁生效)
- [ ] **重试幂等**:同一单元 id 触发两次 `spend_credits` → 只扣一次
- [ ] 懒重置:把某用户 `current_period_end` 手动设到过去 → 下次读/扣自动重置(会员→800 / 免费→80),记一条 grant 流水
- [ ] 阅读 / 看提问记录 / 入学访谈 / 路径生成 → **扣 0 积分**
- [ ] 免费建第 3 个空间被拦;会员建到第 50 个可、第 51 被拦(服务端触发器拦,绕过客户端也拦)
- [ ] 定价页 `/pricing` 有 SSR HTML(curl 能看到价格与元数据)、进 sitemap
- [ ] Web bundle 里 **grep 不到任何 Paddle secret / service role key**;webhook 验签只在 Edge Function
- [ ] 两账号交叉:看不到、改不了对方的积分 / 订阅 / 流水 / 空间

---

## 15. 明确不做(范围纪律)

- ✗ **不做功能墙** —— 免费/付费功能完全一致,只差积分与空间。
- ✗ 不用 Stripe;不自建税务合规(Paddle 担)。
- ✗ 不做多档订阅(Pro/Max),本 Phase 单档 Pro。
- ✗ 月付不低于 $5;加购包不低于 $4.99。
- ✗ 客户端不放任何 Paddle 密钥;验签与扣费只在服务端。
- ✗ 不改内容 / 学习功能。
- ✗ App 端 IAP 改造不在本 Phase(网页先跑通)。
- ✗ 不做区域定价 / 促销(后续杠杆)。
- ✗ 积分不做无限跨月累积(月度重置,仅加购持久)。
- ✗ 不做自动告警 / 熔断(先"看得见",沿用 `llm_usage_daily`)。

> 如对实现有更优建议,先说明再改,不要默默扩大范围。

---

> 做完本 Phase,商业化闭环成立:Paddle 事件 → 积分 + 空间双真源 → 驱动额度 → 网页付费墙与定价页围它生长。下一步(非本 Phase):Week 2 真实用户回访率作为放量绿灯;公开分享页获客(复用 §10 公开页壳);App 端 IAP 次要通道后排。
