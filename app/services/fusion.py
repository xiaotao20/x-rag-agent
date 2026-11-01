from collections import defaultdict
from collections.abc import Sequence

from app.schemas import SourceItem


def _chunk_key(item: SourceItem) -> str:
    """生成片段去重键。"""
    return f"{item.document_id}:{item.chunk_index}"


def rrf_fuse(
    ranked_lists: Sequence[tuple[float, Sequence[SourceItem]]],
    *,
    rrf_k: int = 60,
) -> list[SourceItem]:
    """按 RRF 融合多路检索结果；权重用于区分原始查询、变体和不同召回器。"""
    rrf_k = max(1, rrf_k)
    scores: defaultdict[str, float] = defaultdict(float)
    items: dict[str, SourceItem] = {}

    for weight, results in ranked_lists:
        if weight <= 0:
            continue
        for rank, item in enumerate(results, start=1):
            key = _chunk_key(item)
            # 这里的 results 是向量查询的结果列表或者 BM25 查询出来的结果列表，分数越低越靠后，总得分也会更低
            # 同一个 Query 中，越靠后的 BM25分数越低，因为在 BM25中根据分数排好序了。
            # 首个问题权重高
            # 这里计算的是融合分数，结合权重、BM25分数算综合得分，把相同的片段汇总到一起
            scores[key] += weight / (rrf_k + rank)
            existing = items.get(key)
            if existing is None:
                items[key] = item.model_copy(deep=True)
                continue
            if existing.vector_distance is None and item.vector_distance is not None:
                existing.vector_distance = item.vector_distance
            if existing.bm25_score is None and item.bm25_score is not None:
                existing.bm25_score = item.bm25_score
            if existing.rerank_score is None and item.rerank_score is not None:
                existing.rerank_score = item.rerank_score

    fused: list[SourceItem] = []
    for key, score in sorted(scores.items(), key=lambda pair: pair[1], reverse=True):
        item = items[key]
        item.score = score
        item.score_type = "rrf"
        fused.append(item)
    return fused
