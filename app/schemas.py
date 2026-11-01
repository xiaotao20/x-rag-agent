from pydantic import BaseModel, Field

class SearchRequest(BaseModel):
    """检索接口请求。"""
    query: str = Field(min_length=1, max_length=4000)
    top_k: int | None = Field(default=None, ge=1, le=20)

class ChatRequest(BaseModel):
    """问答请求，可携带会话 ID。"""
    question: str = Field(min_length=1, max_length=4000)
    conversation_id: str | None = None

class SourceItem(BaseModel):
    """检索/引用来源片段。"""
    document_id: str
    source: str
    chunk_index: int
    content: str
    # score 的含义由 score_type 决定：
    # vector 是距离（越小越好）；bm25/rrf/rerank 是相关性（越大越好）。
    score: float | None = None
    score_type: str = "vector"
    vector_distance: float | None = None
    bm25_score: float | None = None
    rerank_score: float | None = None

class SearchResponse(BaseModel):
    """检索接口响应。"""
    query: str
    results: list[SourceItem]

class ChatResponse(BaseModel):
    """非流式问答响应。"""
    question: str
    conversation_id: str
    answer: str
    sources: list[SourceItem]
    tool_calls: list[dict] = []
    intent: str = "knowledge"

class IngestResponse(BaseModel):
    """文档入库响应。"""
    document_id: str
    filename: str
    chunks_created: int
    message: str

class DocumentItem(BaseModel):
    """文档列表项。"""
    document_id: str
    source: str
    chunks: int
