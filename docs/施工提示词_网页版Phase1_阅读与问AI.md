# 施工提示词 · 网页版 Phase 1(阅读 + 问 AI + 回看)· 开工版

> 用途:粘贴给 Claude Code 作为开发任务规格。
> 栈:**Next.js(App Router)** + `supabase-js` · 复用现有 Supabase(Postgres + RLS + Edge Functions)· 通义千问(经 `callLLM()`)。
> 前置:App 端已上线,Supabase 后端(8 表 + RLS + `ai-task` / `redeem-invite` Edge Function)已稳定运行。
> 目标产物:一个独立的桌面网页应用,用户用**邮箱登录**后,能在电脑上**读已有学习空间的单元(大屏沉浸阅读)、划词问 AI(带学习档案上下文)、回看提问记录**,且与手机端**实时同源**(同一套 Supabase,数据天然同步)。
> 本步范围:**只做"消费已有空间"**——登录、首页、路径页、单元阅读(含按需生成)、划词问 AI、提问记录、断点续学服务端化。**不做**新建空间/访谈(Phase 2)、用户记忆编辑(Phase 2)、双端实时推送(V3)。

---

## ★ 视觉与交互的唯一参照:`docs/网页版交互原型_Phase1.html`

随本提示词附带一个**可点击的桌面交互原型**(创始人已确认定稿)。它不是示意图,而是**布局、交互、视觉的权威参照**——所有页面的栏宽比例、留白、组件样式、划词问 AI 的"选区→气泡→右侧抽屉"流程、生成中状态、目录锚点、设计 token,均以该原型为准。

- 开工前先在浏览器打开它跑一遍,理解目标体验,再写代码。
- 原型中**写死的部分**(AI 回答样例、生成中定时器、登录不校验)是演示占位,施工时替换为真实的 `ai-task` 调用与 Supabase 数据;**交互形态与视觉照搬**。
- 设计 token(§7)直接取自原型的 `:root`,务必同源,不要另调色值。

---

## 0. 给 Claude Code 的前置说明

- **后端零改动原则**:本产品的"大脑"(AI 任务、准入、数据隔离)已平台无关。**严禁修改任何 Edge Function、prompt、RLS、表结构**——唯一允许的后端增强是 §6 的"阅读进度表"。网页端只写 **UI 层 + 客户端调用**。
- **复用而非重写**:`ai-task` 的 `ask` / `gen_unit` 任务,网页端用用户的 Supabase 会话 JWT 原样调用,入参与 App 一致。一行 prompt 都不要改。
- **密钥纪律**:客户端只用 **Supabase URL + anon key**(public-safe,RLS 兜底)。**service-role key 绝不能出现在网页客户端代码或浏览器可达处**。Edge Function 调用靠用户会话 JWT 鉴权(`Authorization: Bearer <access_token>`)。
- **增量开发,每完成一个可验证切片就停下来让我真机验证**,不要一次性写完整站。建议顺序见 §8。
- **视觉与交互照搬原型**(见上),设计 token 见 §7。
- **SEO 说明**:选 Next.js 是为未来的落地页/分享页。**Phase 1 全部页面在登录后、无 SEO 价值,客户端渲染即可**,不必为这些页面做 SSR;但项目结构上保留未来加公开页的余地。

---

## 1. 角色分工

| 任务 | 归属 |
|---|---|
| Next.js 项目脚手架、路由、所有 UI、客户端 Supabase/Edge 调用 | Claude Code |
| 照原型实现:布局、设计 token、块渲染、划词问 AI、提问记录、断点续学客户端逻辑 | Claude Code |
| 提供 Supabase URL / anon key(env)、执行 §6 的阅读进度表迁移 | 创始人 |
| 选择部署方式(建议 Vercel)、配置环境变量 | 创始人 |
| 每个切片真机/浏览器验收、合并 | 创始人 |

---

## 2. 复用的后端契约(只读,勿改)

### 2.1 数据表(经 `supabase-js` + RLS 读取,`auth.uid()` 自动隔离)
- `spaces`:id、user_id、name、learning_type、updated_at —— 首页空间列表
- `phases`:space_id、idx、title、status —— 路径阶段
- `units`:id、space_id、phase_id、idx、title、status('not_generated'|'learning'|'done')、**content jsonb(块数组,未生成为 null)** —— 路径单元 + 阅读正文
- `questions`:space_id、unit_id、selected_text、question、answer、created_at —— 提问记录
- `space_profiles`:static / dynamic —— 仅 Edge Function 内部读取做上下文注入,**网页端不直接读它拼 prompt**(避免把档案逻辑泄到客户端)

