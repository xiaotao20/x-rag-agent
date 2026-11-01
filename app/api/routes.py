import asyncio
import json

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user
from app.auth.models import User
from app.conversations import service as conversation_service
from app.core.database import get_db, get_session_factory
from app.dependencies import get_ingestion_service, get_retrieval_service, get_rag_agent
from app.schemas import ChatRequest, ChatResponse, IngestResponse, SearchRequest, SearchResponse, DocumentItem
from app.services.intent import DOCUMENT_ACTION_ANSWER, Intent, classify_intent

router = APIRouter()


@router.get("/health")
def health():
    """返回服务健康状态。"""
    return {"status": "ok"}

@router.post("/documents", response_model=IngestResponse, status_code=status.HTTP_201_CREATED)
async def upload_document(
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
):
    """接收上传文件，按当前用户解析入库并让 BM25 索引失效。"""
    try:
        content = await file.read()
        doc_id, count = get_ingestion_service().ingest_bytes(
            file.filename or "upload.txt", content, str(user.id)
        )
        get_retrieval_service().invalidate_index()
        return IngestResponse(document_id=doc_id, filename=file.filename or "upload.txt", chunks_created=count, message="文档已入库")
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"文档入库失败：{type(exc).__name__}: {exc}") from exc

@router.get("/documents", response_model=list[DocumentItem])
def list_documents(user: User = Depends(get_current_user)):
    """返回当前用户已入库文档及片段数。"""
    return get_retrieval_service().list_documents(str(user.id))

@router.delete("/documents/{document_id}")
def delete_document(
    document_id: str,
    user: User = Depends(get_current_user),
):
    """删除当前用户的文档向量、上传文件和 BM25 索引缓存。"""
    retrieval = get_retrieval_service()
    source = retrieval.get_document_source(document_id, str(user.id))
    count = retrieval.delete_document(document_id, str(user.id))
    if count == 0:
        raise HTTPException(status_code=404, detail="文档不存在或已删除")
    if source:
        try:
            get_ingestion_service().delete_uploaded_file(document_id, source)
        except OSError:
            pass
    retrieval.invalidate_index()
    return {"document_id": document_id, "chunks_deleted": count}

@router.post("/retrieval/search", response_model=SearchResponse)
def search(
    request: SearchRequest,
    user: User = Depends(get_current_user),
):
    """在当前用户知识库中直接检索，返回片段和分数。"""
    return SearchResponse(
        query=request.query,
        results=get_retrieval_service().search(
            request.query, request.top_k, user_id=str(user.id)
        ),
    )

