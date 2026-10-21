import json

from fastapi import APIRouter, File, HTTPException, UploadFile, status
from fastapi.responses import StreamingResponse
from app.dependencies import get_ingestion_service, get_retrieval_service, get_rag_agent
from app.schemas import ChatRequest, ChatResponse, IngestResponse, SearchRequest, SearchResponse, DocumentItem

router = APIRouter()

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
def chat(request: ChatRequest):
    try:
        result = get_rag_agent().ask(request.question)
        return ChatResponse(question=request.question, answer=result["answer"], sources=result["sources"], tool_calls=result["tool_calls"])
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Agent 调用失败：{type(exc).__name__}: {exc}") from exc

@router.post("/chat/stream", summary="流式问答（SSE）")
async def chat_stream(request: ChatRequest):
    agent = get_rag_agent()

    async def event_stream():
        async for event in agent.astream(request.question):
            yield f"data: {json.dumps(event, ensure_ascii=False, default=str)}\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
