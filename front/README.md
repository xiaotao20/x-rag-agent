# RAG Agent 前端

基于 **Next.js 16（App Router）+ React 19 + Tailwind CSS v4** 的知识库问答界面，对接项目根目录的 FastAPI 后端。

- `/`：深色科技风落地页，包含产品介绍、应用领域、固定背景图和登录弹窗；
- `/chat`：聊天工作台，分为左侧侧栏和右侧工作区。侧栏顶部固定「新聊天」，下面依次是「资料库」入口和「最近」会话列表，这部分可以滚动；最底部固定当前登录账号，点击弹出账号菜单并可退出登录。历史会话支持切换、重命名和删除；侧栏不再展示文档列表和上传入口。切到「资料库」后，右侧显示独立资料库页面，集中管理文档：通过「新增文档」上传、刷新、卡片/列表视图切换和删除。桌面端侧栏默认收起，鼠标移到左侧边缘会自动滑出预览、移开自动收起；支持流式回答、工具调用状态、引用来源展开、停止生成和移动端抽屉布局。

登录弹窗支持账号密码登录和注册，注册/登录成功后自动进入 `/chat`。`/chat` 通过 `AuthGate` 调用后端 `/api/v1/auth/me` 校验登录态，未登录会回到落地页并自动打开登录框。文档列表、上传、检索和引用都会按当前登录用户隔离。后端会先做规则意图识别：寒暄直接回答且不检索，文档操作返回资料库操作引导，其余问题走 RAG。会话达到 10 条后由后端维护滚动摘要，前端仍展示完整历史。

## 技术栈

| 用途 | 选型 |
|---|---|
| 框架 | Next.js 16 App Router |
| UI | React 19 + TypeScript |
| 样式 | Tailwind CSS v4（`tailwindcss` + `@tailwindcss/postcss`） |
| 图标 | lucide-react |
| Markdown | react-markdown + remark-gfm |
| 流式 | 原生 `fetch` + `ReadableStream` 解析 SSE |

## 快速开始

### 1. 启动后端

在项目根目录：

```bash
source .venv/bin/activate
uvicorn app.main:app --reload
```

后端默认运行在 `http://127.0.0.1:8000`；前端默认通过 Next.js rewrite 把当前站点的 `/api/v1` 代理到该地址，浏览器侧保持同源，登录 Cookie 更简单。跨域白名单由根目录 `.env` 的 `CORS_ORIGINS` 控制，默认已包含：

```text
CORS_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
```

如果前端换端口，需要同步修改这里并重启后端。

### 2. 启动前端

```bash
cd front
npm install
cp .env.example .env.local   # 可选，默认通过同源代理访问 127.0.0.1:8000
npm run dev
```

打开 http://localhost:3000（或 http://127.0.0.1:3000）。

### 3. 生产构建

```bash
npm run build
npm start
```

## 环境变量

| 变量 | 默认值 | 说明 |
|---|---|---|
| `NEXT_PUBLIC_API_BASE_URL` | 空 | 留空时浏览器请求当前站点 `/api/v1`，由 Next.js 代理到 FastAPI，登录 Cookie 保持同源 |
| `API_PROXY_TARGET` | `http://127.0.0.1:8000` | Next.js 服务端代理目标，部署时按实际 FastAPI 地址修改 |

`NEXT_PUBLIC_API_BASE_URL` 在构建时内联，修改后需要重新启动开发服务器或重新构建。`API_PROXY_TARGET` 是服务端变量，修改后重启 Next 服务即可。

## 目录结构

