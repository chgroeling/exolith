# Claim ID

Every claim has a unique identifier that enables direct referencing from dashboards, the index, and cross-references. The claim ID is the mechanism that turns prose into a trackable belief system.

## Structure

Claims use a two-part reference: `{page-id}#{claim-slug}`.

| Component | Description | Example |
| --------- | ----------- | ------- |
| `page-id` | The ID of the page the claim belongs to | `entity.seneca` |
| `#`       | Separator | `#` |
| `claim-slug` | Claim identifier, pattern `claim-<description>` | `claim-cortisol-senkung` |
| **Full reference** | | `entity.seneca#claim-cortisol-senkung` |

The `claim-slug` component follows the [slug rules](../cross-cutting/slug-spec.md#slug-rules): lowercase, hyphens, no special characters.

## Slug Rules

- Pattern: `claim-<short-description>`
- Description is slugified: lowercase, hyphens, no special characters
- Assigned by the LLM on creation and never changed

## Scope

Claim IDs are unique **within a single page** — not vault-wide. The full `{page-id}#{claim-slug}` reference is unique vault-wide.

Dashboards, the index, and cross-references always use the full reference (e.g., `entity.seneca#claim-cortisol-reduction`). This means claim IDs can be shorter and more descriptive since they only need to be unique within their home page.

## Format on Pages

Claims appear in the `## Claims` section of a page with their ID as the first field:

```markdown
- `id:claim-cortisol-reduction` `conf:0.85` `status:active`
  Praemeditatio malorum reduces cortisol by an average of 18%
  *Evidence:* [[sources/schneider-meta-study-2024]] (paragraph 3, n=1,200)
```

## See Also

- [page-id.md](page-id.md) — page ID structure and uniqueness
- [slug-spec.md](../cross-cutting/slug-spec.md) — slug generation rules
- [../cross-cutting/claim-spec.md](../cross-cutting/claim-spec.md) — full claim structure (fields, evidence, statuses)
