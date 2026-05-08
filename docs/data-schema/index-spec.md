# index.md — The content catalog

The index is the central navigation structure of the wiki. It is automatically regenerated on every compile and lists **every wiki page** with the fields the LLM needs for lookup and query scoping — not the page content itself.

## Fields per index entry

(extracted from YAML frontmatter and body):

| Field              | Source                        | Type         | Description                                                         |
| ------------------ | ----------------------------- | ------------ | ------------------------------------------------------------------- |
| `id`               | `id` in frontmatter           | string       | Unique identifier, e.g. `entity.seneca`                             |
| `slug`             | Derived from `id`             | string       | Filename without `.md`, e.g. `seneca`                               |
| `title`            | `title` in frontmatter        | string       | Display name, e.g. `Seneca`                                         |
| `pageType`         | `page` in frontmatter         | enum         | `source`, `entity`, `concept`, `synthesis`, `report`                |
| `summary`          | First sentence after `# Title` | string      | L1 one-liner (max. 1 sentence)                                      |
| `path`             | File path                     | string       | Relative path, e.g. `entities/seneca.md`                            |
| `claimCount`       | `## Claims`                   | number       | Number of structured claims                                         |
| `claimIds`         | `id:claim-xxx` in `## Claims` | string[]     | List of all claim IDs on the page (for direct referencing)          |
| `hasOpenQuestions` | `## Offene Fragen`            | boolean      | For dashboard query: which pages have open questions?               |
| `confidence`       | `confidence` in frontmatter   | number\|null | Page-level confidence (average of all claims)                       |
| `status`           | `status` in frontmatter       | string       | `active`, `review`, `archived`                                      |
| `tags`             | `tags` in frontmatter         | string[]     | Tags for thematic filtering                                         |
| `updatedAt`        | `updated` in frontmatter      | ISO date     | Last modification                                                   |

Even at 200 pages, the index is only ~10-15 KB. The LLM can read it in a single read and then selectively load the 3-5 relevant pages.

## Concrete example

```markdown
# Wiki Index

> Auto-generated at 2026-05-02T10:30:00Z | 5 pages | 2 sources | 6 claims

## Sources

- [[sources/briefe-an-lucilius]]
  `page:source` `1 claim` `active` `2026-05-01` `#philosophie #stoizismus`
  — Verarbeitete Quelle: Senecas 13. Brief an Lucilius

- [[sources/schneider-metastudie-2024]]
  `page:source` `2 claims` `active` `2026-05-02` `#psychologie #metastudie`
  — Metastudie zur Wirksamkeit der praemeditatio malorum (n=1.200)

## Entities

- [[entities/seneca]]
  `page:entity` `2 claims` `conf:0.9` `active` `2026-05-01` `#philosophie #stoizismus #antike`
  — Römischer Philosoph, Stoiker, Autor der Briefe an Lucilius

- [[entities/maria-schneider]]
  `page:entity` `2 claims` `conf:0.8` `active` `2026-05-02` `#psychologie #forschung`
  — Forscherin an der Uni Tübingen, Autorin der 2024er Metastudie

## Concepts

- [[concepts/praemeditatio-malorum]]
  `page:concept` `2 claims` `❓` `conf:0.7` `active` `2026-05-02` `#stoizismus #psychologie`
  — Stoische Übung: bewusste Vorstellung des Schlimmsten zur Angstbewältigung

- [[concepts/stoizismus]]
  `page:concept` `1 claim` `conf:0.8` `active` `2026-05-01` `#philosophie`
  — Philosophische Schule der Stoa, Fokus auf das Kontrollierbare
```

## How the index fields are used

- **`page:xxx`** → Page type. The LLM uses it for scoping (when updating, only search Entities, not all categories). The human recognizes at a glance whether an entry is a person, idea, or analysis.
- **`X claims`** → Size. High claim counts signal to the LLM: this page is dense, during ingest a reload is worthwhile. The human sees which pages have substantial content.
- **`❓`** → `hasOpenQuestions`. If the flag is missing, there are no open points. The dashboard `report.open-questions` is built by grep over the index — no LLM call needed.
- **`conf:0.X`** → Average confidence of all claims on the page (from the YAML frontmatter). The LLM uses it for weighting during synthesis (low confidence → cite cautiously, set disclaimer). The human immediately sees: "this page has hard evidence" or "there is a lot of speculation here."
- **`active` / `review` / `archived`** → Lifecycle. Archived pages are ignored during new ingests, review pages receive a lint nudge.
- **`#tag1 #tag2`** → Tags from the YAML frontmatter, for thematic filtering.
- Date stamp (`2026-05-01`) → `updatedAt`, noted compactly. The LLM checks against it: is this page current? For sources older than 6 months, the lint triggers a refresh suggestion.

## Two-phase lookup

The LLM uses the index for a lookup strategy in **two phases**, both of which are always executed:

1. **Phase 1 — Exact slug match** (Python script, string comparison): The extracted name is checked against all slugs in the index. Returns a candidate or "none".

2. **Phase 2 — Semantic summary match** (LLM-based): In parallel, the LLM receives all summaries of the matching category and searches for the semantically most similar page. Also returns a candidate or "none".

**Result reconciliation:**

- **Both return the same match** → confident match, load page
- **Only phase 1 matches** → slug match wins
- **Only phase 2 matches** → semantic match wins
- **Neither matches** → create new page

### How a new page is created

1. **Generate slug:** A slug is formed from the extracted name (`slugify("Dr. Maria Schneider")` → `maria-schneider`).
2. **Load template:** A template exists per page type in `wiki-schema.md`.
3. **Write page:** The LLM fills the template. The new page receives `status: review`.
4. **Index entry:** The new page is immediately added to the index.

## Why the index is so efficient

- **One file, one read.** No directory scan, no glob pattern.
- **Summaries as mini-embeddings.** The one-liners allow the LLM to do a semantic comparison without having to compute actual embeddings.
- **Metadata flags avoid unnecessary page loads.** The `❓` flag immediately shows: open questions — relevant for the dashboard, but no reason to load the page during ingest.
- **Claim IDs enable precise referencing.** Dashboards and cross-references can point directly to individual claims (`entity.seneca#claim-cortisol-senkung`).
- **Linearly scaling.** 500 pages = ~25 KB index — easily fits in a single LLM read.

Optionally, for vaults >500 pages, an embedding index (via `sentence-transformers` or `ollama`) can be added. The curated index remains the primary navigation mechanism, however.
