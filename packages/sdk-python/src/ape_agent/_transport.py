"""Batches items per endpoint and posts them from one background thread."""

from __future__ import annotations

import gzip
import json
import threading
import time
import urllib.error
import urllib.request
from collections import deque
from typing import Any, Callable

Sender = Callable[[str, bytes, dict[str, str]], int]


def _urllib_send(url: str, body: bytes, headers: dict[str, str]) -> int:
    req = urllib.request.Request(url, data=body, headers=headers, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=10) as res:
            return int(res.status)
    except urllib.error.HTTPError as err:
        return int(err.code)


class Transport:
    def __init__(
        self,
        endpoint: str,
        token: str,
        sdk_header: str,
        warn: Callable[[str], None],
        batch_size: int = 100,
        flush_interval: float = 2.0,
        max_queue: int = 10_000,
        sender: Sender | None = None,
    ) -> None:
        self.endpoint = endpoint
        self.token = token
        self.sdk_header = sdk_header
        self.warn = warn
        self.batch_size = batch_size
        self.flush_interval = flush_interval
        self.max_queue = max_queue
        self.sender = sender or _urllib_send
        self.queues: dict[str, deque[Any]] = {"errors": deque(), "logs": deque()}
        self.dropped = 0
        self.disabled = False
        self._lock = threading.Lock()
        self._wake = threading.Event()
        self._idle = threading.Event()
        self._idle.set()
        self._stop = False
        self._thread = threading.Thread(target=self._run, name="ape-agent", daemon=True)
        self._thread.start()

    def enqueue(self, kind: str, item: Any) -> None:
        if self.disabled:
            return
        with self._lock:
            q = self.queues[kind]
            q.append(item)
            while len(q) > self.max_queue:
                q.popleft()
                self.dropped += 1
                if self.dropped == 1:
                    self.warn(
                        f"queue full ({self.max_queue}); dropping the oldest items"
                    )
            self._idle.clear()
            urgent = kind == "errors" or len(q) >= self.batch_size
        if urgent:
            self._wake.set()

    def flush(self, timeout: float = 5.0) -> bool:
        """Waits until everything queued so far is sent (or the timeout passes)."""
        self._wake.set()
        return self._idle.wait(timeout)

    def close(self, timeout: float = 5.0) -> None:
        self.flush(timeout)
        self._stop = True
        self._wake.set()

    def _run(self) -> None:
        while not self._stop:
            self._wake.wait(self.flush_interval)
            self._wake.clear()
            self._drain()

    def _drain(self) -> None:
        for kind in ("errors", "logs"):
            while not self.disabled:
                with self._lock:
                    q = self.queues[kind]
                    batch = [q.popleft() for _ in range(min(len(q), self.batch_size))]
                if not batch:
                    break
                self._send(kind, batch)
        with self._lock:
            if not any(self.queues.values()) or self.disabled:
                self._idle.set()

    def _send(self, kind: str, batch: list[Any]) -> None:
        raw = json.dumps(batch, default=str).encode()
        headers = {
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json",
            "x-ape-sdk": self.sdk_header,
            "User-Agent": f"ape-agent/{self.sdk_header}",
        }
        if len(raw) > 16_384:
            raw = gzip.compress(raw)
            headers["Content-Encoding"] = "gzip"
        url = f"{self.endpoint}/v1/{kind}"
        for attempt in range(4):
            try:
                status = self.sender(url, raw, headers)
            except Exception as err:  # noqa: BLE001 (network errors of any kind)
                if attempt == 3:
                    self.warn(f"could not reach {self.endpoint}: {err}")
                    return
                time.sleep(0.5 * 2**attempt)
                continue
            if 200 <= status < 300:
                return
            if status == 401:
                self.disabled = True
                self.warn(
                    "the ingest token was rejected (401). Check APE_TOKEN. Sending is turned off."
                )
                return
            if status != 429 and status < 500:
                self.warn(
                    f"{kind} batch rejected with HTTP {status}; dropped {len(batch)} items"
                )
                return
            time.sleep(0.5 * 2**attempt)
        self.warn(f"gave up sending {len(batch)} {kind} after retries")
