# Format conventions

The entire wiki uses Obsidian wikilinks (`[[path/to/page]]`) instead of Markdown links. Metadata that must be machine-parsed lives in the **YAML frontmatter** — tags, ID, status, confidence, timestamps. Everything else (Claims, Verknüpfungen) lives as normal Markdown in the body.

**Human Blocks** (`<!-- exolith:human:start -->` / `<!-- exolith:human:end -->`) are the only HTML comments in the system and protect handwritten notes from being overwritten. Everything outside these markers is implicitly LLM-managed — there are no managed-block markers. Only normal Markdown headings (`##`, `###`) are used for chapter structuring.

## YAML frontmatter: Fields in detail

Every wiki page begins with a YAML frontmatter block. The following fields are defined:

| Field        | Required | Type   | Description                                                                                 |
| ------------ | -------- | ------ | ------------------------------------------------------------------------------------------- |
| `id`         | ✅        | string | Unique identifier, e.g. `entity.seneca`. Prefix = page type, suffix = slug.                 |
| `title`      | ✅        | string | Display name of the page                                                                    |
| `status`     | ✅        | string | `active`, `review`, `archived`                                                              |
| `tags`       | ✅        | list   | Thematic tags for filtering (e.g. `[philosophie, stoizismus]`)                              |
| `confidence` | ❌        | float  | Page-level confidence (0.0–1.0). Average of all claims. `null` for pages without claims.    |
| `created`    | ✅        | date   | Creation date (ISO 8601)                                                                    |
| `updated`    | ✅        | date   | Last modification (ISO 8601)                                                                |

**Rules:**
- `id` is unique across the entire vault. No two pages may have the same ID.
- `tags` are a YAML list, not inline flags. Tags are stored lowercase and without the `#` prefix.
- `confidence` is `null` when the page has no claims (e.g. newly created, no extraction yet).
- `status: review` means: page is new and has not yet been approved by a human.

## See Also

* [confidence-spec.md](confidence-spec.md) — confidence calibration model
* [claim-spec.md](claim-spec.md) — claim structure (confidence field in context)
* [vault-layout.md](vault-layout.md) — page types and YAML frontmatter requirements
* [../architecture.md](../architecture.md) — architectural overview
