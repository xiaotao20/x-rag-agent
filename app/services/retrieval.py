from langchain_chroma import Chroma
from app.schemas import SourceItem

class RetrievalService:
    def __init__(self, vector_store: Chroma, default_top_k: int = 4):
        self.vector_store = vector_store
        self.default_top_k = default_top_k

    def search(self, query: str, top_k: int | None = None) -> list[SourceItem]:
        pairs = self.vector_store.similarity_search_with_score(query, k=top_k or self.default_top_k)
        results = []
        for doc, distance in pairs:
            md = doc.metadata or {}
            results.append(SourceItem(
                document_id=str(md.get("document_id", "")),
                source=str(md.get("source", "unknown")),
                chunk_index=int(md.get("chunk_index", 0)),
                content=doc.page_content,
                score=float(distance),  # Chroma distance: not a probability
            ))
        return results

    def get_document_source(self, document_id: str) -> str | None:
        raw = self.vector_store.get(where={"document_id": document_id}, include=["metadatas"], limit=1)
        metadatas = raw.get("metadatas") or []
        if not metadatas or not metadatas[0]:
            return None
        return str(metadatas[0].get("source") or "") or None

    def count_document_chunks(self, document_id: str) -> int:
        return len(self.vector_store.get(where={"document_id": document_id}).get("ids") or [])

    def delete_document(self, document_id: str) -> int:
        count = self.count_document_chunks(document_id)
        if count:
            self.vector_store.delete(where={"document_id": document_id})
        return count

    def list_documents(self) -> list[dict]:
        raw = self.vector_store.get(include=["metadatas"])
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
