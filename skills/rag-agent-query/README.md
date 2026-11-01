# RAG Agent Query Skill（可迁移版）

这个目录是一份自包含的 Agent Skill：

```text
skills/rag-agent-query/
├── SKILL.md          # skill 说明，YAML frontmatter + Markdown
├── README.md
└── scripts/
    └── query.py      # 只依赖 Python 标准库
```

它和 `.claude/skills/rag-agent-query/` 内容相同，区别只是脚本相对路径不同，方便复制到其他 Agent 工具。

## 迁移到 Codex

Codex 不同版本对 skills 目录的支持不一样，可以按下面两种方式使用：

1. **支持 skills 目录时**：把整个 `rag-agent-query` 目录复制到 Codex 对应的 skills 位置，例如用户级 `~/.codex/skills/`，或项目级 `.codex/skills/`（以你使用的 Codex 版本为准）。
2. **不支持自动发现时**：在项目的 `AGENTS.md` 里加一段说明，让 Codex 遇到知识库问题时调用脚本：

   ```markdown
   ## 本地 RAG 知识库

   当问题需要基于已上传文档回答时，在项目根目录执行：

   ```bash
   python3 skills/rag-agent-query/scripts/query.py "用户的问题"
   ```

   需要设置 `RAG_AGENT_USERNAME`、`RAG_AGENT_PASSWORD`；
   可选 `RAG_AGENT_BASE_URL`，默认 http://127.0.0.1:8000。
   缺少凭据时不要猜测，先询问用户。
   ```

## 使用

```bash
export RAG_AGENT_USERNAME="你的账号"
export RAG_AGENT_PASSWORD="你的密码"

python3 skills/rag-agent-query/scripts/query.py "根据知识库，RAG 的常见步骤有哪些？"
```

可选参数：

| 参数 | 作用 |
|---|---|
| `--conversation-id <id>` | 继续同一个会话 |
| `--json` | 输出原始 JSON 响应 |
| `--base-url <url>` | 覆盖 API 地址 |

## 说明

- 需要 FastAPI 正在运行，默认 `http://127.0.0.1:8000`；
- 脚本调用 `/api/v1/auth/login` 登录，再调用 `/api/v1/chat`；
- 不会保存或打印密码，账号会话只存在于本次进程的内存 Cookie 中；
- 适合查询知识库，不建议用于普通闲聊，因为每次都会调用聊天模型。
