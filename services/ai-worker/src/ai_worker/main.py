from typing import Literal

import uvicorn
from fastapi import FastAPI
from pydantic import BaseModel

from ai_worker.config import get_settings

app = FastAPI(title="ai-worker")


class Health(BaseModel):
    status: Literal["ok"]
    service: Literal["ai-worker"]


@app.get("/health")
def health() -> Health:
    return Health(status="ok", service="ai-worker")


def run() -> None:
    settings = get_settings()
    uvicorn.run("ai_worker.main:app", host="127.0.0.1", port=settings.port, reload=True)


if __name__ == "__main__":
    run()
