"""Send logs, errors and traces from Python apps to AI Production Engineer (Way 1).

    import ape_agent
    ape_agent.start(service="checkout-api")   # reads APE_TOKEN and APE_ENDPOINT

Never raises into your app. Standard library only; `pip install ape-agent[otel]` adds tracing.
"""

from __future__ import annotations

import atexit
import datetime as _dt
import logging
import os
import platform
import socket
import sys
import threading
import traceback
import uuid
from typing import Any, ClassVar

from ._redact import redact_text, redact_value
from ._transport import Sender, Transport

__all__ = [
    "VERSION",
    "ApeLogHandler",
    "capture_exception",
    "flush",
    "is_started",
    "log",
    "shutdown",
    "start",
]

VERSION = "0.1.0"
_SDK_HEADER = f"python/{VERSION}"
_LEVELS = {"trace": 0, "debug": 1, "info": 2, "warn": 3, "error": 4, "fatal": 5}
_internal = logging.getLogger("ape_agent")
_internal.propagate = False
_internal.addHandler(logging.StreamHandler(sys.stderr))


class _State:
    def __init__(
        self,
        transport: Transport,
        service: str,
        environment: str,
        release: str | None,
        min_level: str,
    ) -> None:
        self.transport = transport
        self.service = service
        self.environment = environment
        self.release = release
        self.min_level = min_level
        self.host = socket.gethostname()
        self.undo: list[Any] = []
        self.tracer_provider: Any = None


_state: _State | None = None
_guard = threading.local()


def _now() -> str:
    return _dt.datetime.now(_dt.timezone.utc).isoformat()


def _trace_context() -> tuple[str | None, str | None]:
    try:
        from opentelemetry import trace  # type: ignore[import-not-found]

        ctx = trace.get_current_span().get_span_context()
        if ctx and ctx.trace_id:
            return format(ctx.trace_id, "032x"), format(ctx.span_id, "016x")
    except Exception:  # noqa: BLE001, S110 (OpenTelemetry not installed or no span)
        pass
    return None, None


def start(
    token: str | None = None,
    service: str | None = None,
    environment: str | None = None,
    release: str | None = None,
    endpoint: str | None = None,
    capture_logging: bool = True,
    capture_uncaught: bool = True,
    tracing: bool = True,
    min_level: str = "info",
    debug: bool = True,
    _sender: Sender | None = None,
) -> bool:
    """Starts the agent. Call it once, as early as possible. Returns False when no token is set."""
    global _state
    if _state is not None:
        return True
    _internal.disabled = not debug

    def warn(message: str) -> None:
        _internal.warning("[ape-agent] %s", message)

    token = token or os.environ.get("APE_TOKEN")
    if not token:
        warn("no token (set APE_TOKEN or pass token=...); nothing will be sent")
        return False
    endpoint = (
        endpoint or os.environ.get("APE_ENDPOINT") or "http://localhost:4000"
    ).rstrip("/")
    service = (
        service
        or os.environ.get("APE_SERVICE")
        or os.environ.get("OTEL_SERVICE_NAME")
        or os.path.basename(sys.argv[0] or "python-app").removesuffix(".py")
        or "python-app"
    )
    environment = (
        environment
        or os.environ.get("APE_ENVIRONMENT")
        or os.environ.get("ENVIRONMENT")
        or "production"
    )
    release = release or os.environ.get("APE_RELEASE")

    transport = Transport(endpoint, token, _SDK_HEADER, warn, sender=_sender)
    state = _State(transport, service, environment, release, min_level)
    _state = state

    if tracing:
        state.tracer_provider = _start_tracing(
            endpoint, token, service, environment, release, warn
        )
    if capture_logging:
        handler = ApeLogHandler()
        root = logging.getLogger()
        root.addHandler(handler)
        if root.level > logging.INFO or root.level == logging.NOTSET:
            root.setLevel(logging.INFO)
        state.undo.append(lambda: root.removeHandler(handler))
    if capture_uncaught:
        _hook_exceptions(state)
    atexit.register(_at_exit)
    return True


def is_started() -> bool:
    return _state is not None


def log(level: str, message: str, **attributes: Any) -> None:
    """Sends one log line. Attributes are redacted before they leave the process."""
    state = _state
    if (
        state is None
        or _LEVELS.get(level, 2) < _LEVELS.get(state.min_level, 2)
        or getattr(_guard, "inside", False)
    ):
        return
    _guard.inside = True
    try:
        trace_id, span_id = _trace_context()
        record: dict[str, Any] = {
            "timestamp": _now(),
            "level": level,
            "message": redact_text(str(message))[:32_000],
            "service": state.service,
            "environment": state.environment,
            "host": state.host,
            "trace_id": trace_id,
            "span_id": span_id,
        }
        if state.release:
            record["release"] = state.release
        record.update(redact_value(attributes))
        state.transport.enqueue(
            "logs", {k: v for k, v in record.items() if v is not None}
        )
    except Exception:  # noqa: BLE001, S110 (never break the app)
        pass
    finally:
        _guard.inside = False


