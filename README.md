# RAG Agent — FastAPI + LangChain 1.2 + Chroma

一个最小完整的 RAG Agent 后端：文档上传、解析、切分、Embedding、Chroma 持久化、Query 改写、混合检索（向量 + BM25 + RRF）、可选 Rerank、Agent 工具调用、会话记忆、来源返回、文档列表与删除。另附 Next.js + Tailwind CSS 前端（`front/`），也可以直接通过 Swagger UI 调试。

## 启动
```bash
python -m venv .venv
# macOS/Linux: source .venv/bin/activate
# Windows: .venv\Scripts\Activate.ps1
pip install -r requirements.txt
cp .env.example .env
# 编辑 .env，配置可用的 Chat 与 Embedding API
uvicorn app.main:app --reload
```
打开 http://127.0.0.1:8000/docs

## Docker Compose（可选）

项目提供了 `docker-compose.yml`，会一起启动：

- `api`：FastAPI + Chroma
- `web`：Next.js 前端
- `postgres`：PostgreSQL
- `redis`：Redis

首次使用：

```bash
cp .env.example .env
# 编辑 .env，至少配置 OPENAI_API_KEY；AUTH_SECRET 建议换成随机值
docker compose up -d --build
docker compose ps
```
**部署花费 300秒左右**

打开：

- 前端：http://127.0.0.1:3000
- 后端文档：http://127.0.0.1:8000/docs

说明：

- Postgres 会通过 `POSTGRES_DB=rag_agent` 自动创建 `rag_agent` 数据库，应用启动时自动建表；
- Postgres 和 Redis 默认不映射宿主机端口，只在 Compose 网络内给 `api` 使用；
- Chroma 数据、上传文件和日志分别挂载到 `./data/chroma`、`./uploads`、`./logs`；
- 前端通过 `API_PROXY_TARGET=http://api:8000` 走同源代理，登录 Cookie 不需要处理跨站；
- 如果本机的 8000/3000 已被开发服务占用，可以在 `.env` 设置 `API_PORT=8100`、`WEB_PORT=3100`，或先停止本地服务；
- Compose 中的 `DATABASE_URL` / `REDIS_URL` 会覆盖 `.env` 里的 `127.0.0.1` 地址，使用服务名 `postgres`、`redis`；
- Compose 使用独立的 `postgres-data` / `redis-data` 命名卷，**不会复用本机已有 Postgres/Redis 容器里的账号、会话和 Redis 数据**；需要保留旧数据时先做 dump/restore，或移除 Compose 里的 postgres/redis 服务并让 API 连接现有实例；
- Chroma 使用的是宿主机 `./data/chroma` 绑定目录，现有向量库数据会继续复用；
- `api`、`web`、`postgres`、`redis` 都设置为 `restart: "no"`，不会自动重启；进程退出或宿主机重启后需要手动执行 `docker compose up -d`。

常用命令：

```bash
# 查看日志
docker compose logs -f api
docker compose logs -f web

# 进入 Postgres
docker compose exec postgres psql -U demo -d rag_agent

# 检查 Redis
docker compose exec redis sh -c 'redis-cli -a "$REDIS_PASSWORD" ping'

# 停止但保留数据
docker compose down

# 停止并删除数据库/Redis 数据卷（谨慎）
docker compose down -v
```

Compose 首次构建需要拉取 `python:3.13-slim`、`node:22-alpine`、`postgres:17`、`redis:7-alpine`；如果 Docker Hub 访问不稳定，先配置镜像加速或本地已有镜像。

## Redis（可选）

当前 RAG 检索不依赖 Redis；登录/注册限流和可选拼图 challenge 使用 Redis。只使用 RAG 问答可以不启动 Redis，使用登录/注册时需要启动。

```bash
docker run -d \
  --name rag-redis \
  --restart unless-stopped \
  -p 127.0.0.1:6379:6379 \
  -v rag-redis-data:/data \
  redis:7-alpine \
  redis-server \
    --appendonly yes \
    --requirepass '替换成强密码' \
    --maxmemory 256mb \
    --maxmemory-policy volatile-lru
```

参数说明：

