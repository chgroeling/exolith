# Identifier

Every thing in the wiki — pages, claims, and any future entity — has a unique, stable, slug-based identifier. An identifier is a machine-indexable, human-readable name that never changes once created.

## Structure

All identifiers follow the pattern `{type}.{slug}` — a type prefix, a dot separator, and a slugified name:

| Component | Description | Example |
| --------- | ----------- | ------- |
| `type`    | Type prefix | `entity`, `claim`, `concept`, ... |
| `.`       | Separator | `.` |
| `slug`    | Slugified name from the title or description | `seneca`, `cortisol-senkung` |
| **Identifier** | | `entity.seneca`, `claim.cortisol-senkung` |

Valid type prefixes: `source`, `entity`, `concept`, `synthesis`, `report`, `claim`.

The slug is generated from the natural-language title or description following the [slug rules](slug-spec.md#slug-rules).

## Uniqueness

All identifiers are unique vault-wide. The type prefix separates namespaces (`entity.seneca` vs. `concept.stoicism` vs. `claim.cortisol-senkung`), but even within the same type the slug must be unique.

## Stability

Once created, an identifier never changes — even if the underlying title or description changes. The identifier is permanent for the lifetime of the thing it names.

## Examples

| Type | Identifier |
| ---- | ---------- |
| `entity` | `entity.seneca` |
| `concept` | `concept.praemeditatio-malorum` |
| `source` | `source.schneider-metastudie-2024` |
| `synthesis` | `synthesis.stoizismus-und-empirie` |
| `report` | `report.open-questions` |
| `claim` | `claim.cortisol-senkung` |

## See Also

- [slug-spec.md](slug-spec.md) — slug generation rules
- [claim-spec.md](claim-spec.md) — claim structure and fields
- [format-spec.md](format-spec.md) — YAML frontmatter where the page `id` field lives
- [vault-layout.md](vault-layout.md) — where each page type lives in the vault
