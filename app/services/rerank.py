from collections.abc import Sequence
from typing import Protocol

from app.schemas import SourceItem


class Reranker(Protocol):
    """Rerank 适配器协议。"""

    enabled: bool

    def rerank(self, query: str, candidates: Sequence[SourceItem], top_k: int) -> list[SourceItem]:
        """按相关性重排候选片段。"""
        ...


class NoopReranker:
    """默认实现：不重排，直接截断。"""

    enabled = False

    def rerank(self, query: str, candidates: Sequence[SourceItem], top_k: int) -> list[SourceItem]:
        """直接截断，不调用外部模型。"""
        return list(candidates[:top_k])


class DashScopeReranker:
    """百炼原生 rerank 接口；dashscope 在首次调用时才导入。"""

    enabled = True

    def __init__(self, model: str, api_key: str):
        """校验模型和 key 配置。"""
        if not model:
            raise ValueError("启用 DashScope Rerank 时必须配置 RERANK_MODEL")
        if not api_key:
            raise ValueError("启用 DashScope Rerank 时必须配置 DASHSCOPE_API_KEY 或 OPENAI_API_KEY")
        self.model = model
        self.api_key = api_key

    def rerank(self, query: str, candidates: Sequence[SourceItem], top_k: int) -> list[SourceItem]:
        """调用百炼原生 rerank 并映射回 SourceItem。"""
        if not candidates:
            return []
        try:
            import dashscope
        except ImportError as exc:
            raise RuntimeError("启用 DashScope Rerank 需要先安装 dashscope") from exc

        limit = min(top_k, len(candidates))
        response = dashscope.TextReRank.call(
            model=self.model,
            query=query,
            documents=[item.content for item in candidates],
            top_n=limit,
            return_documents=False,
            api_key=self.api_key,
        )

        results = self._results(response)
        if not results:
            return list(candidates[:limit])

        ranked: list[SourceItem] = []
        seen: set[int] = set()
        for result in results:
            index = self._field(result, "index")
            score = self._field(result, "relevance_score")
            if index is None:
                continue
            index = int(index)
            if index < 0 or index >= len(candidates) or index in seen:
                continue
            seen.add(index)
            item = candidates[index].model_copy(deep=True)
            item.score = float(score) if score is not None else None
            item.score_type = "rerank"
            item.rerank_score = item.score
            ranked.append(item)
            if len(ranked) >= limit:
                break

        return ranked or list(candidates[:limit])

    @staticmethod
    def _results(response):
        """统一解析 SDK 或字典形式的响应。"""
        status = response.get("status_code") if isinstance(response, dict) else getattr(response, "status_code", None)
        if status is not None and int(status) != 200:
            message = (
                response.get("message") or response.get("code")
                if isinstance(response, dict)
                else getattr(response, "message", None) or getattr(response, "code", None)
            )
            raise RuntimeError(f"DashScope Rerank 调用失败：{message or 'unknown error'}")

        output = response.get("output") if isinstance(response, dict) else getattr(response, "output", None)
        if output is None:
            return []
        results = output.get("results") if isinstance(output, dict) else getattr(output, "results", None)
        return results or []

    @staticmethod
    def _field(item, name: str):
        """兼容对象或字典字段读取。"""
        return item.get(name) if isinstance(item, dict) else getattr(item, name, None)


class LocalCrossEncoderReranker:
    """本地 CrossEncoder 方案；模型和依赖都在首次调用时加载。"""

    enabled = True

    def __init__(self, model_name: str, device: str = ""):
        """保存模型名和设备配置。"""
        if not model_name:
            raise ValueError("启用本地 Rerank 时必须配置 LOCAL_RERANK_MODEL")
        self.model_name = model_name
        self.device = device
        self._model = None

    def _load(self):
        """懒加载 CrossEncoder 模型。"""
        if self._model is None:
            try:
                from sentence_transformers import CrossEncoder
            except ImportError as exc:
                raise RuntimeError("启用本地 Rerank 需要先安装 sentence-transformers") from exc
            kwargs = {"device": self.device} if self.device else {}
            self._model = CrossEncoder(self.model_name, **kwargs)
        return self._model

    def rerank(self, query: str, candidates: Sequence[SourceItem], top_k: int) -> list[SourceItem]:
        """用本地 CrossEncoder 打分并排序。"""
        if not candidates:
            return []
        model = self._load()
        scores = model.predict([(query, item.content) for item in candidates])
        ranked = sorted(zip(candidates, scores), key=lambda pair: float(pair[1]), reverse=True)

        results: list[SourceItem] = []
        for item, score in ranked[: min(top_k, len(candidates))]:
            ranked_item = item.model_copy(deep=True)
            ranked_item.score = float(score)
            ranked_item.score_type = "rerank"
            ranked_item.rerank_score = float(score)
            results.append(ranked_item)
        return results
