from typing import Literal

from pydantic import BaseModel, Field

class SearchRequest(BaseModel):
    query: str = Field(min_length=1, max_length=4000)
    top_k: int | None = Field(default=None, ge=1, le=20)

class ChatRequest(BaseModel):
    question: str = Field(min_length=1, max_length=4000)
    thread_id: str | None = Field(default=None, max_length=128)
    memory: bool = False

class ResumeRequest(BaseModel):
    thread_id: str = Field(min_length=1, max_length=128)
    memory: bool = False
    decisions: list[dict] = Field(min_length=1)

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
    thread_id: str
    status: Literal["completed", "interrupted"] = "completed"
    answer: str = ""
    sources: list[SourceItem] = []
    tool_calls: list[dict] = []
    interrupt: dict | None = None

class IngestResponse(BaseModel):
    document_id: str
    filename: str
    chunks_created: int
    message: str

class DocumentItem(BaseModel):
    document_id: str
    source: str
    chunks: int
