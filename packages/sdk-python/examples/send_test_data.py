# APE_TOKEN=ape_live_... APE_ENDPOINT=http://localhost:4000 python examples/send_test_data.py
import json

import ape_agent

ape_agent.start(service="agent-smoke-test", environment="development")
ape_agent.log("info", "Hello from ape-agent (Python)")
try:
    json.loads("{oops")
except ValueError:
    ape_agent.capture_exception(route="/smoke-test")
ape_agent.shutdown()
print("sent")
