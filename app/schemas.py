from pydantic import BaseModel, Field

class SearchRequest(BaseModel):
    query: str = Field(min_length=1, max_length=4000)
    top_k: int | None = Field(default=None, ge=1, le=20)

class ChatRequest(BaseModel):
    question: str = Field(min_length=1, max_length=4000)

class SourceItem(BaseModel):
    document_id: str
    source: str
    chunk_index: int
    content: str
    score: float | None = None

class SearchResponse(BaseModel):
    query: str
    results: list[SourceItem]

class ChatResponse(BaseModel):
    question: str
    answer: str
    sources: list[SourceItem]
    tool_calls: list[dict] = []

class IngestResponse(BaseModel):
    document_id: str
    filename: str
    chunks_created: int
    message: str

class DocumentItem(BaseModel):
    document_id: str
    source: str
    chunks: int
