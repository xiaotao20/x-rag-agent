from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from redis.asyncio import Redis
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import captcha
from app.auth.dependencies import get_current_user
from app.auth.models import AuthSession, LoginEvent, User
from app.auth.schemas import (
    CaptchaChallengeResponse,
    CaptchaVerifyRequest,
    CaptchaVerifyResponse,
    LoginRequest,
    RegisterRequest,
    UserResponse,
)
from app.auth.security import (
    check_rate_limit,
    create_session,
    hash_password,
    hash_token,
    normalize_username,
    verify_password,
)
from app.core.config import get_settings
from app.core.database import get_db
from app.core.redis_client import get_redis

router = APIRouter(prefix="/auth", tags=["auth"])


def _client_ip(request: Request) -> str:
    """取请求来源 IP，缺失时返回 unknown。"""
    return request.client.host if request.client else "unknown"


def _user_response(user: User) -> UserResponse:
    """把 ORM 用户转换成 API 响应。"""
    return UserResponse(
        id=str(user.id),
        username=user.username,
        display_name=user.display_name,
        avatar_url=user.avatar_url,
    )


async def _record_login(
    db: AsyncSession,
    request: Request,
    username: str,
    success: bool,
    reason: str,
    user: User | None = None,
) -> None:
    """写入登录审计，审计失败不影响主流程。"""
    db.add(
        LoginEvent(
            user_id=user.id if user else None,
            username=username,
            success=success,
            reason=reason,
            ip=request.client.host if request.client else None,
            user_agent=request.headers.get("user-agent"),
        )
    )
    try:
        await db.commit()
    except Exception:
        await db.rollback()


@router.post("/register", response_model=UserResponse, status_code=201)
async def register(
    body: RegisterRequest,
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
    redis: Redis = Depends(get_redis),
):
    """注册账号、创建会话并记录审计。"""
    settings = get_settings()
    username = normalize_username(body.username)
    await check_rate_limit(
        redis, f"rate:register_ip:{_client_ip(request)}", limit=10, window_s=60
    )

    existing = await db.scalar(select(User).where(User.username == username))
    if existing is not None:
        raise HTTPException(status_code=409, detail="账号已存在")

    user = User(username=username, password_hash=hash_password(body.password))
    db.add(user)
    try:
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(status_code=409, detail="账号已存在") from exc

    await db.refresh(user)
    await create_session(db, user, request, response, settings)
    await _record_login(db, request, username, True, "register", user)
    return _user_response(user)


@router.post("/login", response_model=UserResponse)
async def login(
    body: LoginRequest,
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
    redis: Redis = Depends(get_redis),
):
    """校验账号密码、创建会话并记录审计。"""
    settings = get_settings()
    username = normalize_username(body.username)
    await check_rate_limit(
        redis, f"rate:login_ip:{_client_ip(request)}", limit=20, window_s=60
    )
    await check_rate_limit(
        redis, f"rate:login_user:{username}", limit=10, window_s=60
    )

    user = await db.scalar(select(User).where(User.username == username))
    if user is None or not verify_password(user.password_hash, body.password):
        await _record_login(db, request, username, False, "invalid_credentials", user)
        raise HTTPException(status_code=401, detail="账号或密码错误")
    if user.status != "active":
        raise HTTPException(status_code=403, detail="账号不可用")

    await create_session(db, user, request, response, settings)
    await _record_login(db, request, username, True, "login", user)
    return _user_response(user)


@router.get("/me", response_model=UserResponse)
async def me(user: User = Depends(get_current_user)):
    """返回当前登录用户。"""
    return _user_response(user)


@router.post("/logout")
async def logout(
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    """吊销当前会话并删除 Cookie。"""
    settings = get_settings()
    token = request.cookies.get(settings.auth_session_cookie)
    if token:
        session = await db.scalar(
            select(AuthSession).where(AuthSession.token_hash == hash_token(token))
        )
        if session is not None:
            session.revoked_at = datetime.now(timezone.utc)
            await db.commit()
    response.delete_cookie(
        settings.auth_session_cookie,
        path="/",
        httponly=True,
        samesite="lax",
    )
    return {"ok": True}


# 拼图接口保留为可选的防刷能力；账号密码登录/注册不依赖它。
@router.get("/captcha/challenge", response_model=CaptchaChallengeResponse)
async def get_captcha(
    request: Request,
    response: Response,
    redis: Redis = Depends(get_redis),
):
    """生成可选拼图挑战。"""
    settings = get_settings()
    await check_rate_limit(
        redis, f"rate:captcha:{_client_ip(request)}", limit=30, window_s=60
    )
    response.headers["Cache-Control"] = "no-store"
    return await captcha.create_challenge(redis, settings)


@router.post("/captcha/verify", response_model=CaptchaVerifyResponse)
async def verify_captcha(
    body: CaptchaVerifyRequest,
    request: Request,
    redis: Redis = Depends(get_redis),
):
    """校验可选拼图挑战并返回 ticket。"""
    settings = get_settings()
    phone = body.phone.replace(" ", "").replace("-", "")
    if not phone.isdigit() or len(phone) != 11:
        raise HTTPException(status_code=400, detail="手机号必须是 11 位数字")
    await check_rate_limit(
        redis, f"rate:captcha_verify:{_client_ip(request)}", limit=20, window_s=60
    )
    ticket = await captcha.verify_challenge(
        redis, settings, body.challenge_id, body.offset, phone
    )
    return CaptchaVerifyResponse(ticket=ticket, expires_in=settings.auth_ticket_ttl_s)
