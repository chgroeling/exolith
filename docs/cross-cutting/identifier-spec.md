# Identifier

Every thing in the wiki — pages, claims, and any future entity — has a unique, stable, slug-based identifier. An identifier is a machine-indexable, human-readable name that never changes once created.

## Slug Rules

All identifiers are derived from a slug generated according to the [slug rules](slug-spec.md#slug-rules): lowercase, hyphens, ASCII-only, symbols removed, trimmed, with a fallback hash for empty results.

## Patterns

| Context | Pattern | Example |
| ------- | ------- | ------- |
| Page | `{type}.{slug}` | `entity.seneca` |
| Claim | `{page-id}#claim-{slug}` | `entity.seneca#claim-cortisol-senkung` |

The page type prefix is one of: `source`, `entity`, `concept`, `synthesis`, `report`.

## Uniqueness

- Page identifiers are unique vault-wide. No two pages may have the same identifier. The prefix separates namespaces (`entity.seneca` vs. `concept.stoicism`), but even within the same type the slug must be unique.
- Claim identifiers are unique within a single page. The full `{page-id}#claim-{slug}` reference is unique vault-wide.
- Dashboards, the index, and cross-references always use the full reference form.

## Stability

Once created, an identifier never changes — even if the underlying title or description changes. The identifier is permanent for the lifetime of the thing it names.

## Examples

| Context | Identifier |
| ------- | ---------- |
| Entity page | `entity.seneca` |
| Concept page | `concept.praemeditatio-malorum` |
| Source page | `source.schneider-metastudie-2024` |
| Synthesis page | `synthesis.stoizismus-und-empirie` |
| Report page | `report.open-questions` |
| Claim reference | `entity.seneca#claim-cortisol-senkung` |

## See Also

- [slug-spec.md](slug-spec.md) — slug generation rules
- [claim-spec.md](claim-spec.md) — claim structure and fields
- [format-spec.md](format-spec.md) — YAML frontmatter where the page `id` field lives
- [vault-layout.md](vault-layout.md) — where each page type lives in the vault
