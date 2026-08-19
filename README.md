# 知识宇宙 · 网页版（Phase 1）

电脑端学习应用：邮箱登录 → 我的空间 → 学习路径 → 单元沉浸阅读（含按需生成）→
划词问 AI（带学习档案上下文）→ 提问记录回看 → 断点续学。

**复用 App 的同一个 Supabase 后端**（项目 `nfvsbyvlovvpmowklbtn`），不改任何 Edge
Function / prompt / RLS / 表结构。唯一新增是 `reading_progress` 表（见下）。

视觉与交互参照：`docs/知识宇宙_网页版交互原型_Phase1.html`。

## 本地运行

```bash
npm install
cp .env.local.example .env.local   # 填入与 App 相同的 Supabase URL + anon key
npm run dev                        # http://localhost:3000
```

`.env.local` 只放 anon/publishable key，靠 RLS 保护数据；service-role key 绝不进客户端。

## 一次性后端准备：断点续学表

在 Supabase SQL Editor 执行（施工文档 §6，唯一允许的后端增强）：

```sql
create table if not exists public.reading_progress (
  user_id    uuid not null default auth.uid(),
  space_id   uuid not null references public.spaces(id) on delete cascade,
  unit_id    uuid not null references public.units(id) on delete cascade,
  anchor     text,
  updated_at timestamptz not null default now(),
  primary key (user_id, space_id)
);
alter table public.reading_progress enable row level security;
create policy "own progress" on public.reading_progress
  using (user_id = auth.uid()) with check (user_id = auth.uid());
```

> 未执行此迁移时，断点写读会静默失败（不影响阅读 / 问 AI / 提问记录）。
> 网页↔网页断点执行后即生效；**手机→电脑**还需 App 端也写这张表（独立任务）。

## 手机端（H5 / 微信）问 AI

桌面靠「划词 → 气泡 → 抽屉」和 `⌘K`，这两条在手机上都不成立：
微信内置浏览器里长按选词走不到 `mouseup`，选区还会被拖拽手柄二次调整；`⌘K` 更是没有。
结果是**窄屏下等于问不了 AI**。这一版补了三条路：

1. **常驻悬浮按钮**（`.ask-fab`，仅 ≤820px 显示）—— 不用选词，点一下就按
   「你正在读的这一节」提问。锚点取右栏目录当前高亮的标题块，
   上下文照旧走 `buildSectionContext()` 切出整节，服务端入参与划词提问完全一致。
   `selectedText` 传本节标题（不是空串），服务端 `ask` 的提示词模板才自洽。
2. **触屏划词**：粗指针设备改听 `selectionchange`，停手 320ms 后判定，
   避免边拖边闪；气泡改放到选区**下方**（系统的复制/查询菜单占着上方）。
3. **抽屉的手机适配**：输入框字号提到 16px（小于 16px 时 iOS Safari / 微信
   会在聚焦时自动放大整页且缩不回去）、底部让开安全区、`100dvh`、
   聚焦后把输入框滚到可视区、触屏不自动弹键盘（否则预设追问按钮全被顶出屏幕）、
   快捷键提示换成手机版文案。

顺带修了一个通用问题：AI 生成的正文里夹带长英文术语 / URL / 代码标识符时，
这类无断点长串会把整栏顶宽（窄屏上被 `body{overflow-x:clip}` 直接切掉看不见）。
阅读正文、问 AI 回答、总结正文统一加了 `overflow-wrap:anywhere`。

## 空间学习总结（复盘）

路径页右侧「学习总结 · 复盘」进入 `/app/space/[id]/review`；学完 100% 时
额外顶一张醒目的入口卡。做的事：把这个空间里**已生成的全部单元内容** +
**你在这个空间问过的问题**压成一份内容摘要交给 AI，写成固定六节的复盘报告
（一句话总括 / 知识地图 / 必须记住的核心概念 / 你问得最多的地方 /
还没吃透的部分 / 下一步），落库保存，下次进来直接读缓存不再花钱。
之后又学完了新单元时，页面会提示这份总结已过时、可以重写。

