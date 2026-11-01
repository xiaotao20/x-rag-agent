from functools import lru_cache
from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    """应用配置，统一从环境变量和 .env 读取。"""
    app_name: str = "TAO-WQ RAG Agent"
    api_v1_prefix: str = "/api/v1"
    openai_api_key: str = ""
    openai_base_url: str = "https://dashscope.aliyuncs.com/compatible-mode/v1"
    chat_model: str = "qwen3.8-max"
    embedding_model: str = "qwen3.7-text-embedding-flash"
    chroma_persist_dir: str = "./data/chroma"
    chroma_collection: str = "knowledge_chunks"
    upload_dir: str = "./uploads"
    chunk_size: int = 800
    chunk_overlap: int = 120
    retrieval_top_k: int = 4
    hybrid_enabled: bool = True
    hybrid_candidate_k: int = 20
    hybrid_rrf_k: int = 60
    hybrid_dense_weight: float = 0.6
    hybrid_bm25_weight: float = 0.4
    query_rewrite_enabled: bool = True
    query_rewrite_model: str = ""
    query_rewrite_max_variants: int = 2
    query_rewrite_min_chars: int = 2
    hybrid_variant_weight: float = 0.5
    # Rerank 默认关闭；开启前需要在 .env 中配置 rerank_provider 和 rerank_model。
    rerank_enabled: bool = False
    rerank_provider: str = "none"  # none | dashscope | local
    rerank_model: str = ""
    rerank_top_n: int = 20
    dashscope_api_key: str = ""
    local_rerank_model: str = "BAAI/bge-reranker-v2-m3"
    local_rerank_device: str = ""
    max_upload_mb: int = 20
    cors_origins: str = "http://localhost:3000,http://127.0.0.1:3000"
    # 认证
    database_url: str = ""
    redis_url: str = ""
    auth_secret: str = ""
    auth_captcha_ttl_s: int = 180
    auth_ticket_ttl_s: int = 120
    auth_captcha_tolerance_px: int = 5
    auth_cookie_secure: bool = False
    auth_session_cookie: str = "rag_session"
    auth_session_ttl_s: int = 7 * 24 * 3600
    # 会话摘要
    summary_enabled: bool = True
    summary_model: str = ""
    summary_trigger_messages: int = 10
    summary_keep_messages: int = 6
    summary_max_chars: int = 4000
    summary_request_timeout_s: int = 15
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore", case_sensitive=False)

    @property
    def cors_origin_list(self) -> list[str]:
        """把逗号分隔的 CORS 配置拆成列表。"""
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def rerank_api_key(self) -> str:
        """Rerank 专用 key，未配置时复用 Chat/Embedding key。"""
        return self.dashscope_api_key or self.openai_api_key

    @property
    def chroma_path(self) -> Path:
        """Chroma 持久化目录的绝对路径。"""
        return Path(self.chroma_persist_dir).resolve()

    @property
    def upload_path(self) -> Path:
        """上传文件目录的绝对路径。"""
        return Path(self.upload_dir).resolve()

@lru_cache
def get_settings() -> Settings:
    """返回进程内缓存的配置实例。"""
    return Settings()
