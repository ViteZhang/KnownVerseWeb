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
同一单元再次生成会命中服务端幂等而不扣，所以重生成这一次由网页端按
「生成前后余额」判断后补一笔 `spend_credits(cost,'unit_generation','regen:<unit_id>:<uuid>')`。
服务端若自己扣了，前端就不会再扣 —— 两边都扣或都不扣都不会发生。

> 依赖《终版》§3.3 已有的 `grant execute on function public.spend_credits(int,text,text) to authenticated`，
> 无新增表 / 新增 SQL。若这条 grant 不在，重新生成仍能用，只是不会扣积分（控制台留 warn）。

## 技术栈

Next.js（App Router）· @supabase/ssr · react-markdown · 通义千问（经 App 的 `ai-task`
Edge Function，原样调用）。Phase 1 登录后页面客户端渲染。

## 范围（Phase 1）

只做「消费已有空间」。不做：新建空间 / 入学访谈、用户记忆编辑、流式生成、双端实时推送
（详见 `docs/施工提示词_网页版Phase1_阅读与问AI.md` §10）。