### 为什么借 `ask` 任务

网页版仓库里没有 Edge Function 源码，加不了 `gen_space_summary` 这种新任务。
`ask` 的入参（`spaceId / unitId / selectedText / sectionContext / question`）刚好够用：
内容摘要塞进 `sectionContext`、「写一份复盘」的要求塞进 `question`，
而且服务端照样会注入这个空间的学习档案 —— 总结自带「因人而异」。

代价是它按「划词问 AI」计价（`cost_ask_ai`，默认 1），而一次总结送进去的是
整个空间的摘要（预算 8000 字，按已生成单元数均分，每单元 200–900 字）。
所以生成成功后前端补扣差价，让一次总结的**总价**落在 `cost_space_summary`（默认 10）。
积分流水上会看到两笔：`划词问 AI −1` + `空间学习总结 −9`。

### 一次性后端准备

**不跑这段 SQL 功能也能用**，只是：总结不落库（离开页面就没了，页面会明说），
且一次只按 1 积分计价。跑完即生效，前端无需发版。

```sql
-- ① 总结落库
create table if not exists public.space_summaries (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid(),
  space_id   uuid not null references public.spaces(id) on delete cascade,
  content    text not null,
  unit_total int,
  unit_done  int,
  created_at timestamptz not null default now()
);
create index if not exists space_summaries_space_created_idx
  on public.space_summaries (space_id, created_at desc);
alter table public.space_summaries enable row level security;
drop policy if exists "own summaries" on public.space_summaries;
create policy "own summaries" on public.space_summaries
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ② 补扣差价的安全口（与 spend_unit_generation 同款：服务端 auth.uid() 认人）
create or replace function public.spend_space_summary(p_idem text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_user uuid := auth.uid(); v_total int; v_ask int; v_cost int;
begin
  if v_user is null then
    return jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  end if;
  -- 走 to_jsonb 取 cost_space_summary：这一列现在还没有，取不到就退回 10，不报错。
  select coalesce((to_jsonb(b) ->> 'cost_space_summary')::int, 10),
         coalesce(b.cost_ask_ai, 1)
    into v_total, v_ask
    from public.billing_config b where b.id = true;
  -- ask 任务已经扣过 cost_ask_ai，这里只补差价。
  v_cost := greatest(coalesce(v_total, 10) - coalesce(v_ask, 1), 0);
  if v_cost = 0 then
    return jsonb_build_object('ok', true, 'reason', 'no_topup_needed');
  end if;
  return public.spend_credits(v_user, v_cost, 'space_summary', p_idem);
end $$;
revoke all on function public.spend_space_summary(text) from public, anon;
grant execute on function public.spend_space_summary(text) to authenticated;
```

> 想改总结的总价：给 `billing_config` 加一列 `cost_space_summary int default 10`，
> 并把它加进 `billing_config_public` 视图 —— 前端与上面的函数都会自动读到，
> 两边永远一致（《终版》§2：数字不写死在前端）。

## 重新生成单元（生成不完善时的补救）

单元阅读页底部有「重新生成」入口；生成的流在写完前断掉（只出来一部分）时，
正文顶部还会多一条明确提示。二次确认后 AI 重写本单元、覆盖旧内容，
**重新扣一次 `cost_unit_generation`（默认 10）积分**，生成失败不扣。

扣费口径：首次生成由 `ai-task` 内部按 `idem=<unit_id>` 扣（《终版》§6），
同一单元再次生成会命中服务端幂等而不扣。所以重生成时网页端生成一把新钥匙
`regen:<unit_id>:<uuid>`，**同时**交给两边：

1. 随 `gen_unit` 请求体发 `idemKey` —— 服务端认这个字段就由它扣；
2. 生成成功后前端再调一次 `spend_credits(cost,'unit_generation',<同一把钥匙>)`。