| 参数 | 作用 |
|---|---|
| `-d` | 后台运行容器 |
| `--name rag-redis` | 容器名，后续 `docker logs`、`docker exec` 使用 |
| `--restart unless-stopped` | Docker 重启后自动拉起，手动停止的除外 |
| `-p 127.0.0.1:6379:6379` | 只把 Redis 暴露给本机，避免局域网访问；左边是宿主机端口，右边是容器端口 |
| `-v rag-redis-data:/data` | 把 Redis 数据持久化到名为 `rag-redis-data` 的 Docker volume |
| `redis:7-alpine` | Redis 7 的 Alpine 镜像，体积小；如果本地标签不是这个，换成实际拉取的版本 |
| `redis-server` | 容器内启动 Redis 服务 |
| `--appendonly yes` | 开启 AOF 持久化，重启后数据尽量保留 |
| `--requirepass '...'` | 设置 Redis 密码，必须和应用的 `REDIS_URL` 一致 |
| `--maxmemory 256mb` | 限制 Redis 最大内存 |
| `--maxmemory-policy volatile-lru` | 内存满时优先淘汰带 TTL 的 key，适合拼图挑战、限流这类临时数据 |

密码建议用随机十六进制串，避免 URL 编码问题：

```bash
openssl rand -hex 24
```

验证：

```bash
docker ps --filter name=rag-redis
docker logs --tail 20 rag-redis
docker exec -it rag-redis redis-cli -a '替换成强密码' ping
```

返回 `PONG` 表示正常。

应用连接配置：

```text
REDIS_URL=redis://:替换成强密码@127.0.0.1:6379/0
```

如果密码包含 `@`、`:`、`#` 等特殊字符，需要做 URL 编码；使用上面的十六进制密码即可避免。

停止和清理：

```bash
docker stop rag-redis
docker rm rag-redis
# 数据卷会保留；确认不再需要数据后再删除
docker volume rm rag-redis-data
```

注意：

- 如果 FastAPI 也运行在 Docker 里，应该使用同一个 Docker 网络和容器名（例如 `redis://:密码@rag-redis:6379/0`），不需要 `-p` 映射到宿主机。
- `volatile-lru` 只淘汰设置了 TTL 的 key；如果以后拿 Redis 做长期缓存，再考虑 `allkeys-lru`。
- 如果 `redis:7-alpine` 拉取失败，可以改用 `redis:7.4-alpine`，或先配置 Docker 镜像加速/代理。

## 前端
```bash
cd front
npm install
npm run dev
```
打开 http://localhost:3000：

- `/`：深色科技风落地页，包含产品介绍、应用领域、固定背景图和右上角登录弹窗；
- `/chat`：聊天工作台，对接 `chat/stream` 流式接口；侧栏包含「知识库问答 / 资料库」菜单和当前用户的会话列表，支持切换历史会话、新建对话、引用来源、停止生成和移动端布局。文档上传、列表、刷新和删除集中在右侧「资料库」页面，支持卡片/列表视图切换。详细说明见 [front/README.md](front/README.md)。

跨域由根目录 `.env` 的 `CORS_ORIGINS` 控制，默认允许 `http://localhost:3000` 和 `http://127.0.0.1:3000`。前端换端口时需要同步修改并重启后端。

## 登录页与认证

登录弹窗当前支持：

1. **账号 + 密码登录**；
2. **账号 + 密码注册**；
3. 注册成功后自动创建会话并进入 `/chat`。

账号规则：3-32 位字母、数字或下划线，服务端统一转小写；密码至少 8 位，使用 Argon2 哈希存储。

`/chat` 通过 `AuthGate` 调用 `/api/v1/auth/me` 校验登录态，未登录会跳回 `/?login=1` 并自动打开登录框；侧栏底部显示当前账号，点击后可在弹层中退出登录。

短信验证码已移除，微信扫码登录也已取消。拼图接口保留为可选防刷能力，但当前登录/注册不依赖它。

