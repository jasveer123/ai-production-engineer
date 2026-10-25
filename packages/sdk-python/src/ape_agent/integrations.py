"""Framework middleware. Each reports unhandled exceptions with the route, then re-raises.

FastAPI / Starlette (ASGI):   app.add_middleware(ApeASGIMiddleware)
Flask (WSGI):                 app.wsgi_app = ApeWSGIMiddleware(app.wsgi_app)
Django:                       MIDDLEWARE = ["ape_agent.integrations.ApeDjangoMiddleware", ...]
"""

from __future__ import annotations

from typing import Any, Callable

from . import capture_exception


class ApeASGIMiddleware:
    def __init__(self, app: Any) -> None:
        self.app = app

    async def __call__(
        self,
        scope: dict[str, Any],
        receive: Callable[..., Any],
        send: Callable[..., Any],
    ) -> None:
        if scope.get("type") != "http":
            await self.app(scope, receive, send)
            return
        status: dict[str, int] = {}

        async def send_wrapper(message: dict[str, Any]) -> None:
            if message.get("type") == "http.response.start":
                status["code"] = int(message.get("status", 0))
            await send(message)

        try:
            await self.app(scope, receive, send_wrapper)
        except Exception as exc:
            route = scope.get("route")
            path = getattr(route, "path", None) or scope.get("path")
            capture_exception(
                exc, route=path, method=scope.get("method"), status_code=500
            )
            raise


class ApeWSGIMiddleware:
    def __init__(self, app: Callable[..., Any]) -> None:
        self.app = app

    def __call__(
        self, environ: dict[str, Any], start_response: Callable[..., Any]
    ) -> Any:
        try:
            return self.app(environ, start_response)
        except Exception as exc:
            capture_exception(
                exc,
                route=environ.get("PATH_INFO"),
                method=environ.get("REQUEST_METHOD"),
                status_code=500,
            )
            raise


class ApeDjangoMiddleware:
    def __init__(self, get_response: Callable[[Any], Any]) -> None:
        self.get_response = get_response

    def __call__(self, request: Any) -> Any:
        return self.get_response(request)

    def process_exception(self, request: Any, exception: Exception) -> None:
        match = getattr(request, "resolver_match", None)
        route = getattr(match, "route", None) or getattr(request, "path", None)
        capture_exception(
            exception,
            route=route,
            method=getattr(request, "method", None),
            status_code=500,
        )