```text
front/
├── app/
│   ├── layout.tsx          # 根布局、元信息
│   ├── page.tsx            # 落地页入口
│   ├── chat/page.tsx       # 聊天工作台入口，渲染 AppShell
│   ├── api/v1/chat/stream/route.ts  # SSE 流式转发，绕过 Next rewrite 的压缩缓冲
│   ├── fonts/              # 自托管 Space Grotesk 字体和 OFL 许可
│   ├── globals.css         # Tailwind 入口、@theme 设计 token、基础样式
│   └── icon.svg            # favicon
├── components/
│   ├── landing/
│   │   ├── LandingPage.tsx  # 落地页、产品介绍、应用领域、CTA
│   │   ├── LoginModal.tsx   # 登录/注册弹窗
│   │   ├── AccountAuthForm.tsx
│   │   └── PuzzleCaptcha.tsx # 可选防刷组件，当前未接入登录
│   ├── AuthGate.tsx        # 聊天页登录态校验，并把当前用户传给 AppShell
│   ├── AppShell.tsx        # 工作台布局、问答/资料库视图切换、健康检查和文档列表状态
│   ├── Sidebar.tsx         # 新聊天、资料库入口、最近会话、账号菜单和退出登录
│   ├── ChatPanel.tsx       # 对话状态、历史加载、流式请求、停止/新对话
│   ├── LibraryPanel.tsx    # 资料库页面、卡片/列表视图、刷新和文档删除
│   ├── ConfirmDialog.tsx   # 全屏遮罩确认对话框
│   ├── Composer.tsx        # 自适应输入框、发送/停止
│   ├── Message.tsx         # 用户/助手消息、工具状态
│   ├── Markdown.tsx        # Markdown 渲染与排版
│   ├── Sources.tsx         # 引用来源折叠与片段展开
│   └── EmptyState.tsx      # 空状态与示例问题
├── lib/
│   ├── api.ts              # 聊天/文档/会话接口封装与 SSE 解析
│   ├── auth.ts             # 账号注册/登录、会话、可选拼图接口
│   ├── types.ts            # 接口/消息类型
│   └── utils.ts            # className 合并、格式化
├── public/images/          # 落地页背景图
├── postcss.config.mjs      # @tailwindcss/postcss
├── next.config.ts          # allowedDevOrigins、关闭 dev indicator 和响应压缩（保证 SSE 流式）
└── .env.example
```

## 对接的后端接口

| 方法 | 路径 | 用途 | 前端位置 |
|---|---|---|---|
| GET | `/api/v1/health` | 服务在线状态，每 30 秒轮询 | `AppShell` |
| GET | `/api/v1/documents` | 当前用户文档列表与片段数（需登录） | `AppShell` / `Sidebar` |
| POST | `/api/v1/documents` | 当前用户 multipart 上传，自动切分入库（需登录） | `LibraryPanel` |
| DELETE | `/api/v1/documents/{id}` | 删除当前用户文档、向量和 uploads 原文件（需登录） | `Sidebar` / `LibraryPanel` |
| POST | `/api/v1/chat/stream` | SSE 流式问答（主链路） | `ChatPanel` |
| POST | `/api/v1/chat` | 非流式问答（前端未使用，保留调试） | — |
| POST | `/api/v1/retrieval/search` | 当前用户纯检索（前端未使用，便于调试；需登录） | — |
| POST | `/api/v1/auth/register` | 账号注册，成功后设置会话 Cookie | `AccountAuthForm` |
| POST | `/api/v1/auth/login` | 账号密码登录，成功后设置会话 Cookie | `AccountAuthForm` |
| GET | `/api/v1/auth/me` | 当前登录用户；未登录返回 401 | `AuthGate` |
| POST | `/api/v1/auth/logout` | 吊销会话并清除 Cookie | `Sidebar` |
| GET | `/api/v1/auth/captcha/challenge` | 可选拼图挑战，当前未接入登录 | `PuzzleCaptcha`（未使用） |
| POST | `/api/v1/auth/captcha/verify` | 可选拼图校验，当前未接入登录 | `PuzzleCaptcha`（未使用） |
| GET | `/api/v1/conversations` | 当前用户的会话列表 | `AppShell` / `Sidebar` |
| GET | `/api/v1/conversations/{id}` | 会话详情和历史消息 | `ChatPanel` |
| PATCH | `/api/v1/conversations/{id}` | 重命名会话 | `Sidebar` |
| DELETE | `/api/v1/conversations/{id}` | 删除会话 | `Sidebar` |

## 流式协议

后端是 POST SSE，每条事件格式为 `data: <JSON>\n\n`。前端用 `fetch` + `ReadableStream` 手动按空行切帧，因为浏览器原生 `EventSource` 只支持 GET。

| `type` | 字段 | 前端行为 |
|---|---|---|
| `conversation` | `conversation_id`、`title` | 新会话 ID，更新侧栏列表并避免重复加载 |
| `intent` | `intent` | 后端规则意图（`chitchat` / `document_action` / `knowledge`），前端暂不展示 |
| `token` | `content` | 追加到助手消息，实时渲染 Markdown |
| `tool_start` | `name`、`args` | 显示「检索知识库…」状态胶囊 |
| `tool_end` | `name` | 状态胶囊变为完成 |
| `sources` | `sources[]` | 显示「引用来源」折叠面板 |
| `done` | — | 结束流，恢复发送按钮 |
| `error` | `message` | 显示红色错误卡片（HTTP 状态此时已是 200） |

停止生成使用 `AbortController` 中断 fetch，后端连接关闭后停止生成；消息标记为「已停止」。