认证接口：

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/v1/auth/register` | 注册账号，创建会话 |
| POST | `/api/v1/auth/login` | 账号密码登录，创建会话 |
| GET | `/api/v1/auth/me` | 当前用户；未登录返回 401 |
| POST | `/api/v1/auth/logout` | 吊销会话并清除 Cookie |
| GET | `/api/v1/auth/captcha/challenge` | 可选：生成拼图 challenge |
| POST | `/api/v1/auth/captcha/verify` | 可选：校验拼图并返回 ticket |

数据存储：

- PostgreSQL 保存 `users`、`sessions`、`login_events`，应用启动时通过 SQLAlchemy `create_all` 自动建表；
- Redis 用于登录/注册限流；可选的拼图 challenge 和 ticket 也存 Redis；
- 会话使用 HttpOnly Cookie `rag_session`，默认 7 天；服务端只保存 token 哈希，退出时吊销。

首次使用前创建独立数据库（容器名、用户和已有数据库按实际环境替换）：

```bash
docker exec <postgres容器名> psql -U <用户名> -d <已有数据库> \
  -c "CREATE DATABASE rag_agent OWNER <用户名>;"
```

`.env` 需要配置：

```text
DATABASE_URL=postgresql+asyncpg://用户名:密码@127.0.0.1:5432/rag_agent
REDIS_URL=redis://:你的Redis密码@127.0.0.1:6379/0
AUTH_SECRET=随机十六进制字符串
AUTH_COOKIE_SECURE=false
AUTH_SESSION_TTL_S=604800
# 可选拼图参数
AUTH_CAPTCHA_TTL_S=180
AUTH_TICKET_TTL_S=120
AUTH_CAPTCHA_TOLERANCE_PX=5
```

`AUTH_COOKIE_SECURE` 本地 http 开发保持 `false`，生产 https 环境改为 `true`。`AUTH_SECRET` 供可选拼图功能使用，生产环境必须替换成随机值并妥善保管。

## 会话记忆与列表

会话按登录用户持久化到 PostgreSQL：

- `conversations`：会话标题、所属用户、创建/更新时间；
- `conversation_messages`：用户和助手消息、引用来源、工具调用、状态；
- `conversation_summaries`：滚动摘要、已总结水位线和更新时间。

行为：

- 侧栏“会话”区域按更新时间展示最近会话；
- 点击历史会话会加载对应消息；
- 会话项支持重命名和删除，删除会同时清理该会话的消息和摘要；
- 点击侧栏固定的“新聊天”（或聊天区“新对话”）清空当前视图，首次发送后创建新会话；
- 同一 `conversation_id` 的未总结消息最多带入 10 条；
- 达到 10 条时，较早消息会生成摘要并保存到 `conversation_summaries`，保留最近 6 条原文；
- 原始 `conversation_messages` 不会删除，前端仍能看到完整历史；
- 摘要只用于 Agent/直接回答的上下文，不会替换用户可见的消息；
- `POST /api/v1/chat` 和 `/api/v1/chat/stream` 现在都要求登录 Cookie；
- 流式接口会先返回一个 `conversation` 事件，包含新会话 ID 和标题。

摘要配置：

```text
SUMMARY_ENABLED=true
SUMMARY_MODEL=                 # 空表示复用 CHAT_MODEL
SUMMARY_TRIGGER_MESSAGES=10
SUMMARY_KEEP_MESSAGES=6
SUMMARY_MAX_CHARS=4000
SUMMARY_REQUEST_TIMEOUT_S=15
```

摘要失败或模型不可用时，会自动退化为最近 10 条原文上下文。

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/v1/conversations` | 当前用户的会话列表 |
| GET | `/api/v1/conversations/{id}` | 会话详情和消息 |
| PATCH | `/api/v1/conversations/{id}` | 重命名会话 |
| DELETE | `/api/v1/conversations/{id}` | 删除当前用户的会话 |

## 文档按用户隔离

上传文档时会把当前登录用户的 `user_id` 写入每个 chunk 的元数据。以下路径都按当前用户过滤：

- `GET /api/v1/documents`
- `POST /api/v1/documents`
- `DELETE /api/v1/documents/{id}`
- `POST /api/v1/retrieval/search`
- Agent 的 `search_knowledge_base` 工具

因此用户只能看到、检索和删除自己的文档；跨用户访问会返回 404 或空结果。`/documents` 和 `/retrieval/search` 现在也需要登录 Cookie。

检索服务的 `user_id` 现在是必填参数，不再保留“不传用户就查全库”的全局 BM25 兜底；无归属的历史片段也不会进入任何用户索引。

