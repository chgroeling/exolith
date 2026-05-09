# Contested Claims — Resolution Workflow

When compile detects contradictions between claims, it sets the status to `contested`. The resolve process is a first-class operation that formally resolves these contradictions.

## Status: `contested`

Two claims contradict each other → both receive `status: contested`. The system creates a contradiction cluster that links the claims via their identifiers:

```
  claim.cortisol-senkung
  ↔ claim.cortisol-kein-effekt
```

## Conflict Detection During Ingest

Before new claims are merged, the system checks:

1. **Does the new claim contradict an existing one?** → Mark both as `contested`, create contradiction cluster
2. **Does the new claim supersede an older one with higher authority?** → Confidence weighting by source type (peer-reviewed > book > blog post)
3. **Is the existing claim outdated?** → `stale` flag with new claim as update candidate

Conflict detection works in **two stages**:
1. Embedding-based similarity comparison
2. LLM validation ("Are the similar claims actually contradictory?")

## Resolution Rules

| Rule                     | Description                                                                                     |
| ------------------------ | ----------------------------------------------------------------------------------------------- |
| **Confidence delta**     | Does one claim have significantly higher confidence (Δ > 0.3)? → higher wins                    |
| **Source age**           | Is one piece of evidence significantly newer (>5 years difference)? → newer wins                |
| **Methodological quality** | peer-reviewed > book > blog post. Qualitatively higher-grade source wins                     |
| **Automatic**            | If confidence delta > 0.5 AND source-type difference ≥ 2 levels → automatic resolution          |
| **Human**                | In all other cases: human decision required                                                     |

## Resolve as a First-Class Operation

Resolve stands alongside Ingest, Query, and Lint as an independent operation:

```
python exolith.py resolve --claim claim.cortisol-senkung
```

The Resolve Workflow:

1. **Load contradiction cluster:** Display all `contested` claims in the cluster
2. **Compare evidence:** Juxtapose sources, confidence, age, source type
3. **Decision:** Resolve automatically or by human decision according to the resolution rules
4. **Documentation:** Set `resolved_by` field in the claim, update `## Resolutions` section
5. **Cascading:** Check dependent claims — if a referenced claim is resolved, claims derived from it could also be affected

## Resolution Documentation

- **`resolved_by` field in the claim:** Who decided? (`auto`, `human`, `source-xyz`)
- **`resolved_at` field in the claim:** When was it resolved?
- **`## Resolutions` section** in the report `reports/contradictions.md`: Historical overview of all resolutions

## Update Prompt: Marking Contradictions

During ingest, the update prompt marks contradictions but does not resolve them independently. Rule 5 of the update prompt:

> **Mark contradictions** — If a new claim contradicts an existing one: do NOT resolve independently. Mark both with `status:contested`.

This ensures that contradictions are detected and documented, but resolution remains a controlled, traceable process.

## See Also

* [../architecture.md](../architecture.md) — architectural overview (sections on conflict detection)
* [../cross-cutting/claim-spec.md](../cross-cutting/claim-spec.md) — claim status values including `contested`
* [lint.md](lint.md) — lint detects and reports contested claims
* [ingest.md](ingest.md) — ingest marks contradictions during update step 5
