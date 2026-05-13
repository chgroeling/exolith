# log.md — The Chronicle

## Structure of a Log Entry

- **Heading:** `## YYYY-MM-DD • action | short title` — machine-readable and grep-friendly. No `[ ]` around the date (that would be a wikilink).
- **Source:** Only for `ingest`, as a wikilink: `[[path/to/source]]`
- **Action:** What was created, modified, deleted. Counts for Entities/Concepts/Claims
- **Context:** For `lint` or `compile`: Why the step was triggered, what the result was

## Structure and Example

```markdown
# Wiki Log

## 2026-05-02 • ingest | Practical Application of Stoicism
Source: [[inbox/stoizismus-engineering]]
Action: 1 new Source, 2 Entities created (maria-schneider, uni-tuebingen),
  3 Concepts (praemeditatio-malorum, cortison-senkung, antizipiertes-leiden),
  6 Claims. 5 existing pages updated.

## 2026-05-01 • ingest | Letters to Lucilius (Letter 13)
Source: [[inbox/briefe-an-lucilius-13]]
Action: 1 new Source, Entity seneca expanded, Concept praemeditatio-malorum
  created. 2 Claims.

## 2026-04-30 • lint | Confidence Review
3 Claims with confidence < 0.5 found → all in [[concepts/dichotomie-der-kontrolle]].
  Human set review flag, LLM should re-evaluate at the next matching source.

## 2026-04-28 • compile | Auto-Compile after 3 Ingests
Index regenerated (12 → 15 pages). Backlinks updated.
  Dashboard [[reports/contradictions]]: 0 contradictions.
```

The log is kept append-only — new entries go on top (reverse-chronological). At the start of a session, the LLM reads the first 15-20 lines of the log and immediately knows what has happened since last time. No filesystem timestamp comparison needed.

## See Also

* [vault-layout.md](vault-layout.md) — where log.md lives in the vault
* [../architecture.md](../architecture.md) — architectural overview
* [../operations/ingest.md](../operations/ingest.md) — log entries are written during ingest step 7