## 设计系统

所有 token 定义在 `app/globals.css` 的 `@theme` 块里，组件里只使用 token 对应的类名，不写零散魔法值。

### 颜色

| Token | 色值 | 用途 |
|---|---|---|
| `canvas` | `#f6f5f1` | 页面背景（暖灰纸感），侧栏和聊天区统一使用 |
| `surface` | `#fffefb` | 卡片、输入框、账号弹层 |
| `subtle` | `#efeee7` | 次级背景、骨架屏 |
| `line` | `#e4e1d8` | 边框、分隔线 |
| `ink` | `#1b1b19` | 主文字、用户气泡 |
| `muted` | `#5f5d56` | 次要文字（对比度约 5.9:1） |
| `faint` | `#76746c` | 辅助信息（对比度约 4.3:1） |
| `accent` | `#3b5bdb` | 主操作、链接、强调 |
| `accent-soft` | `#edf1ff` | 选中/悬停淡背景 |
| `danger` / `danger-soft` | `#b42318` / `#fef3f2` | 错误、删除 |
| `success` | `#067647` | 在线状态、完成 |
| `warning` | `#b54708` | 提示信息 |

### 排版与形状

- 字体：正文使用 Inter → 系统无衬线 → PingFang SC / Noto Sans SC；侧栏品牌字「X-AGENT」使用 `next/font/local` 加载项目内的 Space Grotesk（`app/fonts/SpaceGrotesk-Variable.woff2`，SIL OFL 许可），构建和运行都不需要访问 Google Fonts。
- 字号：正文 14px / 行高 28px，辅助 11–12px，空状态标题 26–30px，全站不超过 5 档。
- 间距：4/8 倍数，常用 4、8、12、16、24、32。
- 圆角：`xl 12px`、`2xl 16px`、`3xl 22px`，同类组件保持一致。
- 阴影：`shadow-card` 用于浮起卡片，`shadow-pop` 用于移动端抽屉，避免多层重阴影。

### 交互与状态

- 消息最大阅读宽度 `72ch`，助手回答左对齐、用户消息右侧气泡。
- 每个可交互元素都有 hover / focus-visible / disabled 状态。
- 键盘焦点统一为 2px 蓝色 outline，输入框使用容器 focus ring。
- 全局 `prefers-reduced-motion` 降低动画；消息入场动画和状态脉冲都在此规则下禁用。
- 空状态（示例问题）、加载骨架、离线提示、上传错误、删除确认、停止生成、引用为空等状态均已覆盖。
- 新聊天空页面的标题在几条引导语之间自动轮换：逐字打出、停留约 5 秒、逐字删除后切换到下一句；开启 `prefers-reduced-motion` 时直接显示第一条。
- 桌面端侧栏有三种状态：默认隐藏；鼠标移到左侧 12px 区域约 120ms 后以 300ms 缓动滑出，移开约 220ms 后收起；显示时在侧栏与正文的分界线上显示向左的收起按钮。在预览侧栏的空白或文档区域点击会固定侧栏。固定时侧栏宽度从 0 平滑展开、正文同步右移，收回时反向播放，点击分界线上的收起按钮恢复隐藏。上传、删除、刷新等按钮不会触发固定，避免中断当前操作。
- 侧栏结构：顶部「新聊天」固定，底部当前账号固定；中间的「资料库」入口和「最近」会话列表共用一个滚动区域。资料库页面位于右侧工作区，不跳转新路由；卡片/列表视图选择会保存在浏览器 localStorage。
- 「最近」对话采用无边框行式布局：列表和行本身都没有 border/底色，当前会话用浅灰圆角高亮，悬停时行背景变浅并显示重命名/删除按钮。
- 侧栏底部使用默认头像展示当前账号；点击后在账号区域上方弹出菜单，菜单内提供「退出登录」，支持点击外部区域或 `Esc` 关闭。
- 文档上传入口已从侧栏移到资料库：右上角「新增文档」打开文件选择，上传后自动刷新卡片/列表；空资料库中也有同样的上传按钮。
- 资料库删除采用全屏遮罩确认框，支持 `Esc`、点击遮罩和取消；删除后向量、原文件和文档计数同步清理。
- 聊天区和资料库不设顶部标题栏，标题和操作都放回侧栏或页面内容中；移动端左上角使用浮动菜单按钮打开侧栏。
- 移动端侧栏为抽屉，带遮罩，可通过按钮关闭；输入区适配软键盘。

## Tailwind CSS v4 说明