def capture_exception(
    error: BaseException | None = None,
    *,
    route: str | None = None,
    method: str | None = None,
    status_code: int | None = None,
    handled: bool = True,
    level: str = "error",
    **context: Any,
) -> str | None:
    """Reports an exception (the current one when `error` is None). Returns the event id."""
    state = _state
    if state is None:
        return None
    if error is None:
        error = sys.exc_info()[1]
        if error is None:
            return None
    _guard.inside = True
    try:
        event_id = str(uuid.uuid4())
        trace_id, span_id = _trace_context()
        stack = "".join(
            traceback.format_exception(type(error), error, error.__traceback__)
        )
        event = {
            "event_id": event_id,
            "timestamp": _now(),
            "service": state.service,
            "environment": state.environment,
            "release": state.release,
            "level": level,
            "type": type(error).__name__,
            "message": redact_text(str(error))[:4000],
            "stack": _frames(error) or redact_text(stack),
            "trace_id": trace_id,
            "span_id": span_id,
            "route": route,
            "method": method,
            "status_code": status_code,
            "host": state.host,
            "runtime": f"python {platform.python_version()}",
            "handled": handled,
            "context": redact_value(context),
        }
        state.transport.enqueue(
            "errors", {k: v for k, v in event.items() if v is not None}
        )
        return event_id
    except Exception:  # noqa: BLE001
        return None
    finally:
        _guard.inside = False


def _frames(error: BaseException) -> list[str]:
    """Innermost frame first, in the "at func (file:line)" shape the server fingerprints on."""
    frames = traceback.extract_tb(error.__traceback__)
    return [f"at {f.name} ({f.filename}:{f.lineno})" for f in reversed(frames)][:20]


def flush(timeout: float = 5.0) -> bool:
    return _state.transport.flush(timeout) if _state else True


def shutdown(timeout: float = 5.0) -> None:
    """Flushes and removes every hook."""
    global _state
    state = _state
    if state is None:
        return
    state.transport.close(timeout)
    if state.tracer_provider is not None:
        try:
            state.tracer_provider.shutdown()
        except Exception:  # noqa: BLE001, S110 (shutdown is best effort)
            pass
    for undo in reversed(state.undo):
        undo()
    _state = None


def _at_exit() -> None:
    if _state is not None:
        _state.transport.flush(3.0)


class ApeLogHandler(logging.Handler):
    """Forwards `logging` records. Attached to the root logger by `start()`."""

    _MAP: ClassVar[dict[int, str]] = {
        logging.DEBUG: "debug",
        logging.INFO: "info",
        logging.WARNING: "warn",
        logging.ERROR: "error",
        logging.CRITICAL: "fatal",
    }

    def emit(self, record: logging.LogRecord) -> None:
        if record.name.startswith("ape_agent") or record.name.startswith("urllib3"):
            return
        try:
            level = self._MAP.get(
                record.levelno, "error" if record.levelno > logging.ERROR else "info"
            )
            attrs: dict[str, Any] = {"logger": record.name}
            if record.exc_info and record.exc_info[1] is not None:
                exc = record.exc_info[1]
                attrs["exception"] = {
                    "type": type(exc).__name__,
                    "message": str(exc),
                    "stacktrace": "".join(traceback.format_exception(*record.exc_info)),
                }
            log(level, record.getMessage(), **attrs)
        except Exception:  # noqa: BLE001
            self.handleError(record)


def _hook_exceptions(state: _State) -> None:
    prev_sys = sys.excepthook
    prev_thread = threading.excepthook

    def sys_hook(exc_type: type[BaseException], exc: BaseException, tb: Any) -> None:
        if not issubclass(exc_type, KeyboardInterrupt):
            capture_exception(exc, handled=False, level="fatal")
            flush(2.0)
        prev_sys(exc_type, exc, tb)

    def thread_hook(args: threading.ExceptHookArgs) -> None:
        if args.exc_value is not None and not isinstance(args.exc_value, SystemExit):
            capture_exception(
                args.exc_value, handled=False, thread=getattr(args.thread, "name", None)
            )
        prev_thread(args)

    sys.excepthook = sys_hook
    threading.excepthook = thread_hook

    def undo() -> None:
        sys.excepthook = prev_sys
        threading.excepthook = prev_thread

    state.undo.append(undo)


def _start_tracing(
    endpoint: str,
    token: str,
    service: str,
    environment: str,
    release: str | None,
    warn: Any,
) -> Any:
    try:
        from opentelemetry import trace  # type: ignore[import-not-found]
        from opentelemetry.exporter.otlp.proto.http.trace_exporter import (
            OTLPSpanExporter,
        )  # type: ignore[import-not-found]
        from opentelemetry.sdk.resources import Resource  # type: ignore[import-not-found]
        from opentelemetry.sdk.trace import TracerProvider  # type: ignore[import-not-found]
        from opentelemetry.sdk.trace.export import BatchSpanProcessor  # type: ignore[import-not-found]
    except ImportError:
        return None
    try:
        attrs = {"service.name": service, "deployment.environment.name": environment}
        if release:
            attrs["service.version"] = release
        provider = TracerProvider(resource=Resource.create(attrs))
        provider.add_span_processor(
            BatchSpanProcessor(
                OTLPSpanExporter(
                    endpoint=f"{endpoint}/v1/traces",
                    headers={
                        "Authorization": f"Bearer {token}",
                        "x-ape-sdk": _SDK_HEADER,
                    },
                )
            )
        )
        trace.set_tracer_provider(provider)
        return provider
    except Exception as err:  # noqa: BLE001
        warn(f"tracing did not start: {err}")
        return None
