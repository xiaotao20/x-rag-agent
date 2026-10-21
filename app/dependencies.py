from functools import lru_cache
from langchain_chroma import Chroma
from langchain_openai import ChatOpenAI, OpenAIEmbeddings
from app.core.config import get_settings
from app.services.retrieval import RetrievalService
from app.services.ingestion import IngestionService
from app.agents.rag_agent import RagAgent

@lru_cache
def get_embeddings():
    s = get_settings()
    return OpenAIEmbeddings(
        model=s.embedding_model,
        api_key=s.openai_api_key,
        base_url=s.openai_base_url,
        # 百炼兼容接口只接受字符串输入，不接受 LangChain 默认发送的 token ID 数组。
        check_embedding_ctx_length=False,
        # 百炼单请求批量上限会随文本长度收紧（800 字约 20 条），10 条留足余量。
        # 一次性发送片段数
        chunk_size=10,
    )

@lru_cache
def get_vector_store():
    s = get_settings()
    s.chroma_path.mkdir(parents=True, exist_ok=True)
    return Chroma(collection_name=s.chroma_collection, embedding_function=get_embeddings(), persist_directory=str(s.chroma_path))

@lru_cache
def get_retrieval_service():
    return RetrievalService(get_vector_store(), get_settings().retrieval_top_k)

@lru_cache
def get_ingestion_service():
    s = get_settings()
    return IngestionService(get_vector_store(), s.upload_path, s.chunk_size, s.chunk_overlap, s.max_upload_mb)

@lru_cache
def get_rag_agent():
    s = get_settings()
    model = ChatOpenAI(model=s.chat_model, api_key=s.openai_api_key, base_url=s.openai_base_url, temperature=0)
    return RagAgent(model, get_retrieval_service())
