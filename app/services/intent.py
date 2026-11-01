"""轻量规则意图识别：默认把问题当作知识库问答。"""

import re
import unicodedata
from dataclasses import dataclass
from enum import Enum


class Intent(str, Enum):
    """当前支持的规则意图。"""

    KNOWLEDGE = "knowledge"
    CHITCHAT = "chitchat"
    DOCUMENT_ACTION = "document_action"


@dataclass(frozen=True)
class IntentResult:
    """意图分类结果及命中原因。"""

    intent: Intent
    reason: str


DOCUMENT_ACTION_ANSWER = (
    "文档管理可以在左侧「资料库」页面完成：点击「新增文档」上传、查看文档列表或删除文档。"
    "上传后系统会自动解析、切分，并加入当前账号的知识库。"
)

_CHITCHAT_PATTERNS = [
    re.compile(pattern, re.IGNORECASE)
    for pattern in (
        r"你好[呀啊哦嘛呢吧啦~～!！。.\s]*",
        r"您好[呀啊哦嘛呢吧啦~～!！。.\s]*",
        r"hi[!！。.\s]*",
        r"hello[!！。.\s]*",
        r"嗨[呀啊哦~～!！。.\s]*",
        r"哈喽[~～!！。.\s]*",
        r"在吗[?？!！。.\s]*",
        r"在么[?？!！。.\s]*",
        r"谢谢[呀啊哦啦~～!！。.\s]*",
        r"感谢[呀啊哦啦~～!！。.\s]*",
        r"多谢[呀啊哦啦~～!！。.\s]*",
        r"再见[呀啊哦啦~～!！。.\s]*",
        r"拜拜[~～!！。.\s]*",
        r"晚安[~～!！。.\s]*",
        r"早上好[~～!！。.\s]*",
        r"晚上好[~～!！。.\s]*",
        r"你是谁[?？!！。.\s]*",
        r"你叫什么(名字)?[?？!！。.\s]*",
        r"你能做什么[?？!！。.\s]*",
        r"介绍一下你自己[!！。.\s]*",
        r"好的[呀啊哦啦~～!！。.\s]*",
        r"嗯[嗯哦~～!！。.\s]*",
        r"收到[~～!！。.\s]*",
        r"ok[!！。.\s]*",
        r"okay[!！。.\s]*",
    )
]

_DOCUMENT_TERMS = ("文档", "文件", "知识库", "资料", "pdf", "md", "txt")
_DOCUMENT_ACTIONS = (
    "上传",
    "删除",
    "移除",
    "刷新",
    "列表",
    "清空",
    "导入",
    "更新",
    "新增"
)


def _normalize(question: str) -> str:
    """规范化空白和全半角字符。"""
    normalized = unicodedata.normalize("NFKC", question or "")
    return " ".join(normalized.split()).strip()


def classify_intent(
    question: str, history: list[dict] | None = None
) -> IntentResult:
    """用规则判断问题类型，未命中时默认按知识库问答处理。"""
    text = _normalize(question)
    if not text:
        return IntentResult(Intent.KNOWLEDGE, "empty_question")

    lowered = text.lower()
    for pattern in _CHITCHAT_PATTERNS:
        if pattern.fullmatch(text):
            return IntentResult(Intent.CHITCHAT, "chitchat_pattern")

    has_document_term = any(term in lowered for term in _DOCUMENT_TERMS)
    has_document_action = any(action in lowered for action in _DOCUMENT_ACTIONS)
    if has_document_term and has_document_action:
        return IntentResult(Intent.DOCUMENT_ACTION, "document_action_pattern")

    return IntentResult(Intent.KNOWLEDGE, "default_knowledge")