### 2.2 `units.content` 块结构(渲染依据)
块数组,形如:
```json
[
  { "type": "guide", "text": "本单元导引…" },
  { "type": "goals", "text": "学习目标…" },
  { "type": "h2",    "text": "小节标题" },
  { "type": "para",  "text": "正文段落…" },
  { "type": "card",  "text": "要点卡片…" }
]
```
- `h2` 用于**单元内目录锚点**(原型右栏目录跳转)。
- `para` / `card` 是**划词问 AI 的可选取/可问单位**(承接 App 的语义)。
- 渲染样式对照原型:`.rd-guide`(琥珀左边框引导)、`.rd-goals`(目标清单)、`.rd-h2`、`.para`(衬线正文)、`.rd-card`(浅底要点卡)。

### 2.3 Edge Function(原样调用)
- `ai-task` · `task="ask"`:入参 `{ task, spaceId, unitId, selectedText, sectionContext, question }` → 返回 `{ answer }`(Markdown)。Edge Function 内部读 `space_profiles` 注入档案——**上下文注入在服务端完成,网页端不管**。
- `ai-task` · `task="gen_unit"`:入参按 App 现有约定 → 生成结构化块数组并固化入 `units.content`,返回该单元内容。**网页端进入未生成单元时调用它**(见 §5)。

---

## 3. 页面与桌面布局(布局比例照原型)

| 页面 | 路由 | 布局(以原型为准) |
|---|---|---|
| 登录 | `/login` | 居中卡片,品牌「知识宇宙」wordmark,邮箱注册/登录(开放注册,无邀请码门槛) |
| 首页 | `/` | 顶部 appbar(品牌 + 导航 + 头像);**空间卡片三列网格**(`.grid`,响应式降列):名称、类型标签、一句描述、进度条、"继续学习"断点行;末尾"新建空间"虚线卡(标 Phase 2) |
| 路径页(空间主视图) | `/space/[id]` | **双栏 `1fr / 360px`**:左=阶段+单元轨道(`.units` 时间线 + 状态点 done/cur/todo),右=sticky 侧栏(黑色"继续学习"卡 + 提问记录/关于我入口);顶部整体进度条 |
| 单元阅读页(核心) | `/space/[id]/unit/[unitId]` | **三栏 `248px / 1fr / 200px`**:左=路径轨道(可一键收起,`rail-collapsed`)· 中=限宽 680px 衬线正文(块渲染 + `h2` 锚点)· 右=单元内目录(滚动高亮 + 点击跳转);选中正文 → 浮气泡 → 右侧抽屉答疑 |
| 提问记录 | `/space/[id]/questions` | 限宽单列;条目可展开看完整问答,顶部引用选中原文,单元标签可跳回该单元 |

> 受保护路由:除 `/login` 外均需登录态;未登录跳 `/login`。建议用 `@supabase/ssr` 处理 Next.js 的会话/Cookie。
> 桌面交互增量(原型已含):路径轨道收起按钮、TOC 锚点跳转、`⌘/Ctrl+K` 唤起问 AI。

---

## 4. 划词问 AI(网页灵魂交互 —— 严格照原型)

这是产品差异化最强的交互,在网页上是**原生优势**。原型已实现完整流程,照搬其形态:

1. 阅读区(中栏 `.reading`)启用浏览器原生选择。用户在 `para`/`card` 内**划选一段文字**。
2. `mouseup` 后判断选区非空(≥2 字)且落在阅读区内 → 在选区上方**浮出小气泡**(`.selbubble`),只有一个动作「问 AI」;点击别处 / 滚动则消失。
3. 点「问 AI」→ **右侧抽屉**(`.drawer`,从右滑入,带半透明 scrim)滑出:
   - 顶部引用样式显示选中文字(`.quote`,琥珀左边框)
   - 快捷预设 chips:展开讲讲 / 举个例子 / 联系我的背景 / 太难了简单点
   - 底部输入框 + 圆形琥珀发送键(`Enter` 发送)
4. 发送 / 点 chip → 客户端**就地拼 `sectionContext`**:从选区定位所在块,取相邻若干块文本拼接并做长度上限截断(承接 App"端上拼好上下文"的做法)。
5. 调 `ai-task`(`task="ask"`,带用户 JWT),入参 `{ spaceId, unitId, selectedText, sectionContext, question }`。
6. 加载态(`.loading` "AI 正在思考…")→ 拿到 `answer` → 抽屉内 **Markdown 渲染**(`react-markdown` 一类)。
7. **回答成功后,客户端把该问答 insert 进 `questions`**(`selected_text`=所选文字,`question`、`answer`、`unit_id`、`space_id`;表里无 section_context 字段,不入库);写库失败不阻塞阅读,静默重试一次,仍失败记日志。
8. 关闭抽屉(✕ / 点 scrim / Esc),正文不受影响。
9. 快捷键:选中文字后 `⌘/Ctrl+K` 直接唤起抽屉(原型已实现)。

