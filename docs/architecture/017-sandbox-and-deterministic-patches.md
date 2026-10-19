# ADR-017 — Sandbox worker and deterministic patch application

- **Status:** Accepted
- **Date:** 2026-10-19

- **Context:** Phase 5 runs AI-written tests and patches. That code is untrusted, and model-written unified diffs are often malformed.
- **Decision:** A separate `sandbox-manager` process (Temporal queue `sandbox`) is the only component that starts containers. It has Docker and object storage, but no database or GitHub credentials. Code reaches it as a GitHub tarball pinned to the deployed commit, stored in S3. Dependencies are installed once per lockfile into a cached image (the only networked step); every test run then uses a fresh container with `--network none`, a read-only root, tmpfs scratch space, all capabilities dropped, `no-new-privileges`, a non-root user, and memory/CPU/PID/time limits, and is always removed. The model returns exact find/replace edits; the platform applies them itself, checks a policy (editable files only, size limits, no manifests/CI/tests, no network/process/eval additions) and computes the unified diff.
- **Consequences:** Escape attempts are covered by tests that start real containers. Tests that need the network can't run (reported as a limitation). gVisor or Firecracker can replace plain Docker later without changing the activity contract.
