# ADR-025: Prompt engineering, guardrails and model routing

Status: accepted. Builds on ADR-016 (gateway and evidence guard) and ADR-021 (evaluation).

## Context

The product is only as trustworthy as its root-cause reports. A confident wrong report sends an
engineer the wrong way, and the budget is small (development use, about $5). We needed the cheapest
model that is good enough, prompts that fail safe, and a way to prove both.

## Decisions

1. **Model: Claude Haiku 5.5, `effort=medium`.** $0.10 / $0.50 per million tokens. Fix and test
   writing can be routed to a stronger model with `AI_FIX_MODEL` / `AI_FIX_EFFORT` without code
   changes. Effort, not temperature, is the cost control (current models reject sampling
   parameters). Changing effort between calls invalidates the message cache, so it is set per
   purpose, not per call. Haiku has no server-side refusal fallback, so `fallbacks` is sent only to
   models that accept it.
2. **Prompts are versioned files** (`prompts/*_v2.md`), static and shared across incidents, so the
   system block carries the cache breakpoint (reads cost a tenth). Evidence goes in the user
   message, long data first and the instruction last. Sections are XML-tagged: role, input,
   method, observations, hypotheses, confidence rubric, grounding, do_not, edge_cases,
   evidence_safety, output, examples. Each rule says why it exists.
3. **Negative prompting** (`<do_not>`): no invented ids, paths, lines or values; no actions
   (approve, merge, roll back); no blaming a deploy by timing alone; no treating expected 4xx or
   declines as defects; no guessing redacted values. Fix prompts forbid editing tests or config,
   hard-coding, suppressing checks and swallowing errors.
4. **Guardrails are code, not prompt text** (`guardrails.py`), because prompts can be ignored:
   - Input: secrets are re-redacted, instruction-like text is flagged and the model is told,
     each item is capped (head and tail kept, the cut is stated).
   - Output: unknown citations drop the claim; a suspected file must appear in the evidence;
     `high` confidence needs code, two sources and no contradiction (otherwise lowered to
     `medium`); duplicate causes merge; secrets the model echoes are scrubbed.
   - Fix steps: a regression test needs a real assertion; a patch may not edit tests, configs
     or suppress checks.
   - Every change is recorded in `adjustments` / `input_notes` so reviewers see what was done.
5. **Honest failure.** No evidence means no model call. A bad answer is retried once with the
   rejection reason. A model outage ends in `needs_review` with a reason on the last Temporal
   attempt. Billing and refusal errors are typed and not retried.
6. **Evals gate prompt changes.** 15 frozen cases built from demo-shop (`tests/evaluation`): the
   six real scenarios plus edge cases (no code, stale code, minified stack, injection in a stack
   trace, a code comment and a commit, leaked secrets, expected declines, alert-only, a latency
   symptom, an unhandled rejection). Scoring: top-1/top-3, abstention, injection resistance,
   over-confidence, confidence ceilings, invented locations, leaked secrets, guard activity, cost
   and latency. Scripted reference answers must pass every case and flawed answers must fail every
   case, so the harness itself is tested without spending money.

## Running

```bash
make eval                                   # free: scripted answers
python -m ai_worker.evaluation run --models anthropic:claude-haiku-5-5 --repeat 3
python -m ai_worker.evaluation run --models anthropic:claude-sonnet-5-5
```

Live results are recorded below once a key is configured.

## Consequences

- A prompt or model change is accepted only if the pass rate and over-confidence do not regress.
- Guards can hide a model mistake; scoring counts a lowered confidence as model over-confidence
  so the eval still reflects the model, not the guard.
- Haiku is cheap but weaker on subtle code reasoning; the upgrade path is `AI_FIX_MODEL` first,
  then `AI_MODEL`.

## Results

_Pending: live Haiku 5.5 vs Sonnet 5.5 run._
