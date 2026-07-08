# 施工提示词 · 官网落地页与 SEO 基建 · Web 版

> 用途:粘贴给 Claude Code 作为开发任务规格。
> 栈:Next.js(App Router)· 复用现有 Supabase 后端 · Vercel 托管 · 域名 `knowledgeverse.space`。
> 前置:Web 版 Phase 1 / Phase 2 已上线(登录、首页、路径、单元阅读、划线问 AI、新建空间等)。本轮**不动**这些已有逻辑。
> 视觉与文案基准:随本提示词附上的 **《知识宇宙_落地页原型_V1.html》**——颜色、字体、分区结构、正文文案**以该原型为准**,下文只做结构说明与约束,不重复誊抄全部文案。
> 目标产物:一个**公开、可被搜索引擎索引**的官网落地页 + 一套 SEO 基建 + 一个 `/blog` 脚手架(含 1 篇样稿)。

---

## 0. 给 Claude Code 的前置说明

- **先读现有代码再动手**:先摸清现有 App Router 的目录结构、根 `layout`、认证是怎么接的(客户端 Supabase / 中间件)、`/` 现在渲染的是什么(登录页?应用首页?)。**别重写能用的部分。**
- **复用既有设计系统**,不要新造一套:纸感 `--paper #FAF8F3`、墨色 `--ink #20242E`、琥珀 `--amber #DD9527`、`--sage`、`--plum`;UI 字体 Inter、阅读/标题衬线 Noto Serif SC。原型里的 CSS 变量与现有 App 一致,能抽成共享 token 就抽。
- **逐片做,每片停下让我验证**。范围纪律见 §7,别顺手扩。
- **架构分叉(§3)先跟我确认**再动手,不要默默选一种实现。
- 有更优实现先说明再改,不要静默扩大范围。

---

## 1. 本轮目标与产物

把 `knowledgeverse.space` 的公开首页,从"登录/应用页"变成一个**面向陌生访客的营销落地页**,并让它和后续博客**能被 Google 正确抓取、索引、展示**。具体三块:

1. **落地页**:按原型实现的公开首页(Hero 星群签名 → 痛点 → 四步运作 → "不是又一个聊天框" → 真实用例 → 免费开始 → 页脚)。
2. **SEO 基建**:服务端渲染 + 每页元数据 + `sitemap` + `robots` + 结构化数据 + OG 图 + canonical/域名归一 + 字体性能。
3. **`/blog` 脚手架**:博客列表页 + 文章模板(单篇 SSG、带 Article 结构化数据),含 **1 篇样稿**占位,后续内容由创始人补。

---

## 2. 角色分工

| 事项 | Claude Code | 创始人(Aiyo) |
|---|---|---|
| 落地页/博客页面与组件 | ✅ 实现 | 验收 |
| SEO 基建(metadata / sitemap / robots / JSON-LD / OG) | ✅ 实现 | 验收 |
| 路由架构选型(§3) | 出方案 | ✅ 拍板 |
| 品牌资产(logo、OG 分享图源文件) | 先用占位/代码生成 | 🔶 后补正式图 |
| 博客正文内容 | 搭架子 + 1 篇样稿 | 🔶 补真实文章 |
| **Google Search Console 验证域名 + 提交 sitemap** | 给出步骤 | 🔶 **仅创始人可做**(域名在 Aliyun,加 TXT 或用验证文件) |
| 分析工具(GA4 / Plausible / Umami)选型与密钥 | 预留接入位 | 🔶 决定 + 提供 key |
| Vercel 域名/重定向(www→非 www 等)配置 | 给出所需规则 | 🔶 在 Vercel 后台配 |
| 隐私政策 / 用户协议真实页面 | 接入链接位 | 🔶 提供真实两份 |

> ⚠️ 凡涉及**账号后台、域名 DNS、第三方密钥**的,都是创始人自己做,Claude Code 只预留接入位并写清步骤。

---

## 3. 路由架构决策(先确认再施工)

落地页是**公开、无需登录**的营销页,而现有 App 是**登录后**的产品。需要定清 `/` 归谁、登录用户访问 `/` 怎么走。给两个方案,**我推荐 A**:

