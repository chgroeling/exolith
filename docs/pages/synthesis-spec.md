# Synthesis — Cross-Section Analyses

The page type `synthesis` combines multiple Entities or Concepts into a **higher-level analysis**. Unlike a concept, which describes a single pattern, a synthesis establishes a **cross-connection** between multiple page types.

**When is a synthesis created?**
- From a query that links multiple pages (≥3 sources or a new connection discovered)
- When the compile detects that multiple pages examine the same topic from different perspectives
- Triggered manually by the human ("Compare X with Y")

**Examples of Syntheses:**
- `synthesis.stoizismus-und-empirie` — How Stoic concepts are confirmed or refuted by modern research
- `synthesis.c-plus-plus-embedded-vs-python` — Design philosophy differences between the two language worlds
- `synthesis.depression-bewältigungsstrategien` — Comparison of different methods (Stoicism, CBT, meditation) with effectiveness evidence

**Structure of a Synthesis (Example):**

```markdown
---
id: synthesis.stoizismus-und-empirie
title: Stoicism and Empiricism — What the Research Says
confidence: 0.75
status: active
tags:
  - stoizismus
  - psychologie
  - empirisch
  - metastudie
created: 2026-05-02
updated: 2026-05-02
---

# Stoicism and Empiricism

Modern psychology has empirically investigated several Stoic
practices. The results are mixed: Some concepts (praemeditatio
malorum, dichotomy of control) show measurable effects, others
(Stoic theory of emotions) have not yet been operationalized.

## Claims

- `id:claim-praemeditatio-best-belegt` `conf:0.85` `status:active`
  Praemeditatio malorum is the most empirically substantiated Stoic technique
  *Evidence:* [[sources/schneider-metastudie-2024]]
  *Limitation:* Other techniques (dichotomy of control) not examined in
  controlled studies

- `id:claim-stoa-kvt-vergleichbar` `conf:0.5` `status:uncertain`
  Stoic practices are comparable to CBT in effectiveness
  *Evidence:* [[sources/kvt-leitlinien-2023]] (indirect comparison)
  *Limitation:* No direct head-to-head comparison; confidence low

## Connections

- `compares` → [[concepts/praemeditatio-malorum]]
- `compares` → [[concepts/stoizismus]]
- `contrasts` → [[concepts/kognitive-verhaltenstherapie]]

## Open Questions

- Are there Stoic techniques that have been empirically *disproven*?
- How do Stoic and Buddhist meditation compare in a direct comparison?

<!-- exolith:human:start -->
## My Assessment

The empirical confirmation is nice, but for me it's not the
decisive point. Stoicism works for me subjectively —
that's enough. Still, it's exciting to see that the research
partially supports it.
<!-- exolith:human:end -->
```

**Special Characteristics:**

- Syntheses also collect Claims — they aggregate and compare claims from multiple sources, but also formulate their own synthesizing assertions.
- A synthesis is **not created automatically** with every ingest — it is a deliberate step (query filing or manual trigger).
- Bootstrap mode: With <50 pages in the vault, no syntheses are automatically suggested.
- The confidence of a synthesis is the weighted average of all referenced claims.

## See Also

* [vault-layout.md](vault-layout.md) — where syntheses live in the vault
* [format-spec.md](format-spec.md) — YAML frontmatter and format conventions
* [claim-spec.md](claim-spec.md) — claim structure used in syntheses
