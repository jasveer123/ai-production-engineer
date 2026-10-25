from __future__ import annotations

import asyncio
import gzip
import json
import logging
import threading
from typing import Any

import pytest

import ape_agent
from ape_agent._redact import redact_text, redact_value
from ape_agent._transport import Transport
from ape_agent.integrations import ApeASGIMiddleware, ApeWSGIMiddleware


class FakeServer:
    def __init__(self, statuses: list[int] | None = None) -> None:
        self.calls: list[tuple[str, list[Any], dict[str, str]]] = []
        self.statuses = statuses or []
        self.lock = threading.Lock()

    def __call__(self, url: str, body: bytes, headers: dict[str, str]) -> int:
        if headers.get("Content-Encoding") == "gzip":
            body = gzip.decompress(body)
        with self.lock:
            self.calls.append((url, json.loads(body), headers))
            return self.statuses.pop(0) if self.statuses else 202

    def items(self, kind: str) -> list[dict[str, Any]]:
        return [
            i
            for url, batch, _ in self.calls
            if url.endswith(f"/v1/{kind}")
            for i in batch
        ]


@pytest.fixture()
def server():
    srv = FakeServer()
    assert ape_agent.start(
        token="ape_live_test",
        endpoint="http://ingest.test",
        service="shop",
        environment="test",
        tracing=False,
        capture_uncaught=True,
        _sender=srv,
    )
    yield srv
    ape_agent.shutdown()


def test_logging_records_are_sent_redacted(server: FakeServer) -> None:
    logging.getLogger("app").warning("login failed password=hunter22 for %s", "x@y.z")
    ape_agent.log("info", "hello", order_id=7, api_key="abc")
    assert ape_agent.flush()
    logs = server.items("logs")
    warn = next(l for l in logs if l["level"] == "warn")
    assert "hunter22" not in warn["message"]
    assert warn["service"] == "shop" and warn["logger"] == "app"
    hello = next(l for l in logs if l["message"] == "hello")
    assert hello["order_id"] == 7 and hello["api_key"] == "[REDACTED:secret]"
    assert server.calls[0][2]["Authorization"] == "Bearer ape_live_test"
    assert server.calls[0][2]["x-ape-sdk"] == f"python/{ape_agent.VERSION}"


def test_capture_exception_sends_frames_innermost_first(server: FakeServer) -> None:
    def inner() -> None:
        raise ValueError("bad qty 3")

    try:
        inner()
    except ValueError:
        event_id = ape_agent.capture_exception(route="/cart", method="POST", user="u1")
    ape_agent.flush()
    [err] = server.items("errors")
    assert err["event_id"] == event_id
    assert err["type"] == "ValueError" and err["message"] == "bad qty 3"
    assert err["stack"][0].startswith("at inner (")
    assert err["context"] == {"user": "u1"}


def test_logged_exceptions_carry_exception_fields(server: FakeServer) -> None:
    try:
        _ = 1 / 0
    except ZeroDivisionError:
        logging.getLogger("app").exception("division failed")
    ape_agent.flush()
    rec = next(l for l in server.items("logs") if l["message"] == "division failed")
    assert rec["level"] == "error" and rec["exception"]["type"] == "ZeroDivisionError"


def test_thread_exceptions_are_captured(server: FakeServer) -> None:
    def boom() -> None:
        raise RuntimeError("in thread")

    t = threading.Thread(target=boom)
    t.start()
    t.join()
    ape_agent.flush()
    assert any(
        e["type"] == "RuntimeError" and e["handled"] is False
        for e in server.items("errors")
    )


def test_asgi_and_wsgi_middleware_report_and_reraise(server: FakeServer) -> None:
    async def app(scope: Any, receive: Any, send: Any) -> None:
        raise KeyError("missing")

    with pytest.raises(KeyError):
        asyncio.run(
            ApeASGIMiddleware(app)(
                {"type": "http", "path": "/orders/1", "method": "GET"}, None, None
            )
        )

    def wsgi(environ: Any, start_response: Any) -> Any:
        raise TypeError("nope")

    with pytest.raises(TypeError):
        ApeWSGIMiddleware(wsgi)({"PATH_INFO": "/x", "REQUEST_METHOD": "POST"}, None)
    ape_agent.flush()
    errors = server.items("errors")
    assert [(e["type"], e["route"]) for e in errors] == [
        ("KeyError", "/orders/1"),
        ("TypeError", "/x"),
    ]


def test_transport_retries_then_turns_off_on_401() -> None:
    warnings: list[str] = []
    srv = FakeServer(statuses=[503, 202, 401])
    t = Transport(
        "http://x", "t", "python/test", warnings.append, flush_interval=0.05, sender=srv
    )
    t.enqueue("logs", {"a": 1})
    assert t.flush()
    assert len(srv.calls) == 2
    t.enqueue("logs", {"a": 2})
    t.flush()
    assert t.disabled and "401" in warnings[-1]
    t.enqueue("logs", {"a": 3})
    t.flush()
    assert len(srv.calls) == 3
    t.close()


def test_queue_is_bounded() -> None:
    warnings: list[str] = []
    t = Transport(
        "http://x",
        "t",
        "s",
        warnings.append,
        flush_interval=60,
        max_queue=3,
        sender=FakeServer(),
    )
    for i in range(6):
        t.enqueue("logs", i)
    assert t.dropped == 3 and len(warnings) == 1
    t.close(0.5)


def test_redaction() -> None:
    assert (
        redact_text("Bearer abcdefghijklmnop and ape_live_ABCDEFGHIJKLMNOPQRS")
        == "Bearer [REDACTED:token] and [REDACTED:token]"
    )
    assert redact_value({"headers": {"cookie": "a", "ok": "b"}}) == {
        "headers": {"cookie": "[REDACTED:secret]", "ok": "b"}
    }


def test_start_without_token_is_a_no_op(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("APE_TOKEN", raising=False)
    assert ape_agent.start(debug=False) is False
    assert ape_agent.capture_exception(ValueError("x")) is None
