import re
from typing import Any
from uuid import uuid4

EPHEMERAL_PREFIX = "ephemeral-"
THREAD_ID_RE = re.compile(r"^[A-Za-z0-9._-]{1,128}$")


def validate_thread_id(thread_id: str) -> bool:
    return bool(THREAD_ID_RE.fullmatch(thread_id))


def effective_thread_id(requested: str | None, memory: bool) -> str:
    """记忆开启时复用 thread_id；关闭时始终生成带前缀的临时线程。"""
    if memory:
        if requested and validate_thread_id(requested) and not requested.startswith(EPHEMERAL_PREFIX):
            return requested
        return uuid4().hex

    base = requested if requested and validate_thread_id(requested) else uuid4().hex
    if base.startswith(EPHEMERAL_PREFIX):
        return base
    return f"{EPHEMERAL_PREFIX}{base}"


def is_ephemeral(thread_id: str) -> bool:
    return thread_id.startswith(EPHEMERAL_PREFIX)


async def cleanup_ephemeral_threads(checkpointer: Any) -> int:
    """启动时清理上次运行遗留的临时会话（包括未完成的确认）。"""
    conn = getattr(checkpointer, "conn", None)
    if conn is None:
        return 0

    cursor = await conn.execute(
        "SELECT DISTINCT thread_id FROM checkpoints WHERE thread_id LIKE ?",
        (f"{EPHEMERAL_PREFIX}%",),
    )
    rows = await cursor.fetchall()
    await cursor.close()

    removed = 0
    for (thread_id,) in rows:
        try:
            await checkpointer.adelete_thread(thread_id)
            removed += 1
        except Exception:
            continue
    return removed