已有历史数据如果是在这次改造前入库的，chunk 没有 `user_id`，默认不会被任何用户检索到。需要执行一次归属迁移：

```bash
# 先预览
.venv/bin/python scripts/backfill_document_owner.py --username 你的账号 --dry-run

# 确认后写入
.venv/bin/python scripts/backfill_document_owner.py --username 你的账号
```

迁移会把这个 Chroma 集合里所有没有 `user_id` 的历史片段归属到指定账号。执行后重启后端，让 BM25 索引按新的元数据重建。

如果使用 Docker Compose，脚本已复制进 API 镜像，可以执行：

```bash
docker compose exec api python scripts/backfill_document_owner.py --username 你的账号
```

注意：目前是**用户级隔离**，同一用户的所有文档仍然共享；还没有组织、部门、角色和文档级 ACL。

## 混合检索与 Rerank

混合检索默认开启：向量召回 + BM25 关键词召回，用 RRF 融合后返回 `top_k`。BM25 索引从 Chroma 的 chunk 正文构建并保存在内存中；上传或删除文档后会自动失效，下次检索时重建。`HYBRID_ENABLED=false` 时退回纯向量检索。

BM25 只对 chunk 正文分词打分；`source`、`document_id`、`page`、`chunk_index` 等元数据用于来源展示、去重和后续过滤，不参与关键词打分。首次检索会初始化 jieba 并构建索引，之后直接使用内存索引。

```text
HYBRID_ENABLED=true
HYBRID_CANDIDATE_K=20
HYBRID_RRF_K=60
HYBRID_DENSE_WEIGHT=0.6
HYBRID_BM25_WEIGHT=0.4
```

`SourceItem.score` 的含义由 `score_type` 决定：`vector` 是距离（越小越好），`bm25` / `rrf` / `rerank` 是相关性分数（越大越好）。`score_type=rrf` 时 `score` 是 RRF 融合分（通常很小），原始向量距离和 BM25 分分别保留在 `vector_distance`、`bm25_score`；启用 Rerank 后 `score` 是重排分，并保留 `rerank_score`。

### Query 改写

检索前会先用 LLM 生成一个自包含查询和少量变体，原查询始终保留：

```text
QUERY_REWRITE_ENABLED=true
QUERY_REWRITE_MODEL=            # 空表示复用 CHAT_MODEL，建议配置更快的小模型
QUERY_REWRITE_MAX_VARIANTS=2
QUERY_REWRITE_MIN_CHARS=2
HYBRID_VARIANT_WEIGHT=0.5
```

- 原查询、standalone 和变体分别跑一遍向量 + BM25，再用 RRF 融合；
- 变体权重默认是原查询的一半，避免改写跑偏；
- 改写结果按规范化查询缓存，同一查询后续检索不会重复调用模型；
- 模型输出解析失败、超时或丢失数字/代码标识符时自动回退原查询；
- Query 改写会增加首次检索延迟。如果更在意响应速度，可以把 `QUERY_REWRITE_ENABLED=false`，或给 `QUERY_REWRITE_MODEL` 配置更小的模型。

Rerank 默认关闭，代码已接入 `RetrievalService`。开启前需要在百炼控制台开通 rerank 模型，安装可选依赖并配置：

```bash
pip install dashscope
```

```text
RERANK_ENABLED=true
RERANK_PROVIDER=dashscope
RERANK_MODEL=你的 rerank 模型名
DASHSCOPE_API_KEY=你的 key   # 不填则复用 OPENAI_API_KEY
RERANK_TOP_N=20
```

`RERANK_TOP_N` 是送入重排的候选数量，最终仍返回请求的 `top_k`（默认 `RETRIEVAL_TOP_K`）。如果使用本地模型而不是百炼接口：

```bash
pip install sentence-transformers
```

```text
RERANK_ENABLED=true
RERANK_PROVIDER=local
LOCAL_RERANK_MODEL=BAAI/bge-reranker-v2-m3
LOCAL_RERANK_DEVICE=
```

没有开通模型时保持 `RERANK_ENABLED=false`，不会发起任何 rerank 调用。重排失败会退回 RRF/向量顺序，此时 `score_type` 保持 `rrf` 或 `vector`，可以据此判断重排是否真正生效。多 worker 部署时每个进程各有一份内存 BM25 索引，生产环境建议换 SQLite FTS5、Qdrant 等共享索引。

