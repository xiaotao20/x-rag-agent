import uuid
from datetime import datetime, timezone

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.conversations.models import (
    Conversation,
    ConversationMessage,
    ConversationSummaryRecord,
)
from app.conversations.schemas import (
    ConversationDetail,
    ConversationMessageItem,
    ConversationSummary,
)
from app.core.config import get_settings
from app.dependencies import get_summarizer
from app.schemas import SourceItem
from app.services.summarization import Summarizer


def _parse_conversation_id(value: str) -> uuid.UUID:
    """解析 UUID，非法 ID 统一返回 404。"""
    try:
        return uuid.UUID(value)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail="会话不存在") from exc


def _title_from_question(question: str) -> str:
    """用首条问题生成会话标题。"""
    title = " ".join(question.split()).strip()
    return title[:40] or "新会话"


def to_summary(conversation: Conversation) -> ConversationSummary:
    """ORM 会话转列表响应。"""
    return ConversationSummary(
        id=str(conversation.id),
        title=conversation.title,
        created_at=conversation.created_at,
        updated_at=conversation.updated_at,
    )


def to_message(message: ConversationMessage) -> ConversationMessageItem:
    """ORM 消息转 API 响应，并过滤非法来源数据。"""
    sources = []
    for item in message.sources or []:
        try:
            sources.append(SourceItem.model_validate(item))
        except Exception:
            continue
    return ConversationMessageItem(
        id=str(message.id),
        role=message.role,
        content=message.content,
        sources=sources,
        tool_calls=message.tool_calls or [],
        status=message.status,
        created_at=message.created_at,
    )


async def list_conversations(
    db: AsyncSession, user_id: uuid.UUID
) -> list[ConversationSummary]:
    """按更新时间倒序列出用户会话。"""
    rows = await db.scalars(
        select(Conversation)
        .where(Conversation.user_id == user_id)
        .order_by(Conversation.updated_at.desc())
    )
    return [to_summary(row) for row in rows]


async def get_conversation(
    db: AsyncSession, user_id: uuid.UUID, conversation_id: str
) -> Conversation:
    """按用户归属读取会话，不存在返回 404。"""
    conversation = await db.scalar(
        select(Conversation).where(
            Conversation.id == _parse_conversation_id(conversation_id),
            Conversation.user_id == user_id,
        )
    )
    if conversation is None:
        raise HTTPException(status_code=404, detail="会话不存在")
    return conversation


async def get_detail(
    db: AsyncSession, user_id: uuid.UUID, conversation_id: str
) -> ConversationDetail:
    """返回会话详情及最多 200 条消息。"""
    conversation = await get_conversation(db, user_id, conversation_id)
    messages = await db.scalars(
        select(ConversationMessage)
        .where(ConversationMessage.conversation_id == conversation.id)
        .order_by(ConversationMessage.created_at.asc())
        .limit(200)
    )
    return ConversationDetail(
        **to_summary(conversation).model_dump(),
        messages=[to_message(message) for message in messages],
    )


async def _get_summary_record(
    db: AsyncSession, conversation_id: uuid.UUID
) -> ConversationSummaryRecord | None:
    """读取会话的摘要和水位线。"""
    return await db.scalar(
        select(ConversationSummaryRecord).where(
            ConversationSummaryRecord.conversation_id == conversation_id
        )
    )


async def get_history(
    db: AsyncSession,
    conversation_id: uuid.UUID,
    after_created_at: datetime | None = None,
    limit: int = 10,
) -> list[dict]:
    """取水位线之后最近的若干条消息作为 Agent 上下文。"""
    statement = select(ConversationMessage).where(
        ConversationMessage.conversation_id == conversation_id
    )
    if after_created_at is not None:
        statement = statement.where(
            ConversationMessage.created_at > after_created_at
        )
    rows = await db.scalars(
        statement.order_by(ConversationMessage.created_at.desc()).limit(limit)
    )
    messages = list(reversed(list(rows)))
    return [
        {"role": message.role, "content": message.content}
        for message in messages
        if message.content and message.role in {"user", "assistant"}
    ]


