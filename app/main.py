import logging
from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import get_settings
from app.core.database import close_db, init_db
from app.core.redis_client import close_redis
from app.api.routes import router
from app.auth.router import router as auth_router
from app.conversations.router import router as conversations_router

# 必须先加载环境变量，再初始化日志
load_dotenv()

from app.core.logging_config import setup_logging

# 初始化日志配置
setup_logging()

settings = get_settings()

logger = logging.getLogger(__name__)

logger.info("=========>Starting app")


@asynccontextmanager
async def lifespan(_: FastAPI):
    """应用启动时建表，关闭时释放数据库和 Redis 连接。"""
    await init_db()
    yield
    await close_redis()
    await close_db()


app = FastAPI(
    title=settings.app_name,
    version="0.1.0",
    description="FastAPI + LangChain 1.2 + Chroma RAG Agent",
    lifespan=lifespan,
)

logger.info("=========>正在加载FastAPI中间件")
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(router, prefix=settings.api_v1_prefix)
app.include_router(auth_router, prefix=settings.api_v1_prefix)
app.include_router(conversations_router, prefix=settings.api_v1_prefix)

@app.get("/")
def root():
    """返回服务名称、文档地址和 API 前缀。"""
    return {"name": settings.app_name, "docs": "/docs", "api_prefix": settings.api_v1_prefix}