**方案 A(推荐)· `/` = 公开落地页,App 收进 `/app`(或路由组)**
- `/` 渲染落地页(静态,人人可见)。
- 现有 App 页面迁到 `/app/*`(或用 App Router 的 `(marketing)` / `(app)` 路由组分区,URL 保持或规整)。
- 登录态处理:落地页壳保持静态 SSG;CTA「免费开始」→ 未登录去 `/login`、已登录去 `/app`(用一小段客户端逻辑在 hydration 后判断,**不阻塞静态渲染**)。
- 好处:落地页天然可被索引;营销页与产品页关注点分离;后续加 `/blog`、`/pricing` 都在公开区,干净。

**方案 B · `/` 保留应用入口,落地页挂到独立路径**
- 落地页放 `/home` 之类,`/` 仍是登录/应用。
- 简单但别扭:搜索引擎抓到的首页不是营销页,分享链接也不对,**不推荐**。

> Claude Code:先按此判断现有 `/` 是什么,给出**迁移改动清单**(哪些文件/路由要动、对已装用户和已有链接有无影响),我确认后再动。**已有的登录/学习/AI 逻辑本身不改,只改它们挂在哪个路由。**

---

## 4. 落地页内容与结构

**以原型 HTML 为文案与视觉基准**,分区落地成 React 组件(每区一个组件,便于单独调):

| 区块 | 要点 | 备注 |
|---|---|---|
| 顶部 Nav | 品牌「知识**宇宙**」+ 锚点链接(它怎么运作/学什么/博客)+ 主 CTA「免费开始」 | sticky、毛玻璃;移动端隐藏次要链接只留品牌+CTA |
| Hero | 衬线大标题(定位)+ 副文案 + 双 CTA + **星群签名 SVG** | 星群:中心「你」+ 环绕三个学习空间(心学/AI PM/钢琴),`prefers-reduced-motion` 下停动画 |
| 痛点 | 6 张"熟悉这些时刻吗"卡 + 一句收束(时间线 vs 知识结构) | 承接来访者的真实痛感 |
| 四步运作 | 壹～肆;**第叁步「长按选词问 AI」标记为核心差异** | 差异化重点,视觉上给权重 |
| 差异带 | 黑底强调:AI 带着"对你的了解"回答 | 与通用聊天框拉开区隔 |
| 真实用例 | 三张卡(职业/思辨/技能)+ "创始人自己在用"一句 | 真实感即信任状 |
| 免费开始 | 主 CTA 卡 + "内测期免费/多空间/无需信用卡" | 页面主转化点 |
| 页脚 | 品牌 + 公司名 + 产品/资源/法务三列链接 | 隐私政策、用户协议、邀请码、博客入口 |

**CTA 目标(本轮约定,可后调)**:
- 主 CTA「免费开始使用」→ 未登录 `/login`(或注册),已登录 `/app`。
- 次 CTA「下载 App」→ 暂为**「即将上线」占位**(App 过审后再换 App Store / Google Play 链接)。

**响应式**:桌面 Hero 双栏(文案 | 星群),≤860px 单栏、星群置顶缩小;全站移动端无横向滚动。

---

## 5. SEO 施工要求(本轮重点,逐条落实)

> 一句话原则:**落地页负责转化、博客负责排名;真正的自然流量靠内容,但前提是这套基建让 Google 能抓到、看懂、愿意展示。**

### 5.1 渲染方式(最关键)
- 落地页与所有博客页**必须服务端渲染 / 静态生成**(App Router Server Component,页面级别**不要** `"use client"`)。
- 需要客户端交互的部分(如登录态判断、星群动画)**下沉成小的客户端子组件**,不把整页拖成 CSR。
- **自查**:浏览器"查看源代码"或禁用 JS 后,落地页与文章的**正文文字在 HTML 源码里就存在**——这是判定 SSR/SSG 成没成的硬标准。

### 5.2 每页元数据(Metadata API)
- 根 `layout` 设 `metadataBase: new URL('https://knowledgeverse.space')`,`html lang="zh-CN"`。
- 每个公开页 `export const metadata`(博客单篇用 `generateMetadata`)必须含:
  - 唯一 `title`(建议模板 `%s · 知识宇宙`,首页用完整定位句)
  - `description`(自然含"AI 学习""个人学习空间""学习路径"等目标语义,别堆砌)
  - `alternates.canonical`(每页指向自身规范 URL)
  - `openGraph`(title / description / type / locale `zh_CN` / images / url)
  - `twitter`(`summary_large_image`)
