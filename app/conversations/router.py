from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user
from app.auth.models import User
from app.conversations import service
from app.conversations.schemas import (
    ConversationDetail,
    ConversationRenameRequest,
    ConversationSummary,
)
from app.core.database import get_db

router = APIRouter(prefix="/conversations", tags=["conversations"])


@router.get("", response_model=list[ConversationSummary])
async def list_conversations(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """返回当前用户的会话列表。"""
    return await service.list_conversations(db, user.id)


@router.get("/{conversation_id}", response_model=ConversationDetail)
async def get_conversation(
    conversation_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """返回当前用户指定会话及消息。"""
    return await service.get_detail(db, user.id, conversation_id)


@router.patch("/{conversation_id}", response_model=ConversationSummary)
async def rename_conversation(
    conversation_id: str,
    body: ConversationRenameRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """重命名当前用户会话。"""
    return await service.rename_conversation(
        db, user.id, conversation_id, body.title
    )


@router.delete("/{conversation_id}")
async def delete_conversation(
    conversation_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """删除当前用户会话。"""
    await service.delete_conversation(db, user.id, conversation_id)
    return {"ok": True}