## Agent 能力清单

当前服务是**单 Agent + 单工具**的知识库问答 Agent，核心实现在 `app/agents/rag_agent.py`，检索能力在 `app/services/retrieval.py`。

### 已支持

| 能力 | 当前状态 |
|---|---|
| Agent 工具调用循环 | 基于 LangChain 1.2 `create_agent`，模型可决定是否调用工具，并支持多轮工具循环 |
| 规则意图识别 | 识别寒暄、文档操作、知识库问答三类；寒暄直接回答不检索，文档操作返回资料库操作引导，其余默认知识库问答 |
| 知识库检索工具 | 只有 `search_knowledge_base(query)` 一个工具，固定返回 top 4 片段 |
| Query 改写 | 检索前用 LLM 生成自包含查询和最多 2 个变体，原查询保留；多路结果继续用 RRF 融合 |
| 混合检索 | 工具内部使用向量召回 + BM25 关键词召回 + RRF 融合，默认开启 |
| 证据约束回答 | System Prompt 要求只依据检索证据回答；证据不足要明确说明，不编造 |
| 文档内容防注入 | System Prompt 将检索到的文档视为不可信参考资料，不执行其中的指令 |
| 引用来源 | 工具以 `content_and_artifact` 返回结构化 sources，前端可展开查看原文片段 |
| 来源去重 | 多次工具调用产生的来源按 `document_id + chunk_index` 去重，最多返回 8 条 |
| 消除二次检索 | `ask` / `astream` 直接复用工具返回的 artifact，不再对原问题重新检索 |
| 会话记忆 | 会话和消息持久化到 PostgreSQL；达到 10 条后保存滚动摘要，保留最近 6 条原文 |
| 会话列表 | 侧栏按 `updated_at` 展示当前用户的历史会话，可切换或新建会话 |
| 会话管理 | 侧栏支持重命名和删除会话，删除后消息一并清理 |
| 文档按用户隔离 | 上传时写入 `user_id`；文档列表、检索、删除和 Agent 检索工具都按当前用户过滤 |
| 流式问答 | `/api/v1/chat/stream` 输出 `conversation`、`intent`、`token`、`tool_start`、`tool_end`、`sources`、`done`、`error` 事件 |
| 非流式问答 | `/api/v1/chat` 返回 `answer`、`sources`、`tool_calls`、`intent` |
| 工具调用记录 | 非流式接口返回模型实际发起的工具名和参数 |
| LangSmith 追踪 | 配置 `LANGSMITH_*` 后可查看 Agent 调用链路，属于可选观测能力 |
| Agent 接口鉴权 | `/chat`、`/chat/stream`、`/conversations` 需登录 Cookie |
| 登录保护前端工作台 | `/chat` 通过 `AuthGate` 校验会话；未登录跳回落地页并打开登录框 |

### 工具清单

```text
search_knowledge_base(query: str)
```

作用：检索已上传知识库中与问题相关的文档片段，返回 top 4 内容。文档上传、列表、删除是普通 REST 接口，不是 Agent 可调用的工具。

### 意图识别

当前使用规则识别，不额外调用模型：

| 意图 | 规则示例 | 处理 |
|---|---|---|
| `chitchat` | `你好`、`谢谢`、`你是谁`、`你能做什么` | 直接调用模型回答，不检索，sources 为空 |
| `document_action` | `上传文档`、`删除文档`、`文档列表`、`上传 PDF` | 返回左侧资料库页面的操作引导，不调用模型 |
| `knowledge` | 其他问题，包括规则未命中的问题 | 走当前 RAG Agent + 检索 |

规则意图识别的结果是默认 `knowledge`，避免误判导致知识库问题不走检索。当前没有单独的 `out_of_scope` 意图，超范围问题仍按知识库问答处理。

### 待实现或未启用