@router.post("/chat", response_model=ChatResponse)
async def chat(
    request: ChatRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """登录用户的非流式问答，按意图选择直接回答或知识库 Agent。"""
    try:
        conversation, history, summary = await conversation_service.prepare_conversation(
            db, user.id, request.conversation_id, request.question
        )
        intent = classify_intent(request.question, history)
        agent = get_rag_agent()

        if intent.intent == Intent.DOCUMENT_ACTION:
            answer = DOCUMENT_ACTION_ANSWER
            sources = []
            tool_calls = []
        elif intent.intent == Intent.CHITCHAT:
            answer = await asyncio.to_thread(
                agent.ask_direct, request.question, history, summary
            )
            sources = []
            tool_calls = []
        else:
            result = await asyncio.to_thread(
                agent.ask,
                request.question,
                history,
                user_id=str(user.id),
                summary=summary,
            )
            answer = result["answer"]
            sources = result["sources"]
            tool_calls = result["tool_calls"]

        await conversation_service.save_assistant_message(
            db,
            conversation.id,
            answer,
            [source.model_dump() for source in sources],
            tool_calls,
        )
        return ChatResponse(
            question=request.question,
            conversation_id=str(conversation.id),
            answer=answer,
            sources=sources,
            tool_calls=tool_calls,
            intent=intent.intent.value,
        )
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Agent 调用失败：{type(exc).__name__}: {exc}") from exc


@router.post("/chat/stream", summary="流式问答（SSE）")
async def chat_stream(
    request: ChatRequest,
    user: User = Depends(get_current_user),
):
    """登录用户的 SSE 流式问答，保存用户和助手消息。"""
    agent = get_rag_agent()

    async def event_stream():
        async with get_session_factory()() as db:
            try:
                conversation, history, summary = await conversation_service.prepare_conversation(
                    db, user.id, request.conversation_id, request.question
                )
            except HTTPException as exc:
                yield f"data: {json.dumps({'type': 'error', 'message': str(exc.detail)}, ensure_ascii=False)}\n\n"
                return
            except Exception as exc:
                yield f"data: {json.dumps({'type': 'error', 'message': f'{type(exc).__name__}: {exc}'}, ensure_ascii=False)}\n\n"
                return

            intent = classify_intent(request.question, history)
            yield f"data: {json.dumps({'type': 'conversation', 'conversation_id': str(conversation.id), 'title': conversation.title}, ensure_ascii=False)}\n\n"
            yield f"data: {json.dumps({'type': 'intent', 'intent': intent.intent.value}, ensure_ascii=False)}\n\n"

            content_parts: list[str] = []
            sources: list[dict] = []
            tool_calls: list[dict] = []
            final_status = "stopped"
            saved = False

            try:
                if intent.intent == Intent.DOCUMENT_ACTION:
                    content_parts.append(DOCUMENT_ACTION_ANSWER)
                    final_status = "done"
                    yield f"data: {json.dumps({'type': 'token', 'content': DOCUMENT_ACTION_ANSWER}, ensure_ascii=False)}\n\n"
                elif intent.intent == Intent.CHITCHAT:
                    async for event in agent.astream_direct(
                        request.question, history, summary
                    ):
                        event_type = event.get("type")
                        if event_type == "token":
                            content_parts.append(event.get("content", ""))
                        elif event_type == "error":
                            final_status = "error"
                        yield f"data: {json.dumps(event, ensure_ascii=False, default=str)}\n\n"
                    if final_status != "error":
                        final_status = "done"
                else:
                    async for event in agent.astream(
                        request.question,
                        history,
                        user_id=str(user.id),
                        summary=summary,
                    ):
                        event_type = event.get("type")
                        if event_type == "token":
                            content_parts.append(event.get("content", ""))
                        elif event_type == "sources":
                            sources = event.get("sources") or []
                        elif event_type == "tool_start":
                            tool_calls.append(
                                {"name": event.get("name", ""), "args": event.get("args")}
                            )
                        elif event_type == "error":
                            final_status = "error"

                        if event_type == "done":
                            await conversation_service.save_assistant_message(
                                db,
                                conversation.id,
                                "".join(content_parts),
                                sources,
                                tool_calls,
                                status="done",
                            )
                            saved = True

                        yield f"data: {json.dumps(event, ensure_ascii=False, default=str)}\n\n"

                if intent.intent != Intent.KNOWLEDGE:
                    if not saved:
                        await conversation_service.save_assistant_message(
                            db,
                            conversation.id,
                            "".join(content_parts),
                            sources,
                            tool_calls,
                            status=final_status,
                        )
                        saved = True
                    yield f"data: {json.dumps({'type': 'sources', 'sources': []}, ensure_ascii=False)}\n\n"
                    if final_status != "error":
                        yield f"data: {json.dumps({'type': 'done'}, ensure_ascii=False)}\n\n"
            except Exception as exc:
                final_status = "error"
                yield f"data: {json.dumps({'type': 'error', 'message': f'{type(exc).__name__}: {exc}'}, ensure_ascii=False)}\n\n"
            finally:
                if not saved:
                    await conversation_service.save_assistant_message(
                        db,
                        conversation.id,
                        "".join(content_parts),
                        sources,
                        tool_calls,
                        status=final_status,
                    )

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
