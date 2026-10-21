from functools import lru_cache
from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
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
    max_upload_mb: int = 20
    cors_origins: str = "http://localhost:3000,http://127.0.0.1:3000"
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore", case_sensitive=False)

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def chroma_path(self) -> Path:
        return Path(self.chroma_persist_dir).resolve()

    @property
    def upload_path(self) -> Path:
        return Path(self.upload_dir).resolve()

@lru_cache
def get_settings() -> Settings:
    return Settings()
