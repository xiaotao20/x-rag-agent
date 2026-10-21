from pathlib import Path
from uuid import uuid4
from langchain_core.documents import Document
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_community.document_loaders import PyPDFLoader, TextLoader
from langchain_chroma import Chroma

SUPPORTED = {".txt", ".md", ".pdf"}

class IngestionService:
    def __init__(self, vector_store: Chroma, upload_dir: Path, chunk_size: int, chunk_overlap: int, max_upload_mb: int):
        self.vector_store = vector_store
        self.upload_dir = upload_dir
        self.upload_dir.mkdir(parents=True, exist_ok=True)
        self.splitter = RecursiveCharacterTextSplitter(
            chunk_size=chunk_size,
            chunk_overlap=min(chunk_overlap, max(0, chunk_size - 1)),
            add_start_index=True,
        )
        self.max_upload_bytes = max_upload_mb * 1024 * 1024

    def delete_uploaded_file(self, document_id: str, source: str) -> None:
        safe_name = Path(source).name.replace("/", "_").replace("\\", "_")
        (self.upload_dir / f"{document_id}_{safe_name}").unlink(missing_ok=True)

    def ingest_bytes(self, filename: str, content: bytes) -> tuple[str, int]:
        suffix = Path(filename).suffix.lower()
        if suffix not in SUPPORTED:
            raise ValueError("仅支持 .txt、.md、.pdf 文件")
        if not content:
            raise ValueError("上传文件为空")
        if len(content) > self.max_upload_bytes:
            raise ValueError(f"文件超过 {self.max_upload_bytes // (1024 * 1024)} MB 限制")

        document_id = str(uuid4())
        safe_name = Path(filename).name.replace("/", "_").replace("\\", "_")
        path = self.upload_dir / f"{document_id}_{safe_name}"
        path.write_bytes(content)
        try:
            docs = PyPDFLoader(str(path)).load() if suffix == ".pdf" else TextLoader(str(path), encoding="utf-8", autodetect_encoding=True).load()
            if not docs or not any(d.page_content.strip() for d in docs):
                raise ValueError("没有提取到文本；扫描版 PDF 需要 OCR")
            normalized = [
                Document(page_content=d.page_content, metadata={
                    "source": safe_name,
                    "document_id": document_id,
                    "page": int(d.metadata.get("page", 0)),
                })
                for d in docs
            ]
            chunks = [c for c in self.splitter.split_documents(normalized) if c.page_content.strip()]
            if not chunks:
                raise ValueError("文本切分后没有内容")
            for i, chunk in enumerate(chunks):
                chunk.metadata.update({"source": safe_name, "document_id": document_id, "chunk_index": i})
            self.vector_store.add_documents(chunks, ids=[f"{document_id}:{i}" for i in range(len(chunks))])
            return document_id, len(chunks)
        except Exception:
            # Leave original upload for troubleshooting only after successful ingestion.
            path.unlink(missing_ok=True)
            raise