- 首页 `title`/`description` 用原型 `<title>`/`<meta description>` 那两句。

### 5.3 sitemap 与 robots
- `app/sitemap.ts` 返回 `MetadataRoute.Sitemap`:**列出首页 + 博客列表 + 每篇博客**(URL 用**绝对路径带域名**),博客部分从内容源动态生成、可随文章增长。
- `app/robots.ts` 返回 `MetadataRoute.Robots`:允许抓取公开页,**屏蔽 `/app`、`/login` 等私有/无索引价值路由**,`sitemap` 字段指向 `https://knowledgeverse.space/sitemap.xml`。

### 5.4 结构化数据(JSON-LD)
- 在根 layout(或首页)注入 `Organization` + `SoftwareApplication`(名称、URL、logo、`applicationCategory: EducationalApplication`、`offers` 免费)。
- 博客单篇注入 `Article`(标题、作者、发布/更新时间、`mainEntityOfPage`);列表可选 `BreadcrumbList`。
- 用 Server Component 里的 `<script type="application/ld+json">` 注入(`dangerouslySetInnerHTML`),**别用客户端注入**。
- **自查**:Google Rich Results Test / Schema Markup Validator 校验**无报错**。

### 5.5 OG 分享图
- 提供 OG 图:优先 `app/opengraph-image.tsx`(用 `next/og` 代码生成,纸感底 + 品牌 + 定位句,尺寸 1200×630);创始人后续可换正式设计图。
- 博客单篇可各自出图或复用默认图。
- **自查**:分享到微信/Twitter/Telegram,标题、描述、缩略图正确。

### 5.6 canonical 与域名归一
- 全站规范到**单一主机**(建议无 `www`)。`www`→非 `www`、`http`→`https` 的 301 由 **Vercel/域名侧**处理(创始人配),Claude Code 在 `metadata` 里把 canonical 固定成主机版本兜底。
- 避免同内容多 URL(尾斜杠、大小写)产生重复。

### 5.7 字体与性能(中文站要特别注意)
- 用 `next/font` 加载 Inter;**Noto Serif SC 是 CJK 大字体**,全量加载会拖慢首屏——策略二选一并说明:
  - (a) 衬线**仅用于标题**、`display:'swap'`、尽量子集化;或
  - (b) 衬线走系统字体栈(`Songti SC` 等)兜底,不额外下载大字体。
  - **推荐 (a) 且只在 H1/H2 用衬线**,正文用 Inter 系,平衡质感与速度。
- 图片用 `next/image`;避免布局抖动(CLS);Hero SVG 内联即可。
- 目标:移动端 Lighthouse **SEO ≥ 95、Performance 尽量 ≥ 90**,Core Web Vitals 绿。

### 5.8 `/blog` 脚手架
- `/blog` 列表页(SSG)+ `/blog/[slug]` 单篇模板(SSG,`generateStaticParams`)。
- 内容源用**本地 MDX / Markdown**(轻、够用、Vercel 友好),文章 frontmatter 含 `title / description / date / updated / slug`。
- 单篇:唯一 `<h1>`、正确标题层级、`Article` JSON-LD、`generateMetadata` 出元数据、自动进 sitemap。
- **写 1 篇样稿**占位(题目用《为什么 AI 聊天框不适合学习》,正文可先放三五段占位,由创始人替换真文),验证全链路。

### 5.9 站长与分析(创始人执行,Claude Code 预留位)
- **Google Search Console**:创始人验证域名(Aliyun 加 TXT 记录 / 或放验证文件到 `public/`)→ 提交 `sitemap.xml`。Claude Code 给出两种验证方式的落地位置说明。
- **分析**:预留一个可插拔的分析注入点(GA4 或 Plausible/Umami 皆可),密钥走环境变量;创始人定工具后填 `.env`。本轮**不硬绑**某一家。

---

## 6. 建议开发顺序(每片停下让我验证)