| 能力 | 当前状态 |
|---|---|
| Rerank 实际启用 | 代码已接入，但默认 `RERANK_ENABLED=false`，当前只到 RRF 融合 |
| Human-in-the-loop | 未实现；没有工具调用审批、批准/拒绝中断 |
| 多 Agent / 规划器 | 未实现；没有 supervisor、planner、子 Agent |
| Web 搜索、代码执行、MCP 工具 | 未实现；当前只有知识库检索工具 |
| 元数据过滤检索 | 未实现；Agent 只能传 query，不能指定文档、文件名或页码过滤 |
| 组织/租户级隔离 | 当前只到用户级；还没有组织、部门、角色和文档 ACL |
| 自定义工具轮次/成本预算 | 未实现；依赖框架默认行为，没有额外限制 |
| 内容审核与敏感信息处理 | 未实现；目前只有 System Prompt 约束 |

## 测试（curl）
按顺序执行，假设服务运行在 `http://127.0.0.1:8000`。注意 `chat`、`documents`、`retrieval/search` 是 POST，浏览器直接访问会得到 405。

`documents`、`retrieval/search`、`chat`、`chat/stream` 和会话接口都需要登录 Cookie。请先执行第 9 步注册（或第 10 步登录）生成 `cookies.txt`，再执行第 2、3、4、5、6、7、11 步。

```bash
# 1. 健康检查
curl http://127.0.0.1:8000/api/v1/health

# 2. 上传文档（需登录，返回 document_id）
curl -b cookies.txt -X POST http://127.0.0.1:8000/api/v1/documents \
  -F "file=@examples/sample.md"

# 3. 查看当前用户的已入库文档
curl -b cookies.txt http://127.0.0.1:8000/api/v1/documents

# 4. 在当前用户知识库中检索（score 的含义见 score_type）
curl -b cookies.txt -X POST http://127.0.0.1:8000/api/v1/retrieval/search \
  -H 'Content-Type: application/json' \
  -d '{"query":"RAG 的流程是什么","top_k":2}'

# 5. 提问（需先上传文档并登录；sources 来自 Agent 实际调用的检索工具）
curl -b cookies.txt -X POST http://127.0.0.1:8000/api/v1/chat \
  -H 'Content-Type: application/json' \
  -d '{"question":"根据知识库，RAG 的常见步骤有哪些？"}'

# 6. 删除当前用户的文档（替换 <document_id>，同时清理 uploads/ 中的原文件）
curl -b cookies.txt -X DELETE http://127.0.0.1:8000/api/v1/documents/<document_id>

# 7. 流式问答（SSE；需登录 Cookie，-N 关闭 curl 缓冲）
curl -N -b cookies.txt -X POST http://127.0.0.1:8000/api/v1/chat/stream \
  -H 'Content-Type: application/json' \
  -d '{"question":"根据知识库，RAG 的常见步骤有哪些？"}'

# 8. 查看登录状态（未登录返回 401）
curl -i http://127.0.0.1:8000/api/v1/auth/me

# 9. 注册并保存 Cookie，然后查看当前用户
curl -c cookies.txt -X POST http://127.0.0.1:8000/api/v1/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"username":"demo_user","password":"demo-password-123"}'
curl -b cookies.txt http://127.0.0.1:8000/api/v1/auth/me

# 10. 登录
curl -c cookies.txt -X POST http://127.0.0.1:8000/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"demo_user","password":"demo-password-123"}'

# 11. 查看会话列表（需登录 Cookie）
curl -b cookies.txt http://127.0.0.1:8000/api/v1/conversations
```

流式接口每行是一个 `data: <JSON>` 事件，`type` 依次可能为 `token`（增量文本）、`tool_start` / `tool_end`（工具调用）、`sources`（引用来源）、`done`（结束）；出错时返回 `error` 事件。

`sources` 来自 Agent 实际调用的检索工具返回的 artifact，工具检索一次后直接复用，不会再用原问题做第二次检索；多次工具调用会按 `document_id + chunk_index` 去重，最多保留 8 条。Agent 没有调用检索工具时，`sources` 为空。非流式接口 `POST /api/v1/chat` 路径不变，`sources` 字段包含同样的分数信息。

也可以在 Swagger UI（http://127.0.0.1:8000/docs）中逐个接口调试。

## Agent Skill（Claude Code / Codex）

项目内置两份内容相同的 Skill，用于调用本地 `/api/v1/chat` 查询知识库：

