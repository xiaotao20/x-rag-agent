from contextlib import asynccontextmanager
from pathlib import Path

from dotenv import load_dotenv

# 必须在导入 LangChain 相关模块之前执行，让 LANGSMITH_* 等变量进入 os.environ。
load_dotenv(Path(__file__).resolve().parent.parent / ".env")

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from langgraph.checkpoint.sqlite.aio import AsyncSqliteSaver
from app.core.config import get_settings
from app.dependencies import init_rag_agent
from app.services.sessions import cleanup_ephemeral_threads
from app.api.routes import router

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings.checkpoint_path.parent.mkdir(parents=True, exist_ok=True)
    async with AsyncSqliteSaver.from_conn_string(str(settings.checkpoint_path)) as checkpointer:
        await checkpointer.setup()
        init_rag_agent(checkpointer)
        await cleanup_ephemeral_threads(checkpointer)
        yield


app = FastAPI(
    title=settings.app_name,
    version="0.1.0",
    description="FastAPI + LangChain 1.2 + Chroma RAG Agent",
    lifespan=lifespan,
)
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
