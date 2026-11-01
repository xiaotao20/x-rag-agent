from fastapi import Depends, HTTPException, Request
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.models import AuthSession, User
from app.auth.security import hash_token
from app.core.config import get_settings
from app.core.database import get_db


async def get_current_user(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> User:
    """从 HttpOnly Cookie 解析会话并返回当前登录用户。"""
    settings = get_settings()
    token = request.cookies.get(settings.auth_session_cookie)
    if not token:
        raise HTTPException(status_code=401, detail="未登录")

    session = await db.scalar(
        select(AuthSession).where(
            AuthSession.token_hash == hash_token(token),
            AuthSession.revoked_at.is_(None),
            AuthSession.expires_at > func.now(),
        )
    )
    if session is None:
        raise HTTPException(status_code=401, detail="登录已过期")

    user = await db.get(User, session.user_id)
    if user is None or user.status != "active":
        raise HTTPException(status_code=401, detail="用户不可用")
    return user
