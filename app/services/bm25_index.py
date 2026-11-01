import logging
import re
import threading
from dataclasses import dataclass

import jieba
from rank_bm25 import BM25Plus

TECH_TERMS = (
    "rag", "langchain", "langgraph", "chroma", "embedding", "embeddings",
    "vectorstore", "bm25", "rerank", "reranker", "llm", "llms", "prompt",
    "chunk", "chunks", "token", "tokens", "agent", "agents", "mcp", "fastapi",
    "nextjs", "tailwind", "docker", "redis", "sqlite", "api", "sse", "json",
    "yaml", "python", "javascript", "typescript", "nodejs", "openai",
    "dashscope", "百炼", "阿里百炼", "通义千问", "千问", "知识库", "向量检索",
    "混合检索", "关键词检索", "语义检索", "召回", "重排", "精排", "切片",
    "分块", "嵌入", "向量", "索引", "会话记忆", "中间件", "流式输出",
    "提示词", "大模型", "模型", "智能体", "工具调用", "函数调用",
    "检索增强生成", "文档", "片段", "来源", "引用", "元数据", "缓存", "命中",
    "延迟", "吞吐", "并发", "容器", "部署", "接口", "参数", "配置",
)

STOPWORDS = {
    "的", "了", "是", "在", "和", "与", "及", "或", "而", "被", "把", "对",
    "从", "到", "为", "以", "于", "中", "上", "下", "这", "那", "其", "之",
    "吗", "呢", "吧", "啊", "呀", "请问", "什么", "怎么", "如何", "哪些",
    "哪个", "为什么", "是否", "可以", "需要", "一个", "一下", "我们", "你们",
    "他们", "它", "有",
    "the", "a", "an", "and", "or", "of", "to", "in", "on", "for", "with",
    "is", "are", "was", "were", "be", "been", "being", "this", "that",
    "these", "those", "it", "its", "as", "at", "by", "from", "how", "what",
    "which", "who", "whom", "whose", "why", "when", "where", "can", "could",
    "should", "would", "do", "does", "did", "not", "no", "yes",
}

_ASCII_TOKEN_RE = re.compile(r"[a-zA-Z0-9_./:+-]+")
_IDENTIFIER_RE = re.compile(r"[a-zA-Z][a-zA-Z0-9_./:+-]*")
_WORD_RE = re.compile(r"[a-zA-Z0-9一-鿿]")
_SPLIT_RE = re.compile(r"[_./:+-]+")

_jieba_lock = threading.Lock()
_jieba_ready = False


def _ensure_jieba_ready() -> None:
    """懒加载 jieba 并注册技术词。"""
    global _jieba_ready
    if _jieba_ready:
        return
    with _jieba_lock:
        if _jieba_ready:
            return
        jieba.setLogLevel(logging.ERROR)
        jieba.initialize()
        for term in TECH_TERMS:
            jieba.add_word(term)
        _jieba_ready = True


def tokenize(text: str) -> list[str]:
    """中英文混合分词，保留代码标识符。"""
    _ensure_jieba_ready()
    text = (text or "").lower()
    tokens: list[str] = []
    for raw in jieba.lcut_for_search(text):
        token = raw.strip()
        if not token or token in STOPWORDS or not _WORD_RE.search(token):
            continue
        tokens.append(token)
        if _ASCII_TOKEN_RE.fullmatch(token):
            parts = [part for part in _SPLIT_RE.split(token) if part and part not in STOPWORDS]
            if len(parts) > 1:
                tokens.extend(parts)

    # jieba 会把 search_knowledge_base 拆成多段，额外保留完整标识符用于精确命中。
    # 上面部分会把带./_等有符号的才分成多段，导致完整的缺少，需要把完整的加入
    seen_identifiers: set[str] = set()
    for identifier in _IDENTIFIER_RE.findall(text):
        if identifier in STOPWORDS or identifier in seen_identifiers:
            continue
        if any(sep in identifier for sep in "_./:+-"):
            seen_identifiers.add(identifier)
            tokens.append(identifier)
    return tokens


@dataclass(frozen=True)
class BM25Hit:
    """BM25 命中的片段和分数。"""
    chunk_id: str
    content: str
    metadata: dict
    score: float


class BM25Index:
    """线程安全的内存 BM25 索引，只维护按用户隔离的语料。"""

    def __init__(self):
        """初始化索引锁和空索引。"""
        self._lock = threading.RLock()
        self._entry_count = 0
        self._user_indexes: dict[
            str, tuple[BM25Plus, list[tuple[str, str, dict]], list[set[str]]]
        ] = {}

    def rebuild(self, ids: list[str], contents: list[str], metadatas: list[dict]) -> None:
        """用 chunk 正文重建按用户分组的索引，跳过无归属和无有效词项的片段。"""
        tokenized_by_user: dict[str, list[list[str]]] = {}
        entries_by_user: dict[str, list[tuple[str, str, dict]]] = {}

        for chunk_id, content, metadata in zip(ids, contents, metadatas):
            tokens = tokenize(content)
            if not tokens:
                continue
            metadata = dict(metadata or {})
            user_key = str(metadata.get("user_id") or "")
            if not user_key:
                # 无归属片段不进入任何用户索引，避免绕过用户隔离。
                continue
            tokenized_by_user.setdefault(user_key, []).append(tokens)
            entries_by_user.setdefault(user_key, []).append(
                (str(chunk_id), content, metadata)
            )

        with self._lock:
            self._user_indexes = {
                user_key: (
                    BM25Plus(user_tokens),
                    entries_by_user[user_key],
                    [set(tokens) for tokens in user_tokens],
                )
                for user_key, user_tokens in tokenized_by_user.items()
            }
            self._entry_count = sum(
                len(entries) for entries in entries_by_user.values()
            )

    def search(self, query: str, k: int, *, user_id: str) -> list[BM25Hit]:
        """按查询词项打分，只在该用户语料内检索。"""
        if k <= 0 or not user_id:
            return []
        query_tokens = tokenize(query)
        if not query_tokens:
            return []

        query_set = set(query_tokens)
        with self._lock:
            group = self._user_indexes.get(str(user_id))
            if group is None:
                return []
            bm25, entries, token_sets = group
            scores = bm25.get_scores(query_tokens)
            ranked = sorted(
                zip(entries, token_sets, scores),
                key=lambda pair: float(pair[2]),
                reverse=True,
            )
            hits: list[BM25Hit] = []
            for (chunk_id, content, metadata), token_set, score in ranked:
                # BM25Plus 会给所有文档一个基础分，这里要求至少命中一个查询词。
                if query_set.isdisjoint(token_set):
                    continue
                score = float(score)
                if score <= 0:
                    continue
                hits.append(BM25Hit(chunk_id=chunk_id, content=content, metadata=metadata, score=score))
                if len(hits) >= k:
                    break
            return hits

    def clear(self) -> None:
        """清空索引和缓存数据。"""
        with self._lock:
            self._entry_count = 0
            self._user_indexes = {}

    def __len__(self) -> int:
        """返回可检索片段数量。"""
        with self._lock:
            return self._entry_count