- 入口是 `app/globals.css` 的 `@import "tailwindcss";`，设计 token 写在同一个文件的 `@theme` 块里。
- `postcss.config.mjs` 注册 `@tailwindcss/postcss`，Next.js 构建时自动扫描 `app/`、`components/` 中的类名，不需要额外的 `content` 配置。
- 颜色、圆角、阴影、字体使用 `--color-*`、`--radius-*`、`--shadow-*`、`--font-*` 命名空间，类名自动生成，例如 `--color-danger-soft` 对应 `bg-danger-soft`。
- 自定义动画 `animate-rise`、`animate-pulse-soft` 及其 `@keyframes` 也定义在 `@theme` 中。
- 样式在构建时生成静态 CSS，首屏直接带完整样式，没有客户端注入和无样式闪烁。
- Tailwind 通过静态扫描收集类名，**不要用字符串拼接动态生成类名**（如 `bg-${color}-500`）；本项目所有类名都是字面量。

## 可访问性

- 图标按钮都有 `aria-label`，折叠按钮使用 `aria-expanded`。
- 流式生成状态使用 `role="status"` + `aria-live="polite"`，避免整段 token 被逐字朗读。
- 正文与次要文字对比度满足 WCAG AA；焦点环清晰可见。
- 输入框支持 Enter 发送、Shift + Enter 换行，并检测中文输入法 `isComposing`，避免选词时误发送。

## 常用命令

```bash
npm run dev        # 开发服务器
npm run build      # 生产构建（含 TypeScript 检查）
npm run start      # 运行生产构建
npm run typecheck  # 仅类型检查
```

## 常见问题

**浏览器报 CORS 错误**

确认后端 `.env` 的 `CORS_ORIGINS` 包含前端实际访问的 origin（协议 + 域名 + 端口），修改后重启 uvicorn。

**页面显示「服务离线」**

确认 FastAPI 在 `http://127.0.0.1:8000` 运行。默认由 `API_PROXY_TARGET` 指定 Next.js 服务端代理目标；不要把只有容器内部能解析的主机名填到 `NEXT_PUBLIC_API_BASE_URL`。

**流式回答变成一次性返回**

本项目通过 Next.js 的 `rewrites` 同源代理访问后端。开发模式下 Next 的响应压缩会缓冲 `text/event-stream`，所以 `next.config.ts` 设置了 `compress: false`。

但生产模式 `next start` 的 rewrite 代理即使关闭压缩，仍会给 SSE 加上 gzip 并整段缓冲，所以 `/api/v1/chat/stream` 单独使用 `app/api/v1/chat/stream/route.ts` 原样转发流式响应。以后新增其他 SSE 接口时，也要用同样的 Route Handler，或者改由 Nginx/Caddy 等真正的反向代理转发。后端已返回 `X-Accel-Buffering: no`，外层代理仍需关闭对 SSE 的缓冲和压缩。Docker 环境修改后需要重新 `docker compose build web`。

**用 127.0.0.1 打开时 HMR 报错或开发资源被拦截**

Next 开发服务器默认只信任 `localhost`。本项目已在 `next.config.ts` 的 `allowedDevOrigins` 中加入 `127.0.0.1`；如果换成局域网 IP，需要一并加入。生产模式不受影响。

**`Failed to load SWC binary for darwin/arm64`**

`node_modules/@next/swc-darwin-arm64` 安装不完整（只有 package.json、没有 `.node` 文件）。重新安装对应版本即可：

```bash
npm install @next/swc-darwin-arm64@16.4.2 --no-save
```

**上传大文档很慢**

后端 embedding 按每批 10 条调用百炼接口（单请求批量有上限），片段越多请求次数越多，属于上游限制。

## 已知限制

- 会话和消息已持久化到后端 PostgreSQL，侧栏可切换历史会话和新建对话。
- 登录/注册使用账号密码，密码由后端 Argon2 哈希存储；`/chat` 通过 `AuthGate` 校验会话。
- 短信验证码和微信扫码未实现；拼图接口保留为可选防刷能力，当前未接入登录/注册流程。
- 文档已按用户隔离；还没有组织/租户、角色权限和文档级 ACL，适合本地或内网使用。
- 引用来源的分数由 `score_type` 决定：`vector` 是 Chroma 距离（越小越相似），`bm25` / `rrf` / `rerank` 是相关性分数（越大越相关），都不是概率。
- Markdown 不渲染原始 HTML（react-markdown 默认转义），避免 XSS。
- 落地页是深色科技风，聊天工作台仍是浅色主题；颜色 token 已集中，后续可以统一深色模式。