async def refresh_summary(
    db: AsyncSession,
    conversation: Conversation,
    summarizer: Summarizer | None = None,
) -> ConversationSummaryRecord | None:
    """达到阈值时摘要较早消息，推进水位线，但不删除原始消息。"""
    settings = get_settings()
    record = await _get_summary_record(db, conversation.id)
    if summarizer is None:
        summarizer = get_summarizer()
    if not summarizer.enabled:
        return record

    trigger = max(2, settings.summary_trigger_messages)
    keep = max(1, min(settings.summary_keep_messages, trigger - 1))
    statement = select(ConversationMessage).where(
        ConversationMessage.conversation_id == conversation.id
    )
    if record is not None and record.through_created_at is not None:
        statement = statement.where(
            ConversationMessage.created_at > record.through_created_at
        )
    rows = list(
        await db.scalars(
            statement.order_by(ConversationMessage.created_at.asc()).limit(500)
        )
    )
    if len(rows) < trigger:
        return record

    older = rows[:-keep]
    if not older:
        return record
    summary = await summarizer.summarize(
        record.summary if record is not None else "",
        [
            {"role": message.role, "content": message.content}
            for message in older
            if message.content and message.role in {"user", "assistant"}
        ],
    )
    if not summary:
        return record

    now = datetime.now(timezone.utc)
    if record is None:
        record = ConversationSummaryRecord(conversation_id=conversation.id)
        db.add(record)
    record.summary = summary
    record.through_message_id = older[-1].id
    record.through_created_at = older[-1].created_at
    record.updated_at = now
    await db.commit()
    return record


async def prepare_conversation(
    db: AsyncSession,
    user_id: uuid.UUID,
    conversation_id: str | None,
    question: str,
    summarizer: Summarizer | None = None,
) -> tuple[Conversation, list[dict], str | None]:
    """读取摘要和历史、创建/校验会话，并写入当前用户消息。"""
    if conversation_id:
        conversation = await get_conversation(db, user_id, conversation_id)
        if conversation.title == "新会话":
            conversation.title = _title_from_question(question)
    else:
        conversation = Conversation(
            user_id=user_id,
            title=_title_from_question(question),
        )
        db.add(conversation)
        await db.flush()

    settings = get_settings()
    record = await refresh_summary(db, conversation, summarizer)
    history = await get_history(
        db,
        conversation.id,
        after_created_at=record.through_created_at if record else None,
        limit=max(2, settings.summary_trigger_messages),
    )
    db.add(
        ConversationMessage(
            conversation_id=conversation.id,
            role="user",
            content=question,
            status="done",
        )
    )
    conversation.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(conversation)
    return conversation, history, record.summary if record and record.summary else None


async def save_assistant_message(
    db: AsyncSession,
    conversation_id: uuid.UUID,
    content: str,
    sources: list[dict] | None = None,
    tool_calls: list[dict] | None = None,
    status: str = "done",
) -> None:
    """保存助手回答、来源和工具调用。"""
    conversation = await db.get(Conversation, conversation_id)
    if conversation is None:
        return
    if not content and not sources:
        return
    db.add(
        ConversationMessage(
            conversation_id=conversation.id,
            role="assistant",
            content=content,
            sources=sources or [],
            tool_calls=tool_calls or [],
            status=status,
        )
    )
    conversation.updated_at = datetime.now(timezone.utc)
    await db.commit()


async def rename_conversation(
    db: AsyncSession, user_id: uuid.UUID, conversation_id: str, title: str
) -> ConversationSummary:
    """规范化标题并更新会话。"""
    conversation = await get_conversation(db, user_id, conversation_id)
    normalized = " ".join(title.split()).strip()
    if not normalized:
        raise HTTPException(status_code=400, detail="会话标题不能为空")
    conversation.title = normalized[:120]
    conversation.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(conversation)
    return to_summary(conversation)


async def delete_conversation(
    db: AsyncSession, user_id: uuid.UUID, conversation_id: str
) -> None:
    """删除用户会话，消息由外键级联清理。"""
    conversation = await get_conversation(db, user_id, conversation_id)
    await db.delete(conversation)
    await db.commit()
