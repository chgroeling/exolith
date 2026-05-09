# Compile

After every ingest, the compile step runs. It reads the entire vault and updates the cross-sectional structures. In contrast to ingest (which modifies individual pages in a targeted way), compile operates on the whole vault — it's the step that turns many individual pages into a coherent wiki.

## The Five Compile Phases

```
1. PARSE ALL PAGES
   Read every .md file in sources/, entities/, concepts/, syntheses/
   → parse YAML frontmatter + markdown chapters → populate WikiPage model
   ↓
2. GENERATE INDEX
   Build a categorized catalog from all WikiPage instances
   ↓
3. WRITE BACKLINKS
   For each page: generate ## Related block with sources, inbound links,
   shared-source neighbors → insert into the page
   ↓
4. GENERATE DASHBOARDS
   Cross-sectional analyses across all pages: Open Questions,
   Contradictions, Low Confidence, Claim Health, Stale Pages,
   Person Directory, Relationship Graph, provenance coverage
   ↓
5. WRITE DIGESTS
   agent-digest.json + claims.jsonl for machine consumption
```

## Index Generation in Detail

Index generation is Phase 2 of compile — and the heart of structural integrity.

**Process — step by step:**

1. **Read and group pages:**
   - Load all wiki pages from the vault (every `.md` file in `sources/`, `entities/`, `concepts/`, `syntheses/`, `reports/`)
   - Group by page type: Sources, Entities, Concepts, Syntheses, Reports

2. **Aggregate statistics:**
   - Sum total pages, number of sources, number of claims
   - Per page: extract claim count, open-questions flag, confidence from YAML frontmatter

3. **Generate one index line per page:**
   - Format: `- [[path/to/page]]` as wikilink
   - Metadata in backticks: `page:type` `X claims` `❓` `conf:0.X` `status` `#tags`
   - Summary as L1 one-liner (first sentence after `# Title`)

4. **Register claim IDs:**
   - Extract all `id:claim-xxx` from the `## Claims` chapter of each page
   - Store for direct referencing from dashboards and cross-references

5. **Output grouped by category:**
   - Sections in this order: `## Sources` → `## Entities` → `## Concepts` → `## Syntheses` → `## Reports`
   - Empty categories are not output
   - Sort alphabetically by `title` within each category

**Data flow sketch:**

```
Input: All wiki pages (.md files)
         │
         ├── Parse YAML frontmatter → id, title, page, tags, confidence, status, updated
         ├── Parse chapters
         │   ├── First sentence after # Title → summary (L1 one-liner)
         │   ├── ## Claims → claimCount, claimIds
         │   └── ## Offene Fragen → hasOpenQuestions
         │
         ├── Group pages by pageType
         ├── Format index line per page
         └── Output as categorized index.md
```

**Where the index fields come from:**

| Index field        | Source                                    | How extracted              |
| ------------------ | ----------------------------------------- | -------------------------- |
| `id`               | YAML frontmatter: `id`                    | YAML parse                 |
| `slug`             | `id` minus prefix                         | `entity.seneca` → `seneca` |
| `title`            | YAML frontmatter: `title`                 | YAML parse                 |
| `pageType`         | YAML frontmatter: `page` + directory check | Mismatch → lint warning    |
| `summary`          | First sentence after `# Title`            | L1 one-liner, max. 1 sentence |
| `path`             | File path relative to vault root          | From filesystem            |
| `claimCount`       | Claims in `## Claims` chapter             | Counted                    |
| `claimIds`         | `id:claim-xxx` in `## Claims` chapter     | Parsed                     |
| `hasOpenQuestions` | `len(questions) > 0`                      | Boolean                    |
| `confidence`       | YAML frontmatter: `confidence`            | YAML parse                 |
| `status`           | YAML frontmatter: `status`                | Default: `active`          |
| `tags`             | YAML frontmatter: `tags`                  | YAML parse as list         |
| `updatedAt`        | YAML frontmatter: `updated`               | Fallback: filesystem       |

## Incremental vs. Full Index

Compile always regenerates the index **fully** — not incrementally. This is a deliberate trade-off: a full index rebuild for <500 pages completes in milliseconds (pure filesystem scan + YAML/regex parse) and guarantees consistency. An incremental update would be error-prone (forgotten deletions, moved pages, changed sources). Only at >1,000 pages would you switch to incremental index building.

## Further Compile Phases

- **Backlink blocks** (`## Related`) inserted into every page — lists sources, backlinks, and shared-source neighbors
- **Dashboard reports** under `reports/` updated: Open Questions, Contradictions, Low Confidence, Claim Health, Stale Pages, Person/Agent Directory, Relationship Graph, provenance coverage, Privacy Review. Claims are identified in dashboards via their `page-id#claim-id` reference.
- **Machine-readable digests** written: `agent-digest.json` (compact summary of all pages incl. claim IDs) and `claims.jsonl` (all claims with full reference as JSON-Lines)
- Optional: update embedding index

Compile separates "writing data" (ingest) from "updating structure" — cleaner than doing both in one step.

## See Also

* [../architecture.md](../architecture.md) — architectural overview
* [../pages/index-spec.md](../pages/index-spec.md) — index.md specification (generated in phase 2)
* [../pages/report-spec.md](../pages/report-spec.md) — dashboard specification (generated in phase 4)
* [ingest.md](ingest.md) — ingest triggers compile as step 6
