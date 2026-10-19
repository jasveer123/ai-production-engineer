# ADR-016 — Model gateway: Claude first, structured output, evidence guard

- **Status:** Accepted
- **Date:** 2026-10-19

- **Context:** ADR-010/011 require validated outputs, evidence citations and a provider-agnostic gateway.
- **Decision:** The gateway (`services/ai-worker/src/ai_worker/llm/gateway.py`) defines one `ModelProvider` interface. The first adapter uses the official Anthropic Python SDK with `claude-opus-5-5` by default (overridable with `AI_MODEL`), explicit `effort`, JSON-schema structured output, the server-side refusal fallback (`fallbacks: "default"`), a per-call timeout and a token budget. Every response is validated again with Pydantic; any hypothesis or observation that cites an evidence ID not in the bundle, or cites none, is dropped and recorded. Evidence is wrapped in delimiters and the prompt states that it is untrusted data. With no API key the investigation ends as `needs_review` with evidence collected, never with invented output. An OpenAI adapter is deferred to the Phase 9 model comparison.
- **Consequences:** Model output can only reach users through the schema and the guard. Some investigations end with fewer (or no) hypotheses, which is intended. Cost and tokens are recorded per call in `usage_records`.