- `.claude/skills/rag-agent-query/`：Claude Code 项目级 Skill，会被自动发现；
- `skills/rag-agent-query/`：可迁移副本，附带 README，说明如何复制到 Codex 的 skills 目录，或在 `AGENTS.md` 中调用。

```bash
export RAG_AGENT_USERNAME="你的账号"
export RAG_AGENT_PASSWORD="你的密码"

# Claude Code
python3 .claude/skills/rag-agent-query/scripts/query.py "根据知识库，RAG 的常见步骤有哪些？"

# 可迁移副本
python3 skills/rag-agent-query/scripts/query.py "根据知识库，RAG 的常见步骤有哪些？"
```

- FastAPI 需运行在 `http://127.0.0.1:8000`，可用 `RAG_AGENT_BASE_URL` 覆盖；
- 可选 `--conversation-id` 继续同一会话，`--json` 输出原始响应；
- 在 Claude Code 中可以直接用 `/rag-agent-query` 调用，或直接提出需要查知识库的问题；
- 脚本只使用 Python 标准库，不会保存或打印账号密码。

## 查看知识库内容

`uploads/` 里是上传的原始文件，知识库实际存储的是切分后的片段和向量，位于 `data/chroma/chroma.sqlite3`。以下命令都在项目根目录执行。

```bash
# 1. 查看当前用户的文档列表和片段数（不返回正文）
curl -s -b cookies.txt http://127.0.0.1:8000/api/v1/documents | python3 -m json.tool

# 2. 运维调试：直接导出 Chroma 全部片段（绕过用户过滤，仅限本机调试）
.venv/bin/python - <<'EOF'
from app.dependencies import get_vector_store

vs = get_vector_store()
data = vs.get(include=["documents", "metadatas"])

print(f"共 {len(data['ids'])} 个片段\n")
for chunk_id, text, meta in zip(data["ids"], data["documents"], data["metadatas"]):
    meta = meta or {}
    print("=" * 60)
    print("chunk     :", chunk_id)
    print("source    :", meta.get("source"))
    print("user_id   :", meta.get("user_id"))
    print("document  :", meta.get("document_id"))
    print("chunk_idx :", meta.get("chunk_index"))
    print("-" * 60)
    print(text)
    print()
EOF

# 3. 查看单篇文档的全部片段（document_id 从第 1 步获取）
.venv/bin/python - <<'EOF'
from app.dependencies import get_vector_store

DOCUMENT_ID = "把这里换成 document_id"
vs = get_vector_store()
data = vs.get(where={"document_id": DOCUMENT_ID}, include=["documents", "metadatas"])

for chunk_id, text in zip(data["ids"], data["documents"]):
    print("=" * 60)
    print(chunk_id)
    print(text)
EOF

# 4. 用检索接口查看当前用户命中的片段
curl -s -b cookies.txt -X POST http://127.0.0.1:8000/api/v1/retrieval/search \
  -H 'Content-Type: application/json' \
  -d '{"query":"学习计划","top_k":5}' | python3 -m json.tool

# 5. 检查 uploads/ 里没有入库的文件
.venv/bin/python - <<'EOF'
from pathlib import Path
from app.dependencies import get_vector_store

vs = get_vector_store()
raw = vs.get(include=["metadatas"])
indexed = {str((m or {}).get("document_id")) for m in (raw.get("metadatas") or [])}

for path in sorted(Path("uploads").iterdir()):
    document_id = path.name.split("_", 1)[0]
    if document_id not in indexed:
        print("未入库:", path)
EOF
```

说明：

- `get_vector_store()` 读取 `.env` 里的 `CHROMA_PERSIST_DIR` 和 `CHROMA_COLLECTION`，打开的就是后端正在使用的同一个库；这些读取操作是只读的。
- 上面的 Python 脚本直接读 Chroma，不经过 API 的用户过滤，能看到所有用户的数据，只建议运维/调试时使用；业务接口会按 `user_id` 隔离。
- 库很大时可以用 `vs.get(..., limit=200, offset=0)` 分页读取，避免一次加载全部片段。
- 也可以直接用 DB Browser for SQLite / PyCharm 数据库工具打开 `data/chroma/chroma.sqlite3`，但文本和向量分表存储，用上面的 Python 接口更直观。
- 重置整个知识库：停止后端，删除 `data/chroma/`，再重新上传文档。

