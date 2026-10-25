# ape-agent

Send logs, errors and traces from a Python app (3.9+) to AI Production Engineer. This is **Way 1** on the Integrations page. The core uses only the standard library.

```bash
pip install ape-agent          # logs and errors
pip install "ape-agent[otel]"  # plus traces through OpenTelemetry
```

```python
import ape_agent
ape_agent.start(service="checkout-api")   # first thing in your app; reads APE_TOKEN and APE_ENDPOINT
```

| Argument | Env var | Default |
|---|---|---|
| `token` | `APE_TOKEN` | required |
| `endpoint` | `APE_ENDPOINT` | `http://localhost:4000` |
| `service` | `APE_SERVICE`, `OTEL_SERVICE_NAME` | script name |
| `environment` | `APE_ENVIRONMENT`, `ENVIRONMENT` | `production` |
| `release` | `APE_RELEASE` | none |
| `capture_logging` | | `True`: a handler on the root logger |
| `capture_uncaught` | | `True`: `sys.excepthook` and `threading.excepthook` |
| `tracing` | | `True` when `opentelemetry-sdk` is installed |

## Frameworks

```python
# FastAPI / Starlette
from ape_agent.integrations import ApeASGIMiddleware
app.add_middleware(ApeASGIMiddleware)

# Flask
from ape_agent.integrations import ApeWSGIMiddleware
app.wsgi_app = ApeWSGIMiddleware(app.wsgi_app)

# Django settings.py
MIDDLEWARE = ["ape_agent.integrations.ApeDjangoMiddleware", *MIDDLEWARE]
```

## By hand

```python
ape_agent.log("info", "order placed", order_id=42)
try:
    charge(order)
except PaymentError:
    ape_agent.capture_exception(route="/checkout", order_id=42)
ape_agent.shutdown()  # flush before a controlled exit (also done at interpreter exit)
```

Never raises into your app. Secrets (passwords, tokens, keys, card numbers, URL credentials) are removed before anything leaves the process. Batches of up to 100 items every 2 seconds from one background thread, at most 10 000 queued, retries on network errors, 429 and 5xx, and turns itself off if the token is rejected.
