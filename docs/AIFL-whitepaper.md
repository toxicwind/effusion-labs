# Agentic Instruction Feedback Loop (AIFL)
### — a correlated failure-mode cluster in autonomous coding-agent fleets

**Term:** Agentic Instruction Feedback Loop (AIFL), root-cause subtype: Concurrent-Session Entanglement (CSE)
**Coined:** 2026-11-02, tau — name selected by bge-m3 semantic scoring (0.560 AIFL / 0.533 CSE) against 20 candidates
**Corpus:** 1,061 session files, 397,716 events, kleio audit (`kleio/helper/audit.ts --check all`)

---

## 1. The phenomenon

Across the fleet's session corpus, seven distinct failure modes recur **correlated** —
not independently. A jammed loop self-sustains because each mode feeds the next:

1. **Rule-injection spam** — `ttsr_injection` rows flooding a session (245 in one
   file), injecting duplicate rule text into the transcript on *matching tool-arg
   text*, including the rule's own example commands.
2. **Thinking-only turns recorded as empty assistant messages** — reasoning-token
   boundaries where the provider emits `reasoning_content` but zero `content`,
   recorded as empty turns (`thinking-leak` pattern).
3. **Repeated-command loops** — the same tool call retried verbatim when the
   injection adds context but not a route change (`repeated-loop`).
4. **Model churn** — upstream lane flapping (glm → qwen → deepseek → ner… 22
   changes in one session) destabilizing reasoning-content contracts per lane.
5. **Todo phantom completion** — todo entries marked done without corresponding
   evidence (`todo-phantom`).
6. **Ghost tool calls from concurrent writers** — multiple tau processes
   appending rows into one session file under a single root (`concurrent-session
   entanglement`): unrelated workstreams (TV deploy, beellama router recon, DNS
   probes) interleave in one jsonl.
7. **Context-root fracture** — a bare `model_change` event wedged above nearly the
   whole tree, re-rooting ancestry so parent chains traverse phantom layers.

## 2. The loop

```
rule spam inflates context
        ↓
context re-triggers matching rules (incl. rule bodies)
        ↓
empty/thinking-only turns recorded → model re-samples same context
        ↓
repeated tool calls / phantom completions
        ↓
multiple writers share one session file → ancestry interleaves
        ↓
root fracture → audit/recall reads a multiplexed tree as one "session"
        ↓
diagnosis attributes symptoms to wrong turn → more rules → (top)
```

The correlation is _too deep for independent-cause explanations_: each mode
amplifies the next. This is the unit to study, not 7 separate bugs.

## 3. Evidence (this corpus)

| metric | value |
|---|---|
| session files | 1,061 |
| events | 397,716 |
| completed | 496 |
| pattern matches | 27→131 per high-anomaly session |
| anomaly score range | 18 → 1,123 |
| max ttsr injections in one file | 245 |

Case (session `-tmp/2026-11-01T23-55-26…`): 8,132 rows = 1 visible conversation +
multiple concurrent workstreams under one root; 8131/8132 rows descend through a
bare model_change; 948 SSE chunks all `deepseek-v4-flash`; 145 reasoning-only.

## 4. Why "Instruction Feedback Loop"

The estate already has anomaly #78 (auto-join ghost machine: ~90 procs/min storm)
— that was a **birth** event. AIFL is the **adult** form: ghosts whose injected
instructions recursively re-trigger themselves. Name chosen semantically: the
loop is *instructional* (rules/context), *agentic* (agents produce it), and a
*feedback* loop (output feeds input), with *entanglement* naming the root cause.

## 5. Classification

- **Class:** cybernetic runtime telemetry pathology of autonomous agent fleets
- **Broader estate category:** stigmergic swarm artifacts (AGENTS.md anomaly table)
- **Related:** ESTATE-ANOMALY-78 (ghost broker), rule-narration loops, reasoning-boundary retries
- **Not:** model-quality, network failure, or user error

## 6. Next (gated on architect)

1. Session-file **write isolation per process** (fixes CSE root).
2. Rule engine: match **parsed command**, never raw arg-string (fixes self-trigger).
3. Reasoning-only STOP → **retry lane** for freeinference/deepseek (fixes empty turns).