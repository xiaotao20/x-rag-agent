from functools import lru_cache

from redis.asyncio import Redis

from app.core.config import get_settings


@lru_cache
def get_redis() -> Redis:
    """返回进程内复用的异步 Redis 客户端。"""
    redis_url = get_settings().redis_url
    if not redis_url:
        raise RuntimeError("REDIS_URL 未配置")
    return Redis.from_url(redis_url, decode_responses=True)


async def close_redis() -> None:
    """关闭 Redis 连接并清空缓存实例。"""
    client = get_redis()
    await client.aclose()
    get_redis.cache_clear()
