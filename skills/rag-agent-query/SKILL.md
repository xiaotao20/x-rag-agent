---
name: rag-agent-query
description: 通过本地 FastAPI 的 /api/v1/chat 接口查询本项目的 RAG 知识库。当用户的问题需要基于已上传文档回答，或明确要求查询 RAG 服务时使用。
---

# 查询本地 RAG 知识库

调用本目录下的 `scripts/query.py`：用账号登录后请求非流式的 `POST /api/v1/chat`，输出回答和引用来源。

## 前置条件

- API 正在运行，默认地址 `http://127.0.0.1:8000`：
  ```bash
  curl -s http://127.0.0.1:8000/api/v1/health
  ```
- 已注册账号。凭据通过环境变量提供，不要写入仓库，也不要把密码放在命令行参数里：
  ```bash
  export RAG_AGENT_USERNAME="你的账号"
  export RAG_AGENT_PASSWORD="你的密码"
  ```
- 可选：`RAG_AGENT_BASE_URL`（默认 `http://127.0.0.1:8000`）。

缺少凭据时，告诉用户需要设置哪些环境变量并停止；不要猜测、创建或复用其他账号。

## 用法

在项目根目录执行：

```bash
python3 skills/rag-agent-query/scripts/query.py "根据知识库，RAG 的常见步骤有哪些？"
```

继续同一会话：

```bash
python3 skills/rag-agent-query/scripts/query.py --conversation-id "<id>" "再详细说说第二步"
```

输出原始 JSON（包含回答、来源、工具调用、意图和会话 ID）：

```bash
python3 skills/rag-agent-query/scripts/query.py --json "文档里有哪些关键概念？"
```

参数：`--base-url`、`--conversation-id`、`--json`。

## 结果怎么汇报

- 把回答正文返回给用户；
- 有引用来源时，说明文件名和片段序号；
- 如果 `intent` 是 `document_action`，返回的是操作引导而不是知识回答，要如实说明；
- 401 表示账号或密码错误；连接失败表示服务未启动。报告具体错误，不要更换凭据重试。

该 Skill 会消耗已配置的聊天模型，只用于需要查询知识库的问题，不要用于普通闲聊。
