# The Claim in Detail

Claims are the atomic knowledge building blocks of the wiki — a single, verifiable assertion with a unique ID, confidence, status, and evidence. They turn vague statements into a trackable belief system. Every claim carries its own provenance directly in the `*Evidence:*` field.

## Claim Fields

Every claim in the `## Claims` chapter has:

| Field               | Type     | Required | Description                                                                             |
| ------------------- | -------- | -------- | --------------------------------------------------------------------------------------- |
| `id:claim-xxx`      | string   | ✅        | Unique claim ID, slug pattern, page-scoped (e.g. `id:claim-cortisol-reduction`)          |
| `conf:0.X`          | float    | ✅        | Confidence (0.0–1.0), set by LLM, calibrated by compile                                 |
| `status:...`        | enum     | ✅        | `active`, `contested`, `superseded`, `deprecated`, `uncertain`                          |
| `*Evidence:*`       | wikilink | ✅        | Wikilink to Source + optional location reference                                        |
| `*Limitation:*`     | text     | ❌        | Methodological or content limitations                                                   |
| `*updated:*`        | date     | ❌        | When the claim was last reviewed                                                        |
| `*Context:*`        | text     | ❌        | Additional background                                                                   |

## Evidence

The `*Evidence:*` field is the mandatory provenance record of every claim. No claim without evidence — this is the key discipline that separates the wiki from speculation. Every claim carries its own provenance directly with it, rather than referencing a separate source list. This makes traceability granular and precise.

Evidence is always a wikilink to a Source page, optionally with a location reference (paragraph, line number, page):

```
*Evidence:* [[sources/schneider-meta-study-2024]] (paragraph 3, n=1,200)
```

Claims without evidence are reported by lint as `claim-missing-evidence`.

## Claim Statuses in Detail

| Status       | Meaning                                             | Trigger                                      |
| ------------ | --------------------------------------------------- | -------------------------------------------- |
| `active`     | Claim is valid and current                          | Default on creation                          |
| `contested`  | Two claims contradict each other                    | Conflict detection on ingest                 |
| `superseded` | A newer claim with higher confidence has replaced it | Update step: SUPERSEDE                       |
| `deprecated` | Claim is no longer relevant                         | Manual or via lint                           |
| `uncertain`  | Claim is speculative, no hard evidence               | Extraction: philosophical assertion, opinion |

## Claim ID Convention

Claims follow the [identifier pattern](identifier-spec.md): `claim-{short-description}`, slugified, vault-wide unique.

## Format and Examples

Claims in the `## Claims` chapter have a unique ID. Evidence is always a wikilink to a Source:

```markdown
## Claims

- `id:claim-cortisol-reduction` `conf:0.85` `status:active`
  Praemeditatio malorum reduces cortisol by an average of 18%
  *Evidence:* [[sources/schneider-meta-study-2024]] (paragraph 3, n=1,200)
  *Limitation:* No effect in participants under 25 years

- `id:claim-seneca-anxiety-thesis` `conf:0.3` `status:uncertain`
  Seneca's thesis: "Most anxieties arise from anticipated suffering,
  not from real suffering"
  *Evidence:* [[sources/letters-to-lucilius]] (13th Letter)
  *Limitation:* Philosophical assertion, 2,000 years old, no empirical evidence
   *updated:* 2026-05-02
```

## See Also

* [slug-spec.md](slug-spec.md) — slug generation rules
* [confidence-spec.md](confidence-spec.md) — confidence calibration model
* [format-spec.md](format-spec.md) — format conventions
* [vault-layout.md](vault-layout.md) — where claims live in the vault structure
* [../operations/resolution.md](../operations/resolution.md) — contested claims resolution workflow
