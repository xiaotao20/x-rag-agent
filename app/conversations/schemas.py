from datetime import datetime

from pydantic import BaseModel, Field

from app.schemas import SourceItem


class ConversationSummary(BaseModel):
    """会话列表项。"""
    id: str
    title: str
    created_at: datetime
    updated_at: datetime


class ConversationMessageItem(BaseModel):
    """持久化的单条会话消息。"""
    id: str
    role: str
    content: str
    sources: list[SourceItem] = Field(default_factory=list)
    tool_calls: list[dict] = Field(default_factory=list)
    status: str
    created_at: datetime


class ConversationDetail(ConversationSummary):
    """会话及其消息列表。"""
    messages: list[ConversationMessageItem]


class ConversationRenameRequest(BaseModel):
    """会话重命名请求。"""
    title: str = Field(min_length=1, max_length=120)