## 目录
```text
rag-agent/
├── app/
│   ├── main.py
│   ├── schemas.py
│   ├── dependencies.py
│   ├── core/config.py
│   ├── core/database.py
│   ├── core/redis_client.py
│   ├── api/routes.py
│   ├── auth/
│   │   ├── router.py
│   │   ├── models.py
│   │   ├── schemas.py
│   │   ├── security.py
│   │   └── captcha.py
│   ├── conversations/
│   │   ├── router.py
│   │   ├── models.py
│   │   ├── schemas.py
│   │   └── service.py
│   ├── services/ingestion.py
│   ├── services/retrieval.py
│   ├── services/query_rewrite.py
│   ├── services/summarization.py
│   ├── services/bm25_index.py
│   ├── services/fusion.py
│   ├── services/rerank.py
│   └── agents/rag_agent.py
├── examples/sample.md
├── scripts/           # 历史数据迁移脚本
├── front/             # Next.js 16 + Tailwind CSS 前端
│   ├── Dockerfile
│   ├── app/page.tsx   # 落地页
│   ├── app/chat/      # 聊天工作台
│   └── public/images/ # 落地页背景图
├── Dockerfile         # FastAPI 镜像
├── docker-compose.yml # API + Web + Postgres + Redis
├── .dockerignore
├── data/chroma/       # 运行后生成
├── uploads/           # 运行后生成
├── .env.example
└── requirements.txt
```

## 说明
- LangChain 1.x 使用 `create_agent` 和 `@tool`，不是旧版 `initialize_agent`。
- Chroma 使用本地持久化目录；适合学习和本地原型。生产环境可改用 Chroma Server 或 Milvus。
- 聊天模型必须支持 tool calling；Embedding API 必须支持 embeddings。
- 混合检索依赖 `rank-bm25` 和 `jieba`，已包含在 `requirements.txt`；Rerank 的 `dashscope` / `sentence-transformers` 是可选依赖。
- 认证依赖 `sqlalchemy[asyncio]`、`asyncpg`、`redis[hiredis]` 和 `argon2-cffi`；可选拼图功能额外使用 `pillow`。Postgres 表在应用启动时通过 `Base.metadata.create_all` 创建，生产环境建议改用 Alembic 迁移。
- 已支持账号密码注册/登录，`/chat` 通过 `AuthGate` 校验登录态；短信验证码和微信登录未实现，也不需要它们才能登录。
- 会话和消息持久化到 PostgreSQL；侧栏展示当前用户的会话列表。消息达到 10 条后保存滚动摘要，Agent 使用“摘要 + 最近 6 条原文”，原始消息不删除。
- 文档按用户隔离：每个 chunk 带 `user_id`，文档列表、检索、删除和 Agent 工具都只访问当前用户的数据；目前还没有组织/租户级隔离。
- 修改 `HYBRID_*`、`QUERY_REWRITE_*`、`SUMMARY_*`、`RERANK_*` 或认证相关配置后需要重启后端，因为 `Settings`、`RetrievalService` 和数据库/Redis 连接都有进程内缓存。
- Query 改写会增加一次 LLM 调用；结果按查询缓存，首次检索可能多等几秒。可配置更小的 `QUERY_REWRITE_MODEL` 或关闭 `QUERY_REWRITE_ENABLED`。
- 会话摘要达到阈值时增加一次摘要模型调用；失败或超时会自动回退到最近 10 条原文。可配置更小的 `SUMMARY_MODEL` 或关闭 `SUMMARY_ENABLED`。
- 切换 embedding 模型或向量维度后，需要清理并重新建立 Chroma 索引。
- 当前适配阿里百炼（DashScope 兼容模式）：embedding 接口只接受字符串输入，且单请求批量上限随文本长度收紧（长文本约 20 条），代码中已设置 `check_embedding_ctx_length=False` 与 `chunk_size=10`。
- 扫描版 PDF 需要 OCR；本项目只解析有文本层的 PDF。
- 教学版已包含账号密码认证、基础限流和用户级文档隔离；尚未包含组织/租户隔离、角色权限、恶意文件扫描、异步入库、生产级审计/监控等。公网部署前请补齐。
