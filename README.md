# RAG Agent — FastAPI + LangChain 1.2 + Chroma

一个最小完整的 RAG Agent 后端：文档上传、解析、切分、Embedding、Chroma 持久化、向量检索、Agent 工具调用、来源返回、文档列表与删除。另附 Next.js + Tailwind CSS 前端（`front/`），也可以直接通过 Swagger UI 调试。

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

## 前端
```bash
cd front
npm install
npm run dev
```
打开 http://localhost:3000 。前端对接 `chat/stream` 流式接口，支持文档上传删除、引用来源、停止生成和移动端布局，详细说明见 [front/README.md](front/README.md)。

跨域由根目录 `.env` 的 `CORS_ORIGINS` 控制，默认允许 `http://localhost:3000` 和 `http://127.0.0.1:3000`。前端换端口时需要同步修改并重启后端。

## 测试（curl）
按顺序执行，假设服务运行在 `http://127.0.0.1:8000`。注意 `chat`、`documents`、`retrieval/search` 是 POST，浏览器直接访问会得到 405。

```bash
# 1. 健康检查
curl http://127.0.0.1:8000/api/v1/health

# 2. 上传文档（从项目根目录执行，返回 document_id）
curl -X POST http://127.0.0.1:8000/api/v1/documents \
  -F "file=@examples/sample.md"

# 3. 查看已入库文档
curl http://127.0.0.1:8000/api/v1/documents

# 4. 检索（返回相关片段和距离分数）
curl -X POST http://127.0.0.1:8000/api/v1/retrieval/search \
  -H 'Content-Type: application/json' \
  -d '{"query":"RAG 的流程是什么","top_k":2}'

# 5. 提问（需先上传文档，sources 才有内容）
# 模型要检索时返回 status=interrupted、thread_id 和 interrupt.action_requests
curl -X POST http://127.0.0.1:8000/api/v1/chat \
  -H 'Content-Type: application/json' \
  -d '{"question":"根据知识库，RAG 的常见步骤有哪些？","memory":false}' | python3 -m json.tool

# 5.1 允许检索（decisions 数量必须等于 action_requests 的数量）
curl -X POST http://127.0.0.1:8000/api/v1/chat/resume \
  -H 'Content-Type: application/json' \
  -d '{"thread_id":"<thread_id>","memory":false,"decisions":[{"type":"approve"},{"type":"approve"}]}' | python3 -m json.tool

# 拒绝检索：把 decision 换成 {"type":"reject","message":"用户拒绝检索"}

# 6. 删除文档（把 <document_id> 替换为第 2 步返回的 ID，同时清理 uploads/ 中的原文件）
curl -X DELETE http://127.0.0.1:8000/api/v1/documents/<document_id>

# 7. 流式问答（SSE；-N 关闭 curl 缓冲）
curl -N -X POST http://127.0.0.1:8000/api/v1/chat/stream \
  -H 'Content-Type: application/json' \
  -d '{"question":"根据知识库，RAG 的常见步骤有哪些？","memory":false}'

# 7.1 从流中拿到 thread_id 和 interrupt 后，确认并继续流式输出
curl -N -X POST http://127.0.0.1:8000/api/v1/chat/stream/resume \
  -H 'Content-Type: application/json' \
  -d '{"thread_id":"<thread_id>","memory":false,"decisions":[{"type":"approve"}]}'
```

流式接口每行是一个 `data: <JSON>` 事件，`type` 可能为 `thread`（有效 thread_id）、`token`（增量文本）、`tool_start` / `tool_end`（工具调用）、`interrupt`（等待人工确认，流结束）、`sources`（引用来源）、`done`（结束）或 `error`。收到 `interrupt` 后不要等待 `done`，而是用同一个 `thread_id` 调用 resume 接口继续。

也可以在 Swagger UI（http://127.0.0.1:8000/docs）中逐个接口调试。

## 人工确认与会话记忆