约束(与 App 一致):
- 一次一问;追问=重新选词重新问(不做同段多轮线程)。
- V1 非流式:加载态 → 一次性出完整回答。
- **不做位置锚定**:回答不挂回原文位置,问答平铺进 `questions`(与 App 同一张表、同一形态)。

> **灵魂验收点**:回答要明显"知道我在学什么、是给我这个水平的人讲的"(上下文注入生效),而非泛泛百科。这是整个产品成立与否的命门。

---

## 5. 单元阅读与按需生成

- 进入单元:读 `units.content`,按 §2.2 块结构渲染(样式照原型 `.read-inner` 内各组件)。
- **若 `status='not_generated'`(content 为 null)**:展示"正在生成本单元…"状态(原型 `.genwrap`:转圈 + 文案,文案点明"结合你的学习档案按类型模板生成、生成后永久保存")→ 调 `ai-task`(`task="gen_unit"`)→ 固化入库 → 渲染。
  - **V1 非流式可接受**(加载态 → 一次性渲染);流式(SSE)留作后续 polish,不进本切片。
  - 因"一次生成、永久固化",生成后两端看到的是同一份,天然同步。
- 已生成单元:直接块渲染。
- 顶部/底部操作:标记完成(写 `units.status='done'`)、下一单元。重新生成放 Phase 2。

---

## 6. 断点续学服务端化(本 Phase 唯一的后端增强 · 已定方案 A)

目标:手机读到哪、电脑接着读。把"最近阅读位置"从本地搬到服务端。

**已定:方案 A —— 新建 `reading_progress` 表。** 创始人在 Supabase 执行以下迁移:
```sql
create table if not exists public.reading_progress (
  user_id    uuid not null default auth.uid(),
  space_id   uuid not null references public.spaces(id) on delete cascade,
  unit_id    uuid not null references public.units(id) on delete cascade,
  anchor     text,                         -- 滚动锚点(如最近可见的 h2 id 或块序号)
  updated_at timestamptz not null default now(),
  primary key (user_id, space_id)
);
alter table public.reading_progress enable row level security;
create policy "own progress" on public.reading_progress
  using (user_id = auth.uid()) with check (user_id = auth.uid());
```

网页端行为:
- 阅读时**防抖**(如停止滚动 1–2s)upsert 当前 `space_id / unit_id / anchor`(主键 `(user_id, space_id)`,last-write-wins)。
- 首页/路径页"继续学习"读 `reading_progress` → 跳到该单元该锚点。

> **跨端双向提示(请创始人知悉)**:本表落地后,网页端读写即生效。但要实现"**手机 → 电脑**"的断点接续,**App 端也需改为写入这同一张表**(目前 App 记在本地)。这是一个独立小改动,可在 App 端单独排一个任务(我可另出一份 App 端施工提示词);本 Phase 网页端先把服务端断点跑通,App 接入与否不阻塞网页验收。

---

## 7. 设计 token 与阅读排版(取自原型 `:root`,务必同源)

```css
:root{
  --paper:#FAF8F3; --surface:#FFFFFF; --surface-2:#F6F2EA;
  --ink:#20242E; --ink-soft:#565B66; --ink-faint:#9A9EA8;
  --line:#ECE6DB; --line-soft:#F3EEE5;
  --amber:#DD9527; --amber-deep:#B0701A; --amber-wash:rgba(221,149,39,.18); --amber-line:rgba(221,149,39,.5);
  --sage:#5E7A6B; --sage-wash:rgba(94,122,107,.14); --danger:#C0584B;
  --font-ui:"Inter","PingFang SC","Microsoft YaHei",system-ui,sans-serif;
  --font-read:"Noto Serif SC","Songti SC","STSong",Georgia,serif;  /* 正文阅读用衬线 */
}
```
阅读排版要求(对照原型):
- 正文**限宽阅读栏 ~680px**,`--font-read` 衬线,字号 16px、行距 1.95——大屏长文,衬线优势放大。
- 主按钮:墨底白字、圆角 14、琥珀色图标。整体暖纸墨色、克制、**emoji-light**。
- 引入 Google Fonts:Inter + **Noto Serif SC**(保证各台电脑浏览器都能渲染衬线正文)。
- 建议把这套 token 抽成共享文件,日后与 App 同源引用,避免色值漂移。

