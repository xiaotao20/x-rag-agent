from pydantic import BaseModel, Field


class CaptchaChallengeResponse(BaseModel):
    """拼图挑战响应。"""
    challenge_id: str
    background: str
    piece: str
    image_width: int
    image_height: int
    piece_width: int
    piece_height: int
    piece_y: int
    expires_in: int


class CaptchaVerifyRequest(BaseModel):
    """拼图校验请求。"""
    challenge_id: str = Field(min_length=1, max_length=128)
    offset: int = Field(ge=0)
    phone: str = Field(min_length=1, max_length=32)


class CaptchaVerifyResponse(BaseModel):
    """拼图通过后的一次性票据。"""
    ticket: str
    expires_in: int


class RegisterRequest(BaseModel):
    """账号注册请求。"""
    username: str = Field(min_length=3, max_length=32)
    password: str = Field(min_length=8, max_length=128)


class LoginRequest(BaseModel):
    """账号登录请求。"""
    username: str = Field(min_length=1, max_length=32)
    password: str = Field(min_length=1, max_length=128)


class UserResponse(BaseModel):
    """当前用户响应。"""
    id: str
    username: str
    display_name: str | None = None
    avatar_url: str | None = None
