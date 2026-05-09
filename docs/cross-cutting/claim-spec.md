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

## Claim Statuses in Detail

| Status       | Meaning                                             | Trigger                                      |
| ------------ | --------------------------------------------------- | -------------------------------------------- |
| `active`     | Claim is valid and current                          | Default on creation                          |
| `contested`  | Two claims contradict each other                    | Conflict detection on ingest                 |
| `superseded` | A newer claim with higher confidence has replaced it | Update step: SUPERSEDE                       |
| `deprecated` | Claim is no longer relevant                         | Manual or via lint                           |
| `uncertain`  | Claim is speculative, no hard evidence               | Extraction: philosophical assertion, opinion |

## Claim ID Convention

- Pattern: `claim-<short-description>` — slugified, lowercase, hyphens
- Scope: unique within a page (not vault-wide)
- Full reference: `page-id#claim-id`, e.g. `entity.seneca#claim-cortisol-reduction`
- The ID is assigned by the LLM on creation and never changes
- Dashboards and the index reference claims via this full reference

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

* [slug-spec.md](slug-spec.md) — slug-based ID conventions for pages and claims
* [format-spec.md](format-spec.md) — confidence calibration model and format conventions
* [vault-layout.md](vault-layout.md) — where claims live in the vault structure
* [../operations/resolution.md](../operations/resolution.md) — contested claims resolution workflow