---

## 8. 建议开发顺序(每片停下来让我验证)

0. **脚手架 + 登录 + 受保护路由 + 设计 token**:Next.js 起项目,接 Supabase(env),邮箱注册/登录跑通,登录后能从 `spaces` 读到**自己的**空间(验证 RLS 在网页端同样生效)。token 就位。
1. **先单独验证灵魂(强烈建议)**:在一个已生成单元页上,先把"**划词 → 拼 sectionContext → 调 `ask` → Markdown 渲染**"跑通,确认上下文注入在网页端成立(对应 App 端 Step 1 的"先跑通 ask")。
2. **首页**:空间卡片三列网格(照原型 `.space-card`)。
3. **路径页双栏**:轨道 + 状态点 + 右侧栏,读 `phases`/`units`。
4. **单元阅读页**:三栏 + 块渲染(限宽衬线 + `h2` 右栏目录锚点 + 轨道可收起)+ 未生成单元调 `gen_unit`(非流式 + `.genwrap` 状态)。
5. **接真实划词问 AI**:把切片 1 的灵魂接到真实阅读页 + 右侧抽屉 + 快捷预设 + `⌘K` + 写入 `questions`(失败重试)。
6. **提问记录页**:列表 + 展开 + 单元标签跳回。
7. **断点续学**:§6 表迁移(创始人执行)+ 网页端防抖 upsert + "继续学习"读跳。
8. **收尾**:加载/错误/空状态、路径轨道收起动效、TOC 滚动高亮、键盘可达与焦点可见。

---

## 9. 验收标准

- [ ] 邮箱注册/登录可用(开放注册,无邀请码门槛);登录后只看到**当前用户自己**的空间(RLS 在网页端生效)。
- [ ] 三栏阅读页与原型一致:正文限宽衬线、按块渲染、`h2` 目录可锚点跳转、路径轨道可收起。
- [ ] 进入未生成单元能触发 `gen_unit`、固化入库、渲染;再次进入直接读库(不重复生成)。
- [ ] **划词选中正文 → 浮出"问 AI" → 回答明显"知道我在学什么、是给我这个水平的人讲的"**(不是泛泛百科)。`⌘/Ctrl+K` 同样能唤起。
- [ ] 回答 Markdown 正常渲染;关闭抽屉后该问答出现在提问记录里,刷新仍在。
- [ ] 提问记录只显示当前用户、当前空间(RLS 生效);单元标签可跳回。
- [ ] 断点:在某设备读到某单元某位置,换浏览器/设备登录后"继续学习"能回到该位置(App 接入后即实现手机↔电脑)。
- [ ] **客户端代码与浏览器中搜不到 service-role key**;`ask`/`gen_unit` 调用带的是用户会话 JWT。
- [ ] 视觉与原型 / App 同源(纸墨色、衬线正文、主按钮规格、状态点配色一致)。

---

## 10. 明确不做(范围纪律)

- ✗ 新建空间 / 入学访谈 / 理解确认 / 生成路径(Phase 2)
- ✗ 用户记忆「关于我」编辑(Phase 2)
- ✗ 双端实时推送(Supabase Realtime,V3)
- ✗ 位置锚定批注 / 回答内嵌挂回原文 / 同段多轮线程(与 App 一致,留 V2)
- ✗ 流式生成 / 流式答疑(V1 非流式;流式留作 polish)
- ✗ 邀请码/激活相关逻辑(已开放邮箱注册,邀请码只影响空间上限,属后端,网页端不碰)
- ✗ 任何 Edge Function / prompt / RLS / 表结构修改(唯一例外:§6 阅读进度表)
- ✗ 网页独有的内容形态(单元内容两端必须同一份,不得分叉)
- ✗ 公开/分享页与其 SEO(留待 V3,本 Phase 只搭好可扩展的项目结构)

如对以上有更优实现建议,先说明再改,不要默默扩大范围。

---

*附注:本 Phase 的工程重心全在 UI 层与客户端调用——后端是现成的、平台无关的。力气花在两处:① 划词问 AI 的网页原生体验(选区→气泡→侧栏→上下文注入);② 大屏沉浸阅读排版(限宽衬线 + 三栏并置)。这两处照原型做到位,"电脑学习更方便"才算兑现。视觉与交互细节一律以 `docs/网页版交互原型_Phase1.html` 为准。*
