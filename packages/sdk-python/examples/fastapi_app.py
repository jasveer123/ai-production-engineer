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
    return coupon["percent_off"]
