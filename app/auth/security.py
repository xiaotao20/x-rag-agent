import hashlib
import re
import secrets
from datetime import datetime, timedelta, timezone

from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError, VerifyMismatchError
from fastapi import HTTPException, Request, Response
from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.models import AuthSession, User
from app.core.config import Settings

USERNAME_RE = re.compile(r"^[a-zA-Z0-9_]{3,32}$")
_hasher = PasswordHasher()


def normalize_username(username: str) -> str:
    """规范化并校验账号格式。"""
    normalized = username.strip().lower()
    if not USERNAME_RE.fullmatch(normalized):
        raise HTTPException(
            status_code=400,
            detail="账号需为 3-32 位字母、数字或下划线",
        )
    return normalized


def hash_password(password: str) -> str:
    """生成 Argon2 密码哈希。"""
    return _hasher.hash(password)


def verify_password(password_hash: str, password: str) -> bool:
    """校验明文密码与 Argon2 哈希是否匹配。"""
    try:
        return _hasher.verify(password_hash, password)
    except (VerifyMismatchError, VerificationError, InvalidHashError):
        return False


def hash_token(token: str) -> str:
    """计算会话 token 的 SHA-256 摘要。"""
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


async def check_rate_limit(redis: Redis, key: str, limit: int, window_s: int) -> None:
    """基于 Redis INCR 做固定窗口限流。"""
    current = await redis.incr(key)
    if current == 1:
        await redis.expire(key, window_s)
    if current > limit:
        raise HTTPException(status_code=429, detail="操作过于频繁，请稍后再试")


async def create_session(
    db: AsyncSession,
    user: User,
    request: Request,
    response: Response,
    settings: Settings,
) -> None:
    """创建数据库会话并写入 HttpOnly Cookie。"""
    token = secrets.token_urlsafe(32)
    expires_at = datetime.now(timezone.utc) + timedelta(seconds=settings.auth_session_ttl_s)
    db.add(
        AuthSession(
            user_id=user.id,
            token_hash=hash_token(token),
            ip=request.client.host if request.client else None,
            user_agent=request.headers.get("user-agent"),
            expires_at=expires_at,
        )
    )
    await db.commit()
    response.set_cookie(
        settings.auth_session_cookie,
        token,
        max_age=settings.auth_session_ttl_s,
        httponly=True,
        secure=settings.auth_cookie_secure,
        samesite="lax",
        path="/",
    )
