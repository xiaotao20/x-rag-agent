from concurrent.futures import ThreadPoolExecutor
from threading import RLock

from langchain_chroma import Chroma
from app.schemas import SourceItem
from app.services.bm25_index import BM25Index
from app.services.fusion import rrf_fuse
from app.services.query_rewrite import NoopQueryRewriter, QueryRewriter
from app.services.rerank import NoopReranker, Reranker

class RetrievalService:
    """统一检索入口：Query 改写、混合召回、BM25 索引和可选重排。"""
    def __init__(
        self,
        vector_store: Chroma,
        default_top_k: int = 4,
        reranker: Reranker | None = None,
        rerank_top_n: int = 20,
        hybrid_enabled: bool = True,
        hybrid_candidate_k: int = 20,
        hybrid_rrf_k: int = 60,
        hybrid_dense_weight: float = 0.6,
        hybrid_bm25_weight: float = 0.4,
        query_rewriter: QueryRewriter | None = None,
        hybrid_variant_weight: float = 0.5,
    ):
        """初始化检索参数、BM25 索引和可选组件。"""
        self.vector_store = vector_store
        self.default_top_k = default_top_k
        self.reranker = reranker or NoopReranker()
        self.rerank_top_n = max(rerank_top_n, default_top_k)
        self.hybrid_enabled = hybrid_enabled
        self.hybrid_candidate_k = max(hybrid_candidate_k, default_top_k)
        self.hybrid_rrf_k = max(1, hybrid_rrf_k)
        self.hybrid_dense_weight = hybrid_dense_weight
        self.hybrid_bm25_weight = hybrid_bm25_weight
        self.query_rewriter = query_rewriter or NoopQueryRewriter()
        self.hybrid_variant_weight = max(0.0, hybrid_variant_weight)
        self._bm25 = BM25Index()
        self._bm25_ready = False
        self._bm25_lock = RLock()

    def search(
        self,
        query: str,
        top_k: int | None = None,
        *,
        user_id: str,
    ) -> list[SourceItem]:
        """执行改写后的多路检索并按 RRF 返回指定用户的 top_k。"""
        final_k = top_k or self.default_top_k
        if self.hybrid_enabled:
            candidate_k = max(final_k, self.hybrid_candidate_k)
            # Query改写
            queries = self.query_rewriter.rewrite(query) or [query]
            if self.hybrid_variant_weight <= 0:
                queries = queries[:1]

            def retrieve_variant(
                item: tuple[int, str],
            ) -> tuple[list[SourceItem], list[SourceItem]]:
                index, search_query = item
                try:
                    dense = self._dense_search(search_query, candidate_k, user_id)
                except Exception:
                    if index == 0:
                        raise
                    # 单个改写变体失败时只丢弃该变体，不影响原查询。
                    return [], []
                try:
                    bm25 = self._bm25_search(search_query, candidate_k, user_id)
                except Exception:
                    # BM25 索引异常时保留向量召回，不让检索整体失败。
                    bm25 = []
                return dense, bm25

            indexed_queries = list(enumerate(queries))
            if len(indexed_queries) == 1:
                variants = [retrieve_variant(indexed_queries[0])]
            else:
                # 多个改写查询的向量/BM25 检索并行执行，减少首包延迟。
                with ThreadPoolExecutor(max_workers=min(4, len(indexed_queries))) as executor:
                    variants = list(executor.map(retrieve_variant, indexed_queries))

            ranked_lists = []
            for index, (dense, bm25) in enumerate(variants):
                weight = 1.0 if index == 0 else self.hybrid_variant_weight
                if weight <= 0:
                    continue
                ranked_lists.append((weight * self.hybrid_dense_weight, dense))
                ranked_lists.append((weight * self.hybrid_bm25_weight, bm25))
            results = rrf_fuse(ranked_lists, rrf_k=self.hybrid_rrf_k)
        else:
            results = self._dense_search(query, final_k, user_id)

        return self._maybe_rerank(query, results, final_k)

    def invalidate_index(self) -> None:
        """让 BM25 索引失效，下次检索重建。"""
        with self._bm25_lock:
            self._bm25.clear()
            self._bm25_ready = False

    def _dense_search(
        self, query: str, k: int, user_id: str
    ) -> list[SourceItem]:
        """对单个查询执行 Chroma 向量召回，并按用户过滤。"""
        pairs = self.vector_store.similarity_search_with_score(
            query,
            k=k,
            filter={"user_id": user_id},
        )
        results = []
        for doc, distance in pairs:
            md = doc.metadata or {}
            results.append(SourceItem(
                document_id=str(md.get("document_id", "")),
                source=str(md.get("source", "unknown")),
                chunk_index=int(md.get("chunk_index", 0)),
                content=doc.page_content,
                score=float(distance),
                score_type="vector",
                vector_distance=float(distance),
            ))
        return results

    def _bm25_search(
        self, query: str, k: int, user_id: str
    ) -> list[SourceItem]:
        """对单个查询执行 BM25 召回，并按用户语料过滤。"""
        self._ensure_bm25_index()
        results = []
        for hit in self._bm25.search(query, k, user_id=user_id):
            md = hit.metadata or {}
            results.append(SourceItem(
                document_id=str(md.get("document_id", "")),
                source=str(md.get("source", "unknown")),
                chunk_index=int(md.get("chunk_index", 0)),
                content=hit.content,
                score=hit.score,
                score_type="bm25",
                bm25_score=hit.score,
            ))
        return results

    def _ensure_bm25_index(self) -> None:
        """按需从 Chroma 加载所有片段并重建 BM25。"""
        if self._bm25_ready:
            return
        with self._bm25_lock:
            if self._bm25_ready:
                return
            ids, contents, metadatas = self._load_all_chunks()
            self._bm25.rebuild(ids, contents, metadatas)
            self._bm25_ready = True

    def _load_all_chunks(self) -> tuple[list[str], list[str], list[dict]]:
        """分页读取 Chroma 的 id、正文和元数据。"""
        batch_size = 500
        offset = 0
        ids: list[str] = []
        contents: list[str] = []
        metadatas: list[dict] = []
        while True:
            raw = self.vector_store.get(
                include=["documents", "metadatas"],
                limit=batch_size,
                offset=offset,
            )
            batch_ids = raw.get("ids") or []
            if not batch_ids:
                break
            batch_documents = raw.get("documents") or []
            batch_metadatas = raw.get("metadatas") or []
            for index, chunk_id in enumerate(batch_ids):
                content = batch_documents[index] if index < len(batch_documents) else ""
                metadata = batch_metadatas[index] if index < len(batch_metadatas) else {}
                if content and str(content).strip():
                    ids.append(str(chunk_id))
                    contents.append(str(content))
                    metadatas.append(dict(metadata or {}))
            if len(batch_ids) < batch_size:
                break
            offset += len(batch_ids)
        return ids, contents, metadatas

    def _maybe_rerank(self, query: str, results: list[SourceItem], final_k: int) -> list[SourceItem]:
        """按配置执行 Rerank，失败时回退融合顺序。"""
        if not self.reranker.enabled:
            return results[:final_k]
        candidates = results[:max(final_k, self.rerank_top_n)]
        if len(candidates) <= final_k:
            return candidates[:final_k]
        try:
            return self.reranker.rerank(query, candidates, final_k)
        except Exception:
            # Rerank 是可选增强，失败时退回融合/向量检索顺序。
            return candidates[:final_k]

    @staticmethod
    def _document_where(document_id: str, user_id: str) -> dict:
        """构造带用户归属的文档过滤条件。"""
        return {
            "$and": [
                {"document_id": document_id},
                {"user_id": user_id},
            ]
        }

    def get_document_source(
        self, document_id: str, user_id: str
    ) -> str | None:
        """查询当前用户文档对应的原始文件名。"""
        raw = self.vector_store.get(
            where=self._document_where(document_id, user_id),
            include=["metadatas"],
            limit=1,
        )
        metadatas = raw.get("metadatas") or []
        if not metadatas or not metadatas[0]:
            return None
        return str(metadatas[0].get("source") or "") or None

    def count_document_chunks(self, document_id: str, user_id: str) -> int:
        """统计当前用户文档片段数。"""
        return len(
            self.vector_store.get(
                where=self._document_where(document_id, user_id)
            ).get("ids") or []
        )

    def delete_document(self, document_id: str, user_id: str) -> int:
        """删除当前用户文档的所有向量片段。"""
        count = self.count_document_chunks(document_id, user_id)
        if count:
            self.vector_store.delete(
                where=self._document_where(document_id, user_id)
            )
        return count

    def list_documents(self, user_id: str) -> list[dict]:
        """按文档聚合片段并返回当前用户的文档列表。"""
        raw = self.vector_store.get(
            include=["metadatas"],
            where={"user_id": user_id},
        )
        grouped = {}
        for md in raw.get("metadatas") or []:
            md = md or {}
            doc_id = str(md.get("document_id", ""))
            if not doc_id:
                continue
            if doc_id not in grouped:
                grouped[doc_id] = {"document_id": doc_id, "source": str(md.get("source", "unknown")), "chunks": 0}
            grouped[doc_id]["chunks"] += 1
        return sorted(grouped.values(), key=lambda item: item["source"].lower())
