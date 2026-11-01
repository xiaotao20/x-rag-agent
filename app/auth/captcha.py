import base64
import hashlib
import hmac
import io
import json
import random
import secrets

from fastapi import HTTPException
from PIL import Image, ImageDraw
from redis.asyncio import Redis

from app.core.config import Settings

IMAGE_WIDTH = 320
IMAGE_HEIGHT = 160
PIECE_SIZE = 48
GAP_MARGIN = 12
MAX_ATTEMPTS = 5


def _encode_png(image: Image.Image) -> str:
    """把 Pillow 图片编码成前端可直接使用的 base64 PNG。"""
    buffer = io.BytesIO()
    image.save(buffer, format="PNG", optimize=True)
    return base64.b64encode(buffer.getvalue()).decode("ascii")


def _phone_hash(phone: str, secret: str) -> str:
    """用服务端密钥对手机号做 HMAC，避免明文写入 Redis。"""
    return hmac.new(secret.encode("utf-8"), phone.encode("utf-8"), hashlib.sha256).hexdigest()


def _require_secret(settings: Settings) -> str:
    """确保 AUTH_SECRET 已配置，否则拒绝生成可校验票据。"""
    if not settings.auth_secret:
        raise HTTPException(status_code=500, detail="AUTH_SECRET 未配置")
    return settings.auth_secret


def _make_background() -> Image.Image:
    """生成带网格、光斑和噪点的拼图背景。"""
    image = Image.new("RGB", (IMAGE_WIDTH, IMAGE_HEIGHT))
    draw = ImageDraw.Draw(image)
    top = (6, 12, 30)
    bottom = (10, 42, 68)
    for y in range(IMAGE_HEIGHT):
        ratio = y / (IMAGE_HEIGHT - 1)
        color = tuple(int(top[i] + (bottom[i] - top[i]) * ratio) for i in range(3))
        draw.line((0, y, IMAGE_WIDTH, y), fill=color)

    overlay = Image.new("RGBA", (IMAGE_WIDTH, IMAGE_HEIGHT), (0, 0, 0, 0))
    overlay_draw = ImageDraw.Draw(overlay)
    for x in range(0, IMAGE_WIDTH, 32):
        overlay_draw.line((x, 0, x, IMAGE_HEIGHT), fill=(45, 212, 191, 18), width=1)
    for y in range(0, IMAGE_HEIGHT, 32):
        overlay_draw.line((0, y, IMAGE_WIDTH, y), fill=(45, 212, 191, 18), width=1)
    for _ in range(9):
        radius = random.randint(10, 46)
        x = random.randint(0, IMAGE_WIDTH)
        y = random.randint(0, IMAGE_HEIGHT)
        color = random.choice(
            [(34, 211, 238, 35), (99, 102, 241, 30), (168, 85, 247, 25)]
        )
        overlay_draw.ellipse((x - radius, y - radius, x + radius, y + radius), fill=color)
    for _ in range(5):
        x1 = random.randint(0, IMAGE_WIDTH)
        y1 = random.randint(0, IMAGE_HEIGHT)
        x2 = x1 + random.randint(-120, 120)
        y2 = y1 + random.randint(-60, 60)
        overlay_draw.line((x1, y1, x2, y2), fill=(34, 211, 238, 45), width=1)

    image = Image.alpha_composite(image.convert("RGBA"), overlay).convert("RGB")
    noise = Image.effect_noise((IMAGE_WIDTH, IMAGE_HEIGHT), 16).convert("RGB")
    return Image.blend(image, noise, 0.06)


