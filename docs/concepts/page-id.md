# Page ID

Every wiki page has a unique, vault-wide ID following the pattern `{type}.{slug}`. The ID is the canonical reference for the page — it appears in the YAML frontmatter, wikilinks, the index, and all cross-references.

## Structure

| Component | Description | Example |
| --------- | ----------- | ------- |
| `type`    | Page type prefix: `source`, `entity`, `concept`, `synthesis`, `report` | `entity` |
| `.`       | Separator | `.` |
| `slug`    | URL-safe, lowercase, hyphenated name derived from the title | `seneca` |
| **Full ID** | | `entity.seneca` |

The slug is generated from the natural-language title following the [slug rules](../cross-cutting/slug-spec.md#slug-rules): lowercase, hyphens, ASCII-only, symbols removed, trimmed, with a fallback hash for empty results.

## Uniqueness

Page IDs are unique across the entire vault. No two pages may have the same ID. The prefix already separates namespaces (`entity.seneca` vs. `concept.stoicism`), but even within the same type the slug must be unique.

## Stability

Once created, the slug never changes — even if the page title changes. The ID is permanent for the lifetime of the page.

## Examples

| Type | ID |
| ---- | -- |
| Entity page | `entity.seneca` |
| Concept page | `concept.praemeditatio-malorum` |
| Source page | `source.schneider-metastudie-2024` |
| Synthesis page | `synthesis.stoizismus-und-empirie` |
| Report page | `report.open-questions` |

## See Also

- [slug-spec.md](../cross-cutting/slug-spec.md) — slug generation rules
- [claim-id.md](claim-id.md) — claim ID structure and scope
- [format-spec.md](../cross-cutting/format-spec.md) — YAML frontmatter where the `id` field lives
- [vault-layout.md](../cross-cutting/vault-layout.md) — where each page type lives in the vault
