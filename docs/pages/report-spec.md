# Report — Dashboards

The page type `report` is an **automatically generated dashboard**. Unlike all other page types, a report is completely regenerated on every compile. Reports are read-only for humans; the LLM uses them for health monitoring.

**When is a report created?** Only during compile (Phase 4: Dashboards). Never via ingest or query.

**List of Standard Reports:**

| Report                          | Description                              |
| ------------------------------- | ----------------------------------------- |
| `reports/open-questions.md`     | All unresolved questions from all pages   |
| `reports/contradictions.md`     | Page-level and claim-level contradictions |
| `reports/low-confidence.md`     | Pages & Claims with confidence < 0.5      |
| `reports/claim-health.md`       | Missing Evidence, Contested, Stale Claims |
| `reports/stale-pages.md`        | Pages without updates despite new sources |
| `reports/person-directory.md`   | All Entities of type "person"             |
| `reports/relationship-graph.md` | All structured Relationships              |
| `reports/herkunftsabdeckung.md` | Evidence statistics per Source            |
| `reports/privacy-review.md`     | Pages with sensitive content              |

**Structure of a Report (example `reports/open-questions.md`):**

```markdown
---
id: report.open-questions
title: Open Questions
status: active
tags:
  - dashboard
created: 2026-05-02
updated: 2026-05-02
---

# Open Questions

> Auto-generated at 2026-05-02T10:35:00Z | 3 pages with 5 questions

## [[entities/seneca]]
- Does the cortisol reduction persist after stopping the exercises?
  *Context:* Study measures only acute effects

## [[concepts/praemeditatio-malorum]]
- Does the cortisol reduction persist after stopping the exercises?
  *Context:* Study measures only acute effects
- Why doesn't praemeditatio work for people under 25?
  *Context:* Possible explanation: prefrontal cortex not yet fully developed

## [[syntheses/stoizismus-und-empirie]]
- Are there Stoic techniques that have been empirically *disproven*?
- How do Stoic and Buddhist meditation compare in a direct comparison?
```

**Special Characteristics:**

- Reports have **no** Human Block — they are completely regenerated and contain no personal notes.
- Claims are identified in dashboards via their identifier.
- Reports are optional — the compile only generates those for which data exists.

## See Also

* [../operations/compile.md](../operations/compile.md) — reports are generated during compile phase 4
* [vault-layout.md](vault-layout.md) — where reports live in the vault
* [format-spec.md](format-spec.md) — YAML frontmatter conventions
