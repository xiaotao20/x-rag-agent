#!/usr/bin/env python3
"""通过 chat 接口查询本地 RAG Agent 知识库。"""

from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.error
import urllib.request
from http.cookiejar import CookieJar

DEFAULT_BASE_URL = "http://127.0.0.1:8000"
REQUEST_TIMEOUT_S = 180


def request_json(opener, url: str, payload: dict | None = None) -> dict:
    """发送 JSON 请求并返回解析后的响应。"""
    data = json.dumps(payload).encode("utf-8") if payload is not None else None
    headers = {"Accept": "application/json"}
    if data is not None:
        headers["Content-Type"] = "application/json"
    request = urllib.request.Request(
        url, data=data, headers=headers, method="POST" if data is not None else "GET"
    )
    try:
        with opener.open(request, timeout=REQUEST_TIMEOUT_S) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        try:
            detail = json.loads(body).get("detail", body)
        except json.JSONDecodeError:
            detail = body
        raise SystemExit(f"HTTP {exc.code}: {detail}") from exc
    except urllib.error.URLError as exc:
        raise SystemExit(
            f"无法连接 RAG 服务：{exc.reason}。请确认 FastAPI 已启动。"
        ) from exc


def print_sources(sources: list[dict]) -> None:
    """以紧凑易读的格式打印引用来源。"""
    if not sources:
        return
    print("\n引用来源：")
    for index, source in enumerate(sources, start=1):
        name = source.get("source") or "unknown"
        chunk = source.get("chunk_index", "?")
        score_type = source.get("score_type") or "score"
        score = source.get("score")
        score_text = f"，{score_type}={score:.4f}" if isinstance(score, (int, float)) else ""
        print(f"{index}. {name}（片段 {chunk}{score_text}）")


def main() -> None:
    """登录后调用 /api/v1/chat 并输出结果。"""
    parser = argparse.ArgumentParser(
        description="通过 /api/v1/chat 查询本地 RAG Agent 知识库。"
    )
    parser.add_argument("question", nargs="+", help="要向知识库提出的问题。")
    parser.add_argument(
        "--base-url",
        default=os.environ.get("RAG_AGENT_BASE_URL", DEFAULT_BASE_URL),
        help=f"API 基础地址（默认：{DEFAULT_BASE_URL}）。",
    )
    parser.add_argument(
        "--conversation-id",
        default=os.environ.get("RAG_AGENT_CONVERSATION_ID"),
        help="继续已有的会话。",
    )
    parser.add_argument(
        "--json",
        action="store_true",
        help="输出原始 JSON 响应，而不是格式化文本。",
    )
    args = parser.parse_args()

    username = os.environ.get("RAG_AGENT_USERNAME")
    password = os.environ.get("RAG_AGENT_PASSWORD")
    if not username or not password:
        raise SystemExit(
            "缺少账号凭据。请先设置：\n"
            '  export RAG_AGENT_USERNAME="你的账号"\n'
            '  export RAG_AGENT_PASSWORD="你的密码"'
        )

    base_url = args.base_url.rstrip("/")
    question = " ".join(args.question).strip()
    if not question:
        raise SystemExit("问题不能为空。")

    opener = urllib.request.build_opener(
        urllib.request.HTTPCookieProcessor(CookieJar())
    )

    request_json(
        opener,
        f"{base_url}/api/v1/auth/login",
        {"username": username, "password": password},
    )

    payload: dict = {"question": question}
    if args.conversation_id:
        payload["conversation_id"] = args.conversation_id
    result = request_json(opener, f"{base_url}/api/v1/chat", payload)

    if args.json:
        print(json.dumps(result, ensure_ascii=False, indent=2))
        return

    print(result.get("answer") or "模型没有返回文本答案。")
    print_sources(result.get("sources") or [])

    conversation_id = result.get("conversation_id")
    intent = result.get("intent")
    if conversation_id or intent:
        print()
        if intent:
            print(f"意图：{intent}")
        if conversation_id:
            print(f"conversation_id：{conversation_id}")


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        sys.exit(130)
