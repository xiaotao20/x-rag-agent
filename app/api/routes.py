import json

from fastapi import APIRouter, File, HTTPException, UploadFile, status
from fastapi.responses import StreamingResponse
from app.dependencies import get_ingestion_service, get_retrieval_service, get_rag_agent
from app.schemas import (
    ChatRequest,
    ChatResponse,
    IngestResponse,
    ResumeRequest,
    SearchRequest,
    SearchResponse,
    DocumentItem,
)
from app.services.sessions import effective_thread_id, is_ephemeral, validate_thread_id

router = APIRouter()


def _sse(event: dict) -> str:
    return f"data: {json.dumps(event, ensure_ascii=False, default=str)}\n\n"


async def _cleanup_ephemeral(agent, thread_id: str) -> None:
    if not is_ephemeral(thread_id):
        return
    try:
        await agent.adelete_thread(thread_id)
    except BaseException:
        pass


async def _validate_resume(agent, request: ResumeRequest) -> None:
    if not validate_thread_id(request.thread_id):
        raise HTTPException(status_code=400, detail="thread_id 格式不合法")

    state = await agent.aget_state(request.thread_id)
    interrupts = getattr(state, "interrupts", ()) if state else ()
    if not interrupts:
        raise HTTPException(
            status_code=409,
            detail="没有待确认的工具调用，会话可能已完成或已过期",
        )

    value = getattr(interrupts[0], "value", {})
    actions = value.get("action_requests", []) if isinstance(value, dict) else []
    configs = value.get("review_configs", []) if isinstance(value, dict) else []
    if len(request.decisions) != len(actions):
        raise HTTPException(
            status_code=400,
            detail=f"decisions 数量应为 {len(actions)}，实际为 {len(request.decisions)}",
        )

    for index, decision in enumerate(request.decisions):
        if not isinstance(decision, dict):
            raise HTTPException(status_code=400, detail=f"第 {index + 1} 个 decision 必须是对象")
        decision_type = decision.get("type")
        allowed = configs[index].get("allowed_decisions", []) if index < len(configs) else []
        if decision_type not in allowed:
            raise HTTPException(
                status_code=400,
                detail=f"第 {index + 1} 个 decision 类型 {decision_type!r} 不被允许",
            )


@router.get("/health")
def health():
    return {"status": "ok"}

@router.post("/documents", response_model=IngestResponse, status_code=status.HTTP_201_CREATED)
async def upload_document(file: UploadFile = File(...)):
    try:
        content = await file.read()
        doc_id, count = get_ingestion_service().ingest_bytes(file.filename or "upload.txt", content)
        return IngestResponse(document_id=doc_id, filename=file.filename or "upload.txt", chunks_created=count, message="文档已入库")
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"文档入库失败：{type(exc).__name__}: {exc}") from exc

@router.get("/documents", response_model=list[DocumentItem])
def list_documents():
    return get_retrieval_service().list_documents()

@router.delete("/documents/{document_id}")
def delete_document(document_id: str):
    retrieval = get_retrieval_service()
    source = retrieval.get_document_source(document_id)
    count = retrieval.delete_document(document_id)
    if count == 0:
        raise HTTPException(status_code=404, detail="文档不存在或已删除")
    if source:
        try:
            get_ingestion_service().delete_uploaded_file(document_id, source)
        except OSError:
            pass
    return {"document_id": document_id, "chunks_deleted": count}

@router.post("/retrieval/search", response_model=SearchResponse)
def search(request: SearchRequest):
    return SearchResponse(query=request.query, results=get_retrieval_service().search(request.query, request.top_k))

@router.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    thread_id = effective_thread_id(request.thread_id, request.memory)
    agent = get_rag_agent()
    try:
        result = await agent.aask(request.question, thread_id)
    except Exception as exc:
        await _cleanup_ephemeral(agent, thread_id)
        raise HTTPException(status_code=502, detail=f"Agent 调用失败：{type(exc).__name__}: {exc}") from exc

    if result["status"] == "interrupted":
        return ChatResponse(
            question=request.question,
            thread_id=thread_id,
            status="interrupted",
            interrupt=result["interrupt"],
        )

    await _cleanup_ephemeral(agent, thread_id)
    return ChatResponse(
        question=request.question,
        thread_id=thread_id,
        status="completed",
        answer=result["answer"],
        sources=result["sources"],
        tool_calls=result["tool_calls"],
    )

@router.post("/chat/resume", response_model=ChatResponse)
async def chat_resume(request: ResumeRequest):
    agent = get_rag_agent()
    await _validate_resume(agent, request)
    try:
        result = await agent.aresume_result(request.thread_id, request.decisions)
    except Exception as exc:
        await _cleanup_ephemeral(agent, request.thread_id)
        raise HTTPException(status_code=502, detail=f"Agent 恢复失败：{type(exc).__name__}: {exc}") from exc

    if result["status"] == "interrupted":
        return ChatResponse(
            question=result.get("question", ""),
            thread_id=request.thread_id,
            status="interrupted",
            interrupt=result["interrupt"],
        )

    await _cleanup_ephemeral(agent, request.thread_id)
    return ChatResponse(
        question=result.get("question", ""),
        thread_id=request.thread_id,
        status="completed",
        answer=result["answer"],
        sources=result["sources"],
        tool_calls=result["tool_calls"],
    )

@router.post("/chat/stream", summary="流式问答（SSE，支持人工确认）")
async def chat_stream(request: ChatRequest):
    thread_id = effective_thread_id(request.thread_id, request.memory)
    agent = get_rag_agent()

    async def event_stream():
        yield _sse({"type": "thread", "thread_id": thread_id, "memory": request.memory})
        interrupted = False
        try:
            async for event in agent.astream(request.question, thread_id):
                if event.get("type") == "interrupt":
                    interrupted = True
                yield _sse(event)
        except Exception as exc:
            yield _sse({"type": "error", "message": f"{type(exc).__name__}: {exc}"})
        finally:
            if not interrupted:
                await _cleanup_ephemeral(agent, thread_id)

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )

@router.post("/chat/stream/resume", summary="继续流式问答（人工确认后）")
async def chat_stream_resume(request: ResumeRequest):
    agent = get_rag_agent()
    await _validate_resume(agent, request)

    async def event_stream():
        yield _sse({"type": "thread", "thread_id": request.thread_id, "memory": request.memory})
        interrupted = False
        try:
            async for event in agent.aresume(request.thread_id, request.decisions):
                if event.get("type") == "interrupt":
                    interrupted = True
                yield _sse(event)
        except Exception as exc:
            yield _sse({"type": "error", "message": f"{type(exc).__name__}: {exc}"})
        finally:
            if not interrupted:
                await _cleanup_ephemeral(agent, request.thread_id)

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
