# RAG Agent 前端

基于 **Next.js 16（App Router）+ React 19 + Tailwind CSS v4** 的知识库问答界面，对接项目根目录的 FastAPI 后端。

界面分为左侧知识库侧栏和右侧对话区：桌面端侧栏默认收起，鼠标移到左侧边缘会自动滑出预览、移开自动收起；显示时在侧栏与正文的分界线上有向左的收起按钮。在预览侧栏的空白或文档区域点击即可固定显示。支持文档上传/删除、列表刷新、流式回答、工具调用状态、引用来源展开、停止生成、移动端抽屉布局，以及在线/离线、空状态、加载、错误等完整状态。

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

后端默认地址 `http://127.0.0.1:8000`。跨域白名单由根目录 `.env` 的 `CORS_ORIGINS` 控制，默认已包含：

```text
CORS_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
```

如果前端换端口，需要同步修改这里并重启后端。

### 2. 启动前端

```bash
cd front
npm install
cp .env.example .env.local   # 可选，默认就是 127.0.0.1:8000
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
| `NEXT_PUBLIC_API_BASE_URL` | `http://127.0.0.1:8000` | 浏览器访问的 FastAPI 地址，必须是浏览器可达的地址 |

变量在构建时内联，修改后需要重新启动开发服务器或重新构建。

## 目录结构

```text
front/
├── app/
│   ├── layout.tsx          # 根布局、元信息
│   ├── page.tsx            # 入口，渲染 AppShell
│   ├── globals.css         # Tailwind 入口、@theme 设计 token、基础样式
│   └── icon.svg            # favicon
├── components/
│   ├── AppShell.tsx        # 整体布局、健康检查、文档列表状态
│   ├── Sidebar.tsx         # 文档上传、列表、删除确认、服务状态
│   ├── ChatPanel.tsx       # 对话状态、流式请求、停止/新对话
│   ├── Composer.tsx        # 自适应输入框、发送/停止
│   ├── Message.tsx         # 用户/助手消息、工具状态
│   ├── Markdown.tsx        # Markdown 渲染与排版
│   ├── Sources.tsx         # 引用来源折叠与片段展开
│   └── EmptyState.tsx      # 空状态与示例问题
├── lib/
│   ├── api.ts              # 接口封装与 SSE 解析
│   ├── types.ts            # 接口/消息类型
│   └── utils.ts            # className 合并、格式化
├── postcss.config.mjs      # @tailwindcss/postcss
├── next.config.ts          # allowedDevOrigins、关闭 dev indicator
└── .env.example
```

## 对接的后端接口

| 方法 | 路径 | 用途 | 前端位置 |
|---|---|---|---|
| GET | `/api/v1/health` | 服务在线状态，每 30 秒轮询 | `AppShell` |
| GET | `/api/v1/documents` | 文档列表与片段数 | `AppShell` / `Sidebar` |
| POST | `/api/v1/documents` | multipart 上传，自动切分入库 | `Sidebar` |
| DELETE | `/api/v1/documents/{id}` | 删除向量和 uploads 原文件 | `Sidebar` |
| POST | `/api/v1/chat/stream` | SSE 流式问答（主链路） | `ChatPanel` |
| POST | `/api/v1/chat` | 非流式问答（前端未使用，保留调试） | — |
| POST | `/api/v1/retrieval/search` | 纯检索（前端未使用，便于调试） | — |

## 流式协议

后端是 POST SSE，每条事件格式为 `data: <JSON>\n\n`。前端用 `fetch` + `ReadableStream` 手动按空行切帧，因为浏览器原生 `EventSource` 只支持 GET。

| `type` | 字段 | 前端行为 |
|---|---|---|
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
| `canvas` | `#f6f5f1` | 页面背景（暖灰纸感） |
| `surface` | `#fffefb` | 卡片、侧栏、输入框 |
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

- 字体：Inter → 系统无衬线 → PingFang SC / Noto Sans SC，中文环境直接使用系统字体，避免额外字体加载阻塞。
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
- 桌面端侧栏有三种状态：默认隐藏；鼠标移到左侧 12px 区域约 120ms 后以 300ms 缓动滑出，移开约 220ms 后收起；显示时在侧栏与正文的分界线上显示向左的收起按钮。在预览侧栏的空白或文档区域点击会固定侧栏。固定时侧栏宽度从 0 平滑展开、正文同步右移，收回时反向播放，点击分界线上的收起按钮恢复隐藏。上传、删除、刷新等按钮不会触发固定，避免中断当前操作。
- 知识库标题右侧有刷新按钮，刷新时图标旋转；上传、删除后列表也会自动刷新。
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

确认 FastAPI 在 `http://127.0.0.1:8000` 运行，且 `NEXT_PUBLIC_API_BASE_URL` 是浏览器能访问的地址。不要填 `http://backend:8000` 这种只有容器内部能解析的主机名。

**流式回答变成一次性返回**

检查是否经过 Nginx 等反向代理；后端已返回 `X-Accel-Buffering: no`，代理侧也需要关闭对 `text/event-stream` 的缓冲。

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

- 只有单轮会话状态，刷新页面后清空，没有会话持久化。
- 没有登录、租户隔离和权限控制，适合本地或内网使用。
- 引用来源展示的是 Chroma 向量距离（越小越相似），不是概率分数。
- Markdown 不渲染原始 HTML（react-markdown 默认转义），避免 XSS。
- 暂未提供深色模式；颜色 token 已集中，扩展时只需新增一套映射。
