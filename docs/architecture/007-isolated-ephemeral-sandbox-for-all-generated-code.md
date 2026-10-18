# ADR-007 — Isolated ephemeral sandbox for all generated code

- **Status:** Accepted
- **Date:** 2026-10-18

- **Decision:** Every test/patch runs in a fresh container: no network, non-root, read-only rootfs, cap-drop ALL, CPU/memory/pid/time limits, no secrets or sockets mounted. Consider microVMs (Firecracker/gVisor) later.
- **Consequences:** Dependencies must be pre-installed in per-repo images; some tests that need network can't run (report this as a limitation).