两边用同一把幂等钥匙，所以**最多扣一次**：服务端扣过了，前端这次会命中
`idempotent_replay` 直接返回 ok；服务端没扣，前端这一笔就是真正的扣费。
扣费在生成成功、内容固化之后，生成失败不扣。

### 线上库的实际扣费口径（与《终版》文档不一致，实测）

用 PostgREST 探到的真实签名：

| 函数 | 线上实际 | 文档写的 |
|---|---|---|
| `spend_space_creation(p_idem)` | 有，服务端 `auth.uid()` 认人 | 文档里叫 `create_space_with_credits` |
| `spend_credits(p_user,p_cost,p_reason,p_idem)` | 有，**要显式传用户 id** | `spend_credits(p_cost,p_reason,p_idem)` |
| `spend_unit_generation(p_idem)` | 已按下方 SQL 建好（2026-08 收口） | — |

所以 `lib/credits.ts` 的 `spendUnitGeneration()` 先试安全包装 `spend_unit_generation(p_idem)`，
函数不存在再回落到现有的 4 参数 `spend_credits`。两条路用同一把 `p_idem`，幂等，不会重复扣。
**不跑任何 SQL 也能正常扣费**（走回落）；收口后自动改走安全包装，无需发版。

### 已执行的安全收口 SQL（2026-08）

收口前：线上 `spend_credits` 带 `p_user` 参数、EXECUTE 还留在 `PUBLIC` 上 ——
**拿公开 anon key 就能替任意用户扣积分**（无需登录，实测可执行）。
处理：建一个和 `spend_space_creation` 同款的安全包装，再把通用扣费口收回给 service_role。
收口后实测：anon 调 `spend_credits` 返回 `42501 permission denied`。

```sql
-- ① 单元(重)生成的安全扣费口：服务端 auth.uid() 认人，前端不碰 user id
create or replace function public.spend_unit_generation(p_idem text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_user uuid := auth.uid(); v_cost int;
begin
  if v_user is null then
    return jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  end if;
  select cost_unit_generation into v_cost from public.billing_config where id = true;
  return public.spend_credits(v_user, coalesce(v_cost, 10), 'unit_generation', p_idem);
end $$;
revoke all on function public.spend_unit_generation(text) from public;
grant execute on function public.spend_unit_generation(text) to authenticated;

-- ② 通用扣费口只留给 service_role（签名可能有多个重载，按 oid 逐个收）
do $$
declare r record;
begin
  for r in select oid::regprocedure as sig from pg_proc
            where pronamespace = 'public'::regnamespace and proname = 'spend_credits'
  loop
    execute format('revoke all on function %s from public, anon, authenticated', r.sig);
    execute format('grant execute on function %s to service_role', r.sig);
  end loop;
end $$;
```

> ② 之前先确认 `ai-task` Edge Function 是以 service role 调 `spend_credits` 的
> （它要写 `credit_ledger` / `llm_usage`，通常都是）。若它用的是用户 JWT，
> 就把 `authenticated` 保留在授权名单里，只收回 `public, anon`。
> ①②都跑完后，网页端会自动改走安全包装，无需再发版。

**如果重新生成后「积分流水」里仍没有「生成学习单元 −10」**，阅读页正文顶部会直接显示失败原因
（如 `Could not find the function …` / `permission denied …`），照着原因处理即可；
扣不上也不影响已生成内容的保存。

## 技术栈

Next.js（App Router）· @supabase/ssr · react-markdown · 通义千问（经 App 的 `ai-task`
Edge Function，原样调用）。Phase 1 登录后页面客户端渲染。

## 范围（Phase 1）

只做「消费已有空间」。不做：新建空间 / 入学访谈、用户记忆编辑、流式生成、双端实时推送
（详见 `docs/施工提示词_网页版Phase1_阅读与问AI.md` §10）。