`search_knowledge_base` 工具通过 `HumanInTheLoopMiddleware` 拦截，模型发起检索时会先暂停，等待人工决定：

- **中断时**：非流式返回 `status: "interrupted"`、`thread_id` 和 `interrupt`（包含 `action_requests` 与 `review_configs`）；流式返回 `interrupt` 事件。此时工具尚未执行。
- **允许/拒绝**：调用 `/api/v1/chat/resume` 或 `/api/v1/chat/stream/resume`，用同一个 `thread_id` 提交 `decisions`。`decisions` 的数量必须等于 `action_requests` 的数量；`reject` 可以附带 `message` 说明原因。
- **多轮中断**：一次 AI 消息里可能同时请求多个检索（多个 `action_requests`）；恢复后模型也可能再次请求检索，前端会再次显示确认卡片。

会话状态保存在 `data/checkpoints.sqlite`（可用 `.env` 的 `CHECKPOINT_DB` 修改路径）：

- `memory: false`（默认）：每个问题使用新的 `ephemeral-<uuid>` 线程，回答或拒绝完成后立即删除对应 checkpoint；服务启动时也会清理遗留的 `ephemeral-` 线程，避免长期堆积。
- `memory: true`：沿用请求里的 `thread_id`，模型能看到该线程的历史消息；线程会一直保留，适合需要上下文的对话。
- 前端输入框上方有「启用会话记忆」开关，默认关闭。关闭时每次提问独立；开启后同一对话复用 thread_id，点击「新对话」会开始新线程。切换开关会从下一条消息开始使用新的会话。
- `sources` 只在检索工具真正执行后返回；如果模型没有调用工具或用户拒绝了检索，`sources` 为空。

## 查看知识库内容

`uploads/` 里是上传的原始文件，知识库实际存储的是切分后的片段和向量，位于 `data/chroma/chroma.sqlite3`。以下命令都在项目根目录执行。

```bash
# 1. 查看文档列表和片段数（不返回正文）
curl -s http://127.0.0.1:8000/api/v1/documents | python3 -m json.tool

# 2. 导出知识库全部片段
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

# 4. 用检索接口查看命中的片段（score 是向量距离，越小越相似）
curl -s -X POST http://127.0.0.1:8000/api/v1/retrieval/search \
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
│   ├── api/routes.py
│   ├── services/ingestion.py
│   ├── services/retrieval.py
│   └── agents/rag_agent.py
├── examples/sample.md
├── front/             # Next.js 16 + Tailwind CSS 前端
├── data/chroma/       # 运行后生成
├── data/checkpoints.sqlite  # 运行后生成，SQLite 会话记忆与待确认状态
├── uploads/           # 运行后生成
├── .env.example
└── requirements.txt
```

## 说明
- LangChain 1.x 使用 `create_agent` 和 `@tool`，不是旧版 `initialize_agent`。
- Chroma 使用本地持久化目录；适合学习和本地原型。生产环境可改用 Chroma Server 或 Milvus。
- 聊天模型必须支持 tool calling；Embedding API 必须支持 embeddings。
- 切换 embedding 模型或向量维度后，需要清理并重新建立 Chroma 索引。
- 当前适配阿里百炼（DashScope 兼容模式）：embedding 接口只接受字符串输入，且单请求批量上限随文本长度收紧（长文本约 20 条），代码中已设置 `check_embedding_ctx_length=False` 与 `chunk_size=10`。
- 启动时会自动加载根目录的 `.env`；配置 `LANGSMITH_TRACING`、`LANGSMITH_API_KEY`、`LANGSMITH_PROJECT` 后，LangChain 调用会自动上报到 LangSmith。
- 扫描版 PDF 需要 OCR；本项目只解析有文本层的 PDF。
- 教学版尚未包含鉴权、租户隔离、限流、恶意文件扫描、异步入库、生产级日志与监控。公网部署前请补齐。
