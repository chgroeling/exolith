# Vault Layout & Page Types

The Wiki Vault is a structured directory of Markdown files. This document defines the physical layout, the types of pages that live in each directory, and how they relate to each other.

## Directory Structure

```
wiki-vault/
├── AGENTS.md              # Layer 1: Schema for the agent
├── wiki-schema.md         # Layer 1: Wiki conventions (Templates, Style Guide)
├── index.md               # Layer 3: Content catalog (auto-generated)
├── log.md                 # Chronicle (append-only)
├── inbox/                 # Layer 2: New sources, not yet ingested
├── raw-sources/           # Layer 2: Raw sources (immutable, moved here post-ingest)
├── sources/               # Layer 3: Processed sources — the knowledge foundation
├── entities/              # Layer 3: People, projects, tools, organizations
├── concepts/              # Layer 3: Ideas, patterns, theories
├── syntheses/             # Layer 3: Cross-cutting analyses
└── reports/               # Layer 3: Dashboards (auto-generated)
```

## Three Architectural Layers

### Layer 1 — Schema (Foundation)

Configuration files that turn a generic LLM into a disciplined wiki maintainer. Defines folder structure, page types, naming conventions (slug-based IDs: `entity.john-doe`, `concept.stoicism`), YAML frontmatter fields per page type, workflows for ingest/query/lint, and formatting rules. Co-developed by human and LLM over time.

### Layer 2 — Raw Sources (Input)

The human's curated collection of source materials: articles, papers, podcast notes, chat exports, book highlights, meeting transcripts. This layer is **immutable** — the LLM only reads, never writes. New sources land in `inbox/`. After successful ingest, the raw source is moved to `raw-sources/`. Raw Sources are only read once for the initial ingest; thereafter the LLM works exclusively with the Sources created from them (Layer 3).

### Layer 3 — Wiki Pages (Output)

LLM-generated and maintained Markdown files. Divided into two categories:

* **Content Pages** — `sources/`, `entities/`, `concepts/`, `syntheses/`, `reports/`. These are the actual knowledge carriers. They contain claims, evidence, cross-references. The human reads them actively; they are the purpose of the wiki.
* **Meta Pages** — `index.md`, `log.md`. Navigation and audit trails. They exist so the LLM can work efficiently (lookup, chronicle, provenance tracking). The human occasionally browses them, but they are not the knowledge store itself.

## From Raw Source to Source

```
inbox/                    raw-sources/              sources/
┌──────────┐    Ingest    ┌──────────────┐          ┌──────────────────┐
│ new       │──────────→  │ immutable    │          │ curated knowledge│
│ article   │   Step 3    │ archive      │          │ foundation       │
│ .pdf/.md  │             │ (reference   │          │ (LLM working     │
│           │             │  for human)  │          │  material)       │
└──────────┘             └──────────────┘          └──────────────────┘
                                ↑                          │
                                └──────────────────────────┘
                                   wikilink for human
                                   traceability only
```

A Raw Source arrives in `inbox/`. During ingest step 3, the LLM creates a **Source** page in `sources/`. The Source is the **processed, human-verified knowledge foundation** — it contains the prepared content enriched by human feedback. The Raw Source is moved to `raw-sources/` as an immutable archive. From this point on, the LLM works exclusively with the Source. The Raw Source is referenced only via a wikilink in the Source for human traceability.

## Page Type Overview

| Type | Folder | Slug Pattern | Description |
| --- | --- | --- | --- |
| `source` | `sources/` | `source.{slug}` | [Processed knowledge foundation](source-spec.md) from a Raw Source — the basis of all further processing |
| `entity` | `entities/` | `entity.{slug}` | [Identifiable things](entity-spec.md): person, project, tool, organization, place, event |
| `concept` | `concepts/` | `concept.{slug}` | [Abstract ideas](concept-spec.md), theories, patterns, methods, frameworks |
| `synthesis` | `syntheses/` | `synthesis.{slug}` | [Cross-cutting analyses](synthesis-spec.md), comparisons, theses |
| `report` | `reports/` | `report.{slug}` | [Auto-generated dashboards](report-spec.md) — read-only for humans |

All page types share common [format conventions](format-spec.md) including YAML frontmatter, wikilinks, and Human Blocks.

## ID Naming Convention

Every page has a unique `id` in its YAML frontmatter: `<type>.<slug>`. Examples:

* `source.letters-to-lucilius`
* `entity.maria-schneider`
* `concept.praemeditatio-malorum`
* `synthesis.stoicism-and-empiricism`
* `report.open-questions`

The `id` must be unique across the entire vault. The `page` field in the YAML frontmatter must match the directory where the page lives — mismatch triggers a lint error.

## Content Pages vs. Meta Pages

| Aspect | Content Pages | Meta Pages |
| --- | --- | --- |
| **Purpose** | Store knowledge | Organize access |
| **Contains** | Claims, evidence, prose, connections | Catalog entries, log entries |
| **Human reads** | Actively | Occasionally |
| **LLM writes** | During ingest, query, compile | During compile, ingest (log) |
| **Has Human Block** | Yes (entities, concepts, syntheses) | No |
| **Examples** | `entities/seneca.md`, `concepts/stoicism.md` | `index.md`, `log.md` |

## See Also

* [../architecture.md](../architecture.md) — full architectural overview
* [format-spec.md](format-spec.md) — YAML frontmatter and format conventions
* [index-spec.md](index-spec.md) — content catalog (meta page)
* [log-spec.md](log-spec.md) — chronicle (meta page)
