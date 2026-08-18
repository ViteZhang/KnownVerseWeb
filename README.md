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

> 依赖《终版》§3.3 的 `grant execute on function public.spend_credits(int,text,text) to authenticated`。
> **如果重新生成后「积分流水」里没有「生成学习单元 −10」这一笔**，说明线上库缺这条授权
> （或函数签名不一致）—— 页面会在正文顶部直接显示原因（如 `permission denied for function spend_credits`），
> 在 Supabase SQL Editor 补一句即可：
>
> ```sql
> grant execute on function public.spend_credits(int,text,text) to authenticated;
> ```
>
> 补之前重新生成仍然可用，只是不扣积分。

## 技术栈

Next.js（App Router）· @supabase/ssr · react-markdown · 通义千问（经 App 的 `ai-task`
Edge Function，原样调用）。Phase 1 登录后页面客户端渲染。

## 范围（Phase 1）

只做「消费已有空间」。不做：新建空间 / 入学访谈、用户记忆编辑、流式生成、双端实时推送
（详见 `docs/施工提示词_网页版Phase1_阅读与问AI.md` §10）。