async def create_challenge(redis: Redis, settings: Settings) -> dict:
    """生成拼图缺口、拼图块，并把目标位置写入 Redis。"""
    image = _make_background()
    max_x = IMAGE_WIDTH - PIECE_SIZE - GAP_MARGIN
    min_x = IMAGE_WIDTH // 2
    target_x = random.randint(min_x, max_x)
    piece_y = random.randint(GAP_MARGIN, IMAGE_HEIGHT - PIECE_SIZE - GAP_MARGIN)

    mask = Image.new("L", (PIECE_SIZE, PIECE_SIZE), 0)
    ImageDraw.Draw(mask).rounded_rectangle(
        (0, 0, PIECE_SIZE - 1, PIECE_SIZE - 1), radius=10, fill=255
    )
    piece = image.crop(
        (target_x, piece_y, target_x + PIECE_SIZE, piece_y + PIECE_SIZE)
    ).convert("RGBA")
    piece.putalpha(mask)
    ImageDraw.Draw(piece).rounded_rectangle(
        (0, 0, PIECE_SIZE - 1, PIECE_SIZE - 1),
        radius=10,
        outline=(103, 232, 249, 230),
        width=2,
    )

    gap_layer = Image.new("RGBA", (IMAGE_WIDTH, IMAGE_HEIGHT), (0, 0, 0, 0))
    gap_draw = ImageDraw.Draw(gap_layer)
    gap_draw.rounded_rectangle(
        (target_x, piece_y, target_x + PIECE_SIZE, piece_y + PIECE_SIZE),
        radius=10,
        fill=(2, 8, 20, 210),
        outline=(34, 211, 238, 140),
        width=2,
    )
    background = Image.alpha_composite(image.convert("RGBA"), gap_layer).convert("RGB")

    challenge_id = secrets.token_urlsafe(18)
    payload = {"target_offset": target_x, "attempts": 0}
    await redis.set(
        f"captcha:challenge:{challenge_id}",
        json.dumps(payload),
        ex=settings.auth_captcha_ttl_s,
    )

    return {
        "challenge_id": challenge_id,
        "background": _encode_png(background),
        "piece": _encode_png(piece),
        "image_width": IMAGE_WIDTH,
        "image_height": IMAGE_HEIGHT,
        "piece_width": PIECE_SIZE,
        "piece_height": PIECE_SIZE,
        "piece_y": piece_y,
        "expires_in": settings.auth_captcha_ttl_s,
    }


async def verify_challenge(
    redis: Redis,
    settings: Settings,
    challenge_id: str,
    offset: int,
    phone: str,
) -> str:
    """校验拖动偏移，成功后发放一次性 captcha ticket。"""
    secret = _require_secret(settings)
    key = f"captcha:challenge:{challenge_id}"
    raw = await redis.get(key)
    if not raw:
        raise HTTPException(status_code=400, detail="拼图已过期，请刷新后重试")

    data = json.loads(raw)
    attempts = int(data.get("attempts", 0)) + 1
    if attempts > MAX_ATTEMPTS:
        await redis.delete(key)
        raise HTTPException(status_code=429, detail="尝试次数过多，请刷新拼图")

    target = int(data.get("target_offset", 0))
    if abs(int(offset) - target) > settings.auth_captcha_tolerance_px:
        data["attempts"] = attempts
        ttl = await redis.ttl(key)
        if ttl > 0:
            await redis.set(key, json.dumps(data), ex=ttl)
        else:
            await redis.delete(key)
        remaining = MAX_ATTEMPTS - attempts
        raise HTTPException(status_code=400, detail=f"拼图未对齐，请重试（剩余 {remaining} 次）")

    await redis.delete(key)
    ticket = secrets.token_urlsafe(32)
    await redis.set(
        f"captcha:ticket:{ticket}",
        json.dumps({"phone_hash": _phone_hash(phone, secret)}),
        ex=settings.auth_ticket_ttl_s,
    )
    return ticket


async def require_ticket(redis: Redis, settings: Settings, ticket: str, phone: str) -> None:
    """校验 ticket 存在且与手机号匹配，但不消费。"""
    secret = _require_secret(settings)
    raw = await redis.get(f"captcha:ticket:{ticket}")
    if not raw:
        raise HTTPException(status_code=400, detail="验证已过期，请重新完成拼图")
    data = json.loads(raw)
    if not hmac.compare_digest(
        str(data.get("phone_hash", "")), _phone_hash(phone, secret)
    ):
        raise HTTPException(status_code=400, detail="手机号与验证不匹配，请重新验证")


async def consume_ticket(redis: Redis, settings: Settings, ticket: str, phone: str) -> None:
    """原子读取并删除 ticket，保证只能使用一次。"""
    secret = _require_secret(settings)
    raw = await redis.getdel(f"captcha:ticket:{ticket}")
    if not raw:
        raise HTTPException(status_code=400, detail="验证已过期，请重新完成拼图")
    data = json.loads(raw)
    if not hmac.compare_digest(
        str(data.get("phone_hash", "")), _phone_hash(phone, secret)
    ):
        raise HTTPException(status_code=400, detail="手机号与验证不匹配，请重新验证")


async def check_rate_limit(redis: Redis, key: str, limit: int, window_s: int) -> None:
    """基于 Redis INCR 做固定窗口限流。"""
    current = await redis.incr(key)
    if current == 1:
        await redis.expire(key, window_s)
    if current > limit:
        raise HTTPException(status_code=429, detail="操作过于频繁，请稍后再试")
