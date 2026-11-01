"""会话摘要生成器，用于压缩较早的对话上下文。"""

from typing import Protocol

from langchain_core.language_models.chat_models import BaseChatModel

SUMMARY_SYSTEM_PROMPT = (
    "你是会话摘要器。请把较早的对话压缩成后续问答可用的上下文。"
    "保留用户目标、偏好、关键事实、已确认结论和未完成事项；"
    "不要回答用户问题，不要编造事实，不要复述文档全文。"
    "只输出摘要正文，不要输出 Markdown 标题或额外解释。"
)


class Summarizer(Protocol):
    """会话摘要器协议。"""

    enabled: bool

    async def summarize(
        self, previous_summary: str, messages: list[dict]
    ) -> str | None:
        """生成合并后的会话摘要。"""
        ...


class NoopSummarizer:
    """关闭摘要时的空实现。"""

    enabled = False

    async def summarize(
        self, previous_summary: str, messages: list[dict]
    ) -> str | None:
        """不生成摘要。"""
        return None


def _content_text(content) -> str:
    """把模型内容块统一为纯文本。"""
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        return "".join(
            block.get("text", "")
            for block in content
            if isinstance(block, dict) and block.get("type") == "text"
        )
    return ""


class ChatSummarizer:
    """基于聊天模型的会话摘要器。"""

    enabled = True

    def __init__(self, model: BaseChatModel, max_chars: int = 4000):
        """保存模型和摘要长度上限。"""
        self.model = model
        self.max_chars = max(500, max_chars)

    async def summarize(
        self, previous_summary: str, messages: list[dict]
    ) -> str | None:
        """合并已有摘要和新增消息，生成新的会话摘要。"""
        if not messages:
            return previous_summary or None

        formatted = "\n".join(
            f"{message.get('role', 'unknown')}: {message.get('content', '')}"
            for message in messages
            if message.get("content")
        )
        user_prompt = (
            "已有摘要：\n"
            f"{previous_summary or '无'}\n\n"
            "需要压缩的历史对话：\n"
            f"{formatted}"
        )
        try:
            response = await self.model.ainvoke(
                [
                    {"role": "system", "content": SUMMARY_SYSTEM_PROMPT},
                    {"role": "user", "content": user_prompt},
                ]
            )
            text = _content_text(response.content).strip()
            if not text:
                return None
            return text[: self.max_chars]
        except Exception:
            return None
