from typing import Literal

import uvicorn
from fastapi import FastAPI
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from ai_worker.chat import ChatFailed, ChatReply, ChatRequest, run_chat
from ai_worker.config import get_settings
from ai_worker.llm.gateway import ModelProvider, get_provider

app = FastAPI(title="ai-worker")


class Health(BaseModel):
    status: Literal["ok"]
    service: Literal["ai-worker"]


@app.get("/health")
def health() -> Health:
    return Health(status="ok", service="ai-worker")


def provider() -> ModelProvider:
    return get_provider(get_settings())


@app.post("/chat", response_model=ChatReply)
async def chat(request: ChatRequest) -> ChatReply | JSONResponse:
    try:
        return await run_chat(request, provider())
    except ChatFailed as e:
        status = 503 if e.retryable or e.reason == "no_model_configured" else 502
        return JSONResponse(
            status_code=status,
            content={"reason": e.reason, "message": str(e), "retryable": e.retryable},
        )


def run() -> None:
    settings = get_settings()
    uvicorn.run("ai_worker.main:app", host="127.0.0.1", port=settings.port, reload=True)


if __name__ == "__main__":
    run()
