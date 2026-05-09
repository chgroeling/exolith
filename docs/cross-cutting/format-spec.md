# Format conventions

The entire wiki uses Obsidian wikilinks (`[[path/to/page]]`) instead of Markdown links. Metadata that must be machine-parsed lives in the **YAML frontmatter** — tags, ID, page type, status, confidence, timestamps. Everything else (Claims, Verknüpfungen) lives as normal Markdown in the body.

**Human Blocks** (`<!-- exolith:human:start -->` / `<!-- exolith:human:end -->`) are the only HTML comments in the system and protect handwritten notes from being overwritten. Everything outside these markers is implicitly LLM-managed — there are no managed-block markers. Only normal Markdown headings (`##`, `###`) are used for chapter structuring.

## YAML frontmatter: Fields in detail

Every wiki page begins with a YAML frontmatter block. The following fields are defined:

| Field        | Required | Type   | Description                                                                                 |
| ------------ | -------- | ------ | ------------------------------------------------------------------------------------------- |
| `id`         | ✅        | string | Unique identifier, e.g. `entity.seneca`. Prefix = page type, suffix = slug.                 |
| `page`       | ✅        | enum   | `source`, `entity`, `concept`, `synthesis`, `report`                                        |
| `title`      | ✅        | string | Display name of the page                                                                    |
| `status`     | ✅        | string | `active`, `review`, `archived`                                                              |
| `tags`       | ✅        | list   | Thematic tags for filtering (e.g. `[philosophie, stoizismus]`)                              |
| `confidence` | ❌        | float  | Page-level confidence (0.0–1.0). Average of all claims. `null` for pages without claims.    |
| `created`    | ✅        | date   | Creation date (ISO 8601)                                                                    |
| `updated`    | ✅        | date   | Last modification (ISO 8601)                                                                |

**Rules:**
- `id` is unique across the entire vault. No two pages may have the same ID.
- `page` must match the folder (`entities/seneca.md` → `page: entity`). Mismatch → lint error.
- `tags` are a YAML list, not inline flags. Tags are stored lowercase and without the `#` prefix.
- `confidence` is `null` when the page has no claims (e.g. newly created, no extraction yet).
- `status: review` means: page is new and has not yet been approved by a human.

## Confidence — how it is derived

The **page-level confidence** (`confidence` in the YAML frontmatter) is the **arithmetic mean** of all claim confidence values on the page:

```
page.confidence = sum(claim.confidence for claim in claims) / len(claims)
```

The **claim confidence** (`conf:0.X` in the `## Claims` section) is set by the LLM during extraction and later calibrated by the compiler. Calibration weights four factors:

| Factor             | Weight | Description                                                                                                     |
| ------------------ | ------ | --------------------------------------------------------------------------------------------------------------- |
| **Source type**    | 30%    | peer-reviewed (1.0) > book (0.8) > conference (0.7) > blog post (0.5) > social media (0.2) > LLM-generated (0.1) |
| **Evidence quality** | 30%  | Direct quote with page number (1.0) > paraphrase with paragraph (0.7) > general reference (0.4) > no reference (0.0) |
| **Number of sources** | 20% | 1 source = 0.5, 2 sources = 0.7, 3+ sources = 1.0 (logarithmic scale)                                           |
| **Recency**        | 20%    | < 1 year (1.0) > < 3 years (0.8) > < 5 years (0.6) > < 10 years (0.4) > older (0.2)                              |

**Example calculation for a claim:**
```
Claim: "praemeditatio senkt Cortisol um 18%"
- Source type: peer-reviewed (Nature Human Behaviour) → 1.0 × 0.30 = 0.30
- Evidence quality: Direct quote with paragraph reference → 1.0 × 0.30 = 0.30
- Number of sources: 1 source → 0.5 × 0.20 = 0.10
- Recency: 2024, < 1 year → 1.0 × 0.20 = 0.20
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Calibrated Confidence = 0.90 → rounded to 0.9
```

The LLM initially sets an estimated confidence. The compiler calibrates it using the four factors. The calibrated confidence is written back into the claim and as the page-level average into the frontmatter.

## See Also

* [claim-spec.md](claim-spec.md) — claim structure (confidence field in context)
* [vault-layout.md](vault-layout.md) — page types and YAML frontmatter requirements
* [../architecture.md](../architecture.md) — architectural overview
