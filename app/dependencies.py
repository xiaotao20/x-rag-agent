from functools import lru_cache
from langchain_chroma import Chroma
from langchain_openai import ChatOpenAI, OpenAIEmbeddings
from app.core.config import get_settings
from app.services.retrieval import RetrievalService
from app.services.ingestion import IngestionService
from app.services.query_rewrite import LlmQueryRewriter, NoopQueryRewriter
from app.services.rerank import DashScopeReranker, LocalCrossEncoderReranker, NoopReranker
from app.services.summarization import ChatSummarizer, NoopSummarizer
from app.agents.rag_agent import RagAgent

@lru_cache
def get_embeddings():
    """创建百炼兼容的 Embedding 客户端。"""
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
    """打开持久化 Chroma 集合。"""
    s = get_settings()
    s.chroma_path.mkdir(parents=True, exist_ok=True)
    return Chroma(collection_name=s.chroma_collection, embedding_function=get_embeddings(), persist_directory=str(s.chroma_path))

@lru_cache
def get_reranker():
    """按配置选择 Noop、DashScope 或本地 Reranker。"""
    s = get_settings()
    if not s.rerank_enabled or s.rerank_provider == "none":
        return NoopReranker()
    if s.rerank_provider == "dashscope":
        return DashScopeReranker(s.rerank_model, s.rerank_api_key)
    if s.rerank_provider == "local":
        return LocalCrossEncoderReranker(s.local_rerank_model, s.local_rerank_device)
    raise ValueError(f"不支持的 RERANK_PROVIDER：{s.rerank_provider}")

@lru_cache
def get_query_rewriter():
    """按配置选择 Noop 或 LLM Query 改写器。"""
    s = get_settings()
    if not s.query_rewrite_enabled:
        return NoopQueryRewriter()
    model = ChatOpenAI(
        model=s.query_rewrite_model or s.chat_model,
        api_key=s.openai_api_key,
        base_url=s.openai_base_url,
        temperature=0,
        max_tokens=512,
        request_timeout=10,
        max_retries=0,
    )
    return LlmQueryRewriter(
        model,
        max_variants=s.query_rewrite_max_variants,
        min_chars=s.query_rewrite_min_chars,
    )


@lru_cache
def get_summarizer():
    """按配置选择窗口式 Noop 或聊天模型摘要器。"""
    s = get_settings()
    if not s.summary_enabled:
        return NoopSummarizer()
    model = ChatOpenAI(
        model=s.summary_model or s.chat_model,
        api_key=s.openai_api_key,
        base_url=s.openai_base_url,
        temperature=0,
        max_tokens=512,
        request_timeout=s.summary_request_timeout_s,
        max_retries=0,
    )
    return ChatSummarizer(model, max_chars=s.summary_max_chars)


@lru_cache
def get_retrieval_service():
    """组装混合检索、Query 改写和 Rerank。"""
    s = get_settings()
    return RetrievalService(
        get_vector_store(),
        default_top_k=s.retrieval_top_k,
        reranker=get_reranker(),
        rerank_top_n=s.rerank_top_n,
        hybrid_enabled=s.hybrid_enabled,
        hybrid_candidate_k=s.hybrid_candidate_k,
        hybrid_rrf_k=s.hybrid_rrf_k,
        hybrid_dense_weight=s.hybrid_dense_weight,
        hybrid_bm25_weight=s.hybrid_bm25_weight,
        query_rewriter=get_query_rewriter(),
        hybrid_variant_weight=s.hybrid_variant_weight,
    )

@lru_cache
def get_ingestion_service():
    """创建文档解析入库服务。"""
    s = get_settings()
    return IngestionService(get_vector_store(), s.upload_path, s.chunk_size, s.chunk_overlap, s.max_upload_mb)

@lru_cache
def get_rag_agent():
    """创建带知识库检索工具的 Agent。"""
    s = get_settings()
    model = ChatOpenAI(model=s.chat_model, api_key=s.openai_api_key, base_url=s.openai_base_url, temperature=0)
    return RagAgent(model, get_retrieval_service())
