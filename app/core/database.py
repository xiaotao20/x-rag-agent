from collections.abc import AsyncIterator

from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase

from app.core.config import get_settings


class Base(DeclarativeBase):
    """SQLAlchemy 声明式模型基类。"""
    pass


_engine: AsyncEngine | None = None
_session_factory: async_sessionmaker[AsyncSession] | None = None


def get_engine() -> AsyncEngine:
    """懒加载异步数据库引擎。"""
    global _engine
    if _engine is None:
        database_url = get_settings().database_url
        if not database_url:
            raise RuntimeError("DATABASE_URL 未配置")
        _engine = create_async_engine(database_url, pool_pre_ping=True)
    return _engine


def get_session_factory() -> async_sessionmaker[AsyncSession]:
    """懒加载异步会话工厂。"""
    global _session_factory
    if _session_factory is None:
        _session_factory = async_sessionmaker(get_engine(), expire_on_commit=False)
    return _session_factory


async def get_db() -> AsyncIterator[AsyncSession]:
    """FastAPI 依赖，提供请求级数据库会话。"""
    async with get_session_factory()() as session:
        yield session


async def init_db() -> None:
    """导入所有模型并创建缺失的表。"""
    # 确保模型在 create_all 之前完成注册。
    from app.auth import models as auth_models  # noqa: F401
    from app.conversations import models as conversation_models  # noqa: F401

    async with get_engine().begin() as connection:
        await connection.run_sync(Base.metadata.create_all)


async def close_db() -> None:
    """释放数据库连接池。"""
    global _engine, _session_factory
    if _engine is not None:
        await _engine.dispose()
    _engine = None
    _session_factory = None
