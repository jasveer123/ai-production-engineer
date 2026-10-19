# Scripted answers

Hand-written answers in the model's output format, used to test the evaluation harness itself
without a model or an API key. **They are not model output** and say nothing about model quality.

- `reference/`: what a careful analyst would answer for each case. Every case must pass
  (`python -m ai_worker.evaluation run --models scripted:reference --min-pass-rate 1`).
- `flawed/`: the mistakes the harness must catch: a citation of evidence that does not exist
  (dropped by the evidence guard), following an instruction injected into a commit message,
  blaming the most recent unrelated deploy, blaming code that did not change, and an
  overconfident guess where the evidence supports nothing. Every case must fail.

Real model results come from running the same command with `gemini:…`, `anthropic:…` or
`openai:…` models; results land in `../results/`.