1. **路由架构**(§3):判断现有 `/`,给迁移改动清单 → 我确认 → 落地页占位页 + App 迁到 `/app`,登录/学习/AI 逻辑照跑。(先跑通路由,不做样式。)
2. **落地页视觉**(§4):按原型把各分区组件实现到位,设计系统对齐。**先不接 SEO 基建**,只求视觉与文案和原型一致、响应式、动画 reduced-motion 安全。
3. **元数据基建**(§5.1–5.2、5.6):SSR/SSG 确认 + 根 `metadataBase` + `lang` + 每页 metadata + canonical。(禁 JS 查源码验正文在 HTML 里。)
4. **sitemap / robots / OG**(§5.3、5.5):三者可访问、内容正确、OG 分享正常。
5. **结构化数据**(§5.4):Organization + SoftwareApplication,校验器无报错。
6. **/blog 脚手架**(§5.8):列表 + 单篇模板 + 1 样稿 + Article JSON-LD + 自动进 sitemap。
7. **性能收口**(§5.7):字体策略落地、`next/image`、Lighthouse 跑分,交我看数。

> 每片做完打印/截图关键产出(源码片段、`sitemap.xml` 输出、校验器结果、Lighthouse 分)给我看,再进下一片。

---

## 7. 明确不做(范围纪律)

- ✗ **不改动** App 内已有的登录 / 学习 / 路径 / 划线问 AI / 用户记忆等**任何业务逻辑**(本轮只碰"它们挂在哪个路由")。
- ✗ **不做多语言 i18n / 英文站**(本轮纯中文;`lang="zh-CN"`)。
- ✗ **不做程序化 SEO(公开学习路径页)**——那要等"学习路径对外分享"功能,后续单独一轮。
- ✗ **不做定价页 / 付费墙**(v1 免费,落地页只讲"免费开始")。
- ✗ **不写全部博客正文**(只搭架子 + 1 篇样稿占位)。
- ✗ **不做百度 SEO / 百度站长**(海外华语,Google 为主)。
- ✗ **不做 newsletter 订阅弹窗 / 邮件采集**(后续再议)。
- ✗ **不自行注册任何账号 / 改 DNS / 填第三方密钥**(§2 创始人事项)。

---

## 8. 验收标准(重点:试着弄坏它)

**渲染与可索引**
- [ ] 禁用 JS(或查看源代码)后,**落地页正文、博客文章正文仍在 HTML 里**(证明 SSG/SSR,非纯客户端)。
- [ ] `/sitemap.xml` 可访问,含首页 + 博客列表 + 每篇文章,URL 均为**带域名的绝对路径**;新增一篇文章后**自动出现在 sitemap**。
- [ ] `/robots.txt` 可访问,允许抓公开页、**屏蔽 `/app` 与 `/login`**,指向 sitemap。

**元数据**
- [ ] 每个公开页有**唯一** `title` 与 `description`;首页文案与原型一致。
- [ ] 每页有 `canonical`,统一到主机(无 `www`);`http`/`www` 访问 301 到主域(创始人配置后复验)。
- [ ] OG 分享到微信 / Twitter / Telegram,**标题+描述+缩略图**都正确。

**结构化数据**
- [ ] Rich Results Test / Schema Validator 校验 `Organization` + `SoftwareApplication` + 博客 `Article`,**零报错**。

**路由与转化**
- [ ] 未登录访问 `/` 看到落地页;点「免费开始」→ 到注册/登录。
- [ ] 已登录访问 `/` 的行为符合 §3 约定(直达 `/app` 或落地页显示"进入学习")。
- [ ] 已有 App 功能(登录后学习/问 AI 等)迁路由后**照常工作**,老链接不 404(或有 301)。

**质量地板**
- [ ] `html lang="zh-CN"`;移动端无横向滚动;键盘可聚焦、focus 可见。
- [ ] `prefers-reduced-motion` 下星群/滚动动画停止。
- [ ] 移动端 Lighthouse **SEO ≥ 95**;Performance 尽量 ≥ 90,CLS 无明显抖动。
- [ ] 大字体(Noto Serif SC)未拖垮首屏(按 §5.7 策略执行并说明取舍)。

---

> 做完本轮,`knowledgeverse.space` 就从"登录页"变成一个**能承接社媒/社群流量、且为长尾内容 SEO 打好地基**的官网。下一步是**持续产出博客内容**(把落地页的"博客负责排名"真正跑起来),以及等分享功能上线后做**程序化 SEO(公开学习路径页)**——那将是自然流量的主引擎,届时另起一轮施工提示词。
