# APE_TOKEN=ape_live_... APE_ENDPOINT=http://localhost:4000 uvicorn examples.fastapi_app:app
import logging

import ape_agent

ape_agent.start(service="example-fastapi", environment="development")

from fastapi import FastAPI  # noqa: E402

from ape_agent.integrations import ApeASGIMiddleware  # noqa: E402

app = FastAPI()
app.add_middleware(ApeASGIMiddleware)
log = logging.getLogger("shop")


@app.get("/")
def home() -> dict[str, str]:
    log.info("home page served")
    return {"ok": "yes"}


@app.get("/checkout")
def checkout() -> float:
    coupon = None
    return coupon["percent_off"]  # TypeError: an incident opens for it
