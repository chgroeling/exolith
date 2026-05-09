# Slug-Based IDs

The universal naming convention of the wiki. Every identifier — whether for a page or a claim — follows a stable, human-readable pattern that is machine-indexable without a database.

For identifier structure, patterns, and uniqueness, see [identifier-spec.md](identifier-spec.md).

## Slug Rules

- Output is RFC 3986 compliant — only unreserved URI characters (letters, digits, `-`, `.`, `_`, `~`) may appear, with hyphens as the sole separator
- Lowercase — all characters are converted to lowercase, including transliterated output (e.g., `"München"` → `"munchen"`)
- Hyphens instead of spaces, underscores, or any other non-URI characters
- ASCII only — Unicode letters with diacritics (e.g., `é`, `ü`, `ø`) are transliterated to their base ASCII equivalents (`e`, `u`, `o`)
- Non-Latin scripts (e.g., Cyrillic, Greek) are transliterated to Latin; the transliteration is locale-aware (e.g., Cyrillic can be transliterated as Russian or Bulgarian depending on the source language)
- Unrecognized symbols and punctuation are **removed** — they are not replaced with alternative words (e.g., `"$100"` → `"100"`, `"<hello>"` → `"hello"`)
- Consecutive non-word characters collapse into a single hyphen — no double hyphens in the result
- Leading and trailing hyphens are trimmed
- If the result would be **empty** (e.g., title consists only of symbols or whitespace), a short predictable hash is generated to ensure the slug always yields a non-empty, valid ID
- Stable once created — the slug never changes even if the title changes
- Derived from the natural-language title, e.g. "Praemeditatio Malorum" → `praemeditatio-malorum`

## Examples

| Type | ID |
| ---- | -- |
| Entity page | `entity.seneca` |
| Concept page | `concept.praemeditatio-malorum` |
| Source page | `source.schneider-metastudie-2024` |
| Synthesis page | `synthesis.stoizismus-und-empirie` |
| Claim reference | `entity.seneca#claim-cortisol-senkung` |

## See Also

* [identifier-spec.md](identifier-spec.md) — identifier structure and patterns
* [claim-spec.md](claim-spec.md) — claim structure including the identifier convention in context
* [format-spec.md](format-spec.md) — YAML frontmatter where the page `id` field lives
