import logging

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import get_settings
from app.api.routes import router

# 必须先加载环境变量，再初始化日志
load_dotenv()

from app.core.logging_config import setup_logging

# 初始化日志配置
setup_logging()

settings = get_settings()

logger = logging.getLogger(__name__)

logger.info("=========>Starting app")
app = FastAPI(title=settings.app_name, version="0.1.0", description="FastAPI + LangChain 1.2 + Chroma RAG Agent")

logger.info("=========>正在加载FastAPI中间件")
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(router, prefix=settings.api_v1_prefix)

@app.get("/")
def root():
    return {"name": settings.app_name, "docs": "/docs", "api_prefix": settings.api_v1_prefix}
