import json
import re
import unicodedata
from functools import lru_cache
from typing import Protocol

SYSTEM_PROMPT = (
    "你是知识库检索的 Query 改写器。只输出 JSON 对象，不要输出 Markdown、解释或额外文本。"
    "根据用户问题生成：\n"
    "1. standalone：一个自包含的检索查询；\n"
    "2. variants：最多 {max_variants} 个语义等价或更具体的检索查询。\n"
    "不要回答问题，不要编造事实；保留专有名词、数字、代码标识符和版本号。\n"
    '输出格式：{{"standalone":"...","variants":["..."]}}'
)

CRITICAL_TOKEN_RE = re.compile(r"[A-Za-z0-9_./:+-]{2,}")
MAX_QUERY_CHARS = 300


class ChatModelLike(Protocol):
    """Query 改写所需的最小聊天模型接口。"""

    def invoke(self, input):
        """调用聊天模型并返回带 content 的响应。"""
        ...


class QueryRewriter(Protocol):
    """Query 改写器协议。"""

    enabled: bool

    def rewrite(self, query: str) -> list[str]:
        """返回用于检索的查询列表。"""
        ...


def normalize_query(query: str) -> str:
    """做 NFKC 和空白规范化。"""
    normalized = unicodedata.normalize("NFKC", query or "")
    return " ".join(normalized.split()).strip()


def _content_text(content) -> str:
    """把模型内容块统一成文本。"""
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        return "".join(
            block.get("text", "")
            for block in content
            if isinstance(block, dict) and block.get("type") == "text"
        )
    return ""


def _parse_json_object(text: str) -> dict | None:
    """从可能带 Markdown 围栏的响应中解析 JSON 对象。"""
    stripped = text.strip()
    if stripped.startswith("```"):
        stripped = re.sub(r"^```(?:json)?\s*", "", stripped)
        stripped = re.sub(r"\s*```$", "", stripped)
    try:
        data = json.loads(stripped)
        return data if isinstance(data, dict) else None
    except json.JSONDecodeError:
        start = stripped.find("{")
        end = stripped.rfind("}")
        if start == -1 or end <= start:
            return None
        try:
            data = json.loads(stripped[start : end + 1])
            return data if isinstance(data, dict) else None
        except json.JSONDecodeError:
            return None


def _preserves_critical_tokens(candidate: str, query: str) -> bool:
    """检查变体是否保留原查询中的代码/数字标识。"""
    critical = CRITICAL_TOKEN_RE.findall(query)[:8]
    lowered = candidate.lower()
    return all(token.lower() in lowered for token in critical)


def _dedupe(queries: list[str]) -> list[str]:
    """规范化、过滤并去重查询候选。"""
    seen: set[str] = set()
    result: list[str] = []
    for query in queries:
        normalized = normalize_query(query)
        key = normalized.lower()
        if not normalized or len(normalized) > MAX_QUERY_CHARS or key in seen:
            continue
        seen.add(key)
        result.append(normalized)
    return result


class NoopQueryRewriter:
    """关闭改写时的透传实现。"""
    enabled = False

    def rewrite(self, query: str) -> list[str]:
        """返回规范化后的原查询。"""
        return [normalize_query(query)]


class LlmQueryRewriter:
    """用 LLM 生成自包含查询和变体，并做缓存/校验。"""
    enabled = True

    def __init__(
        self,
        model: ChatModelLike,
        max_variants: int = 2,
        min_chars: int = 2,
    ):
        """保存模型、变体数量和最小长度配置。"""
        self.model = model
        self.max_variants = max(0, min(max_variants, 4))
        self.min_chars = max(1, min_chars)

    def rewrite(self, query: str) -> list[str]:
        """返回原查询和通过校验的改写查询。"""
        normalized = normalize_query(query)
        if len(normalized) < self.min_chars or len(normalized) > MAX_QUERY_CHARS:
            return [normalized]
        return list(self._rewrite_cached(normalized))

    @lru_cache(maxsize=256)
    def _rewrite_cached(self, query: str) -> tuple[str, ...]:
        """调用模型生成并缓存改写结果。"""
        try:
            response = self.model.invoke(
                [
                    {
                        "role": "system",
                        "content": SYSTEM_PROMPT.format(
                            max_variants=self.max_variants
                        ),
                    },
                    {"role": "user", "content": query},
                ]
            )
            data = _parse_json_object(_content_text(response.content))
        except Exception:
            return (query,)

        if not data:
            return (query,)

        standalone = data.get("standalone")
        variants = data.get("variants")
        candidates: list[str] = []

        if isinstance(standalone, str):
            candidates.append(standalone)
        if isinstance(variants, list):
            candidates.extend(item for item in variants if isinstance(item, str))

        accepted = []
        for candidate in candidates:
            # 变体校验
            if not _preserves_critical_tokens(candidate, query):
                continue
            accepted.append(candidate)
            if len(accepted) >= self.max_variants + 1:
                break

        return tuple(_dedupe([query, *accepted]))
