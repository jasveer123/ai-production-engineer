# ADR-016 — Model gateway: Claude first, structured output, evidence guard

- **Status:** Accepted
- **Date:** 2026-10-19

- **Context:** ADR-010/011 require validated outputs, evidence citations and a provider-agnostic gateway.
- **Decision:** The gateway (`services/ai-worker/src/ai_worker/llm/gateway.py`) defines one `ModelProvider` interface. The first adapter uses the official Anthropic Python SDK with `claude-opus-5-5` by default (overridable with `AI_MODEL`), explicit `effort`, JSON-schema structured output, the server-side refusal fallback (`fallbacks: "default"`), a per-call timeout and a token budget. Every response is validated again with Pydantic; any hypothesis or observation that cites an evidence ID not in the bundle, or cites none, is dropped and recorded. Evidence is wrapped in delimiters and the prompt states that it is untrusted data. With no API key the investigation ends as `needs_review` with evidence collected, never with invented output. An OpenAI adapter is deferred to the Phase 9 model comparison.
- **Consequences:** Model output can only reach users through the schema and the guard. Some investigations end with fewer (or no) hypotheses, which is intended. Cost and tokens are recorded per call in `usage_records`.

## Addendum (2026-10-19): Google Gemini adapter

- **Context:** The project runs on a free Gemini API key until a paid Anthropic key is available.
- **Decision:** `ai_worker/llm/gemini.py` implements the same `ModelProvider` interface with the official `google-genai` SDK (`models.generate_content` with `response_json_schema`, system instruction, output cap and timeout). `AI_PROVIDER=auto` prefers Anthropic when its key is set, otherwise Gemini. Because free-tier capacity varies per model, the adapter falls back through `GEMINI_FALLBACK_MODELS` on 503/429 only; bad requests never fall back. The newer Interactions API was tried first but has a much smaller free-tier quota.
- **Consequences:** The same schema, evidence guard and API-side re-check apply to both providers. Free-tier requests may be used by Google to improve its products, so real customer data should only go through a paid tier. Cost is recorded as $0 for unpriced (free) models.
- **Results so far:** S1 (null coupon) and S6 (bad timeout config) were both diagnosed correctly as hypothesis #1 by `gemini-3.6-flash`. S2–S5 produce no server-error traces, so they need Sentry or latency signals before they can be scored.
