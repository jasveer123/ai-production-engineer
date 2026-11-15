"""Answers a question from workspace context the platform already collected (ADR-010)."""

import json
import re
from typing import Any, Literal

from pydantic import BaseModel, Field, ValidationError

from ai_worker.guardrails import screen_item
from ai_worker.investigate import load_prompt
from ai_worker.llm.gateway import ModelError, ModelProvider

PROMPT_VERSION = "chat_v1"
MAX_ITEMS = 60

OUTPUT_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "answer": {"type": "string"},
        "sources": {"type": "array", "items": {"type": "string"}},
    },
    "required": ["answer", "sources"],
    "additionalProperties": False,
}


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(max_length=8000)


class ContextItem(BaseModel):
    ref: str = Field(max_length=20)
    kind: str = Field(max_length=40)
    title: str = Field(max_length=300)
    content: str = Field(max_length=20000)


class ChatRequest(BaseModel):
    messages: list[ChatMessage] = Field(min_length=1, max_length=30)
    items: list[ContextItem] = Field(max_length=MAX_ITEMS)


class ChatReply(BaseModel):
    answer: str
    sources: list[str]
    model: str | None = None
    input_tokens: int = 0
    output_tokens: int = 0
    cost_usd: float = 0.0
    notes: list[str] = Field(default_factory=list)


class ChatFailed(Exception):
    def __init__(self, reason: str, message: str, retryable: bool) -> None:
        super().__init__(message)
        self.reason = reason
        self.retryable = retryable


_DELIMITERS = re.compile(r"</(history|context|item)>", re.IGNORECASE)


def _escape(text: str) -> str:
    return _DELIMITERS.sub(lambda m: f"<\\/{m.group(1)}>", text)


def build_user_message(request: ChatRequest) -> tuple[str, list[str]]:
    notes: list[str] = []
    lines = ["<history>"]
    lines.extend(f"{m.role}: {_escape(m.content)}" for m in request.messages)
    lines += ["</history>", "", "<context>"]
    for item in request.items:
        screened = screen_item(item.ref, item.title, item.content)
        if screened.injection:
            notes.append(
                f"{item.ref} contains instruction-like text; the model was told it is data"
            )
        lines += [
            f'<item id="{item.ref}" kind="{item.kind}">',
            f"title: {_escape(item.title)}",
            _escape(screened.content),
            "</item>",
        ]
    lines += ["</context>", "", "Answer the last user turn as JSON matching the schema."]
    return "\n".join(lines), notes


async def run_chat(request: ChatRequest, provider: ModelProvider) -> ChatReply:
    user, notes = build_user_message(request)
    try:
        call = await provider.structured(
            system=load_prompt(PROMPT_VERSION),
            user=user,
            schema=OUTPUT_SCHEMA,
            purpose="Chat",
        )
    except ModelError as e:
        raise ChatFailed(e.reason, str(e), e.retryable) from e
    try:
        data = json.loads(call.text)
        answer = str(data["answer"]).strip()
        sources = [s for s in data.get("sources", []) if isinstance(s, str)]
    except (ValueError, KeyError, TypeError, ValidationError) as e:
        raise ChatFailed("bad_model_output", "The model reply could not be read", True) from e
    known = {i.ref for i in request.items}
    kept = [s for s in dict.fromkeys(sources) if s in known]
    if len(kept) != len(set(sources)):
        notes.append("Some cited items were not in the context and were dropped")
    if not answer:
        raise ChatFailed("bad_model_output", "The model returned an empty answer", True)
    return ChatReply(
        answer=answer,
        sources=kept,
        model=call.model,
        input_tokens=call.input_tokens,
        output_tokens=call.output_tokens,
        cost_usd=call.cost_usd,
        notes=notes,
    )
