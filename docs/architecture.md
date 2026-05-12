# Exolith — Architecture

> Idea / Design Document

## Table of Contents

1. [The Problem: Why RAG Is Not Enough](#1-the-problem-why-rag-is-not-enough)
2. [Foundations — The Core Concepts](#2-foundations--the-core-concepts)
3. [The Architecture: Three Layers](#3-the-architecture-three-layers)
4. [The Wiki Structure](#4-the-wiki-structure)
5. [The Operations](#5-the-operations)
6. [Design Principles](#6-design-principles)
7. [Extensions Compared to the Original Pattern](#7-extensions-compared-to-the-original-pattern)
8. [Risks, Error Sources, and Countermeasures](#8-risks-error-sources-and-countermeasures)
9. [Summary](#9-summary)

---

## 1. The Problem: Why RAG Is Not Enough

Retrieval-Augmented Generation (RAG) is the status quo for "LLM meets documents": chunks into a vector database, pull the most similar chunks on query, pack into prompt, generate answer. That works for simple factual questions — but systematically fails in three areas:

1. **No knowledge building.** Every query starts from scratch. The LLM must re-synthesize from fragmented chunks each time. Cross-references between documents don't exist — they are approximated at runtime via cosine similarity, which is error-prone and context-blind.

2. **No accumulation.** If you read Paper A today and Paper B tomorrow, which contradicts Paper A, nobody notices. The contradiction is only "discovered" if both chunks coincidentally land in the same query.

3. **No curation.** RAG delivers raw chunks. There is no abstraction layer — no synthesis, no classification, no assessment of information quality or timeliness.

**Karpathy's counter-proposal:** Not re-assembling with every query, but **compile once and then keep up to date**. The wiki is a persistent, growing artifact — a curated, linked knowledge layer between you and the raw sources. Karpathy's most concise formulation:

> *"Obsidian is the IDE; the LLM is the programmer; the wiki is the codebase."*

---

## 2. Foundations — The Core Concepts

Before we dive into the architecture and structure, here are the fundamental building blocks.

### Raw Source

An unprocessed source document: article, paper, transcript, podcast note, chat export, book highlight. Raw Sources are **immutable** — the LLM only reads them on first ingest, never overwrites them. After processing they are no longer used by the LLM; they serve solely as the original reference for the human.

### Source

A processed wiki page of type `source`. The Source is created from a Raw Source in the ingest step — prepared by the LLM, reviewed and possibly corrected by the human. The Source is the **curated knowledge foundation**: ambiguities are flagged, context is framed. All further processing (extraction, claims, updates) is based exclusively on Sources — never directly on Raw Sources.

> Full specification: [pages/source-spec.md](pages/source-spec.md)

### Wiki Page

An LLM-generated and maintained Markdown file with a fixed type: `source`, `entity`, `concept`, `synthesis`, or `report`. Every page has YAML frontmatter with metadata (ID, status, tags, confidence) and structured chapters with Markdown headings.

### Identifier

Every wiki entity — pages, claims, and any future type — has a unique, stable identifier following the pattern `{type}.{slug}` (e.g. `entity.seneca`, `claim.cortisol-senkung`). All identifiers are unique vault-wide.

> Specifications: [cross-cutting/slug-spec.md](cross-cutting/slug-spec.md) (slug rules), [cross-cutting/identifier-spec.md](cross-cutting/identifier-spec.md) (identifier patterns and uniqueness)

### Entity

Describes a distinct, identifiable thing — the "nouns" of the wiki. Entities may be concrete or abstract, singular or collective (people, organizations, projects, products, tools, places, concepts, works, datasets, events, systems). Each entity persists independently of any single document, collects claims, links to related entities, aggregates references from multiple sources, and evolves over time. Entities provide the canonical layer of meaning: pages, claims, and evidence are ultimately about entities. Example: `entity.seneca`, `entity.openai`, `entity.apollo-11`, `entity.postgresql`.

> Full specification: [pages/entity-spec.md](pages/entity-spec.md)

### Concept

Describes an **abstract idea, theory, pattern, method, or framework**. Concepts are the "verbs and adjectives" of the wiki — they describe *how* things relate. A concept collects claims, has connections, and grows with each new source (Evergreen Notes). Example: `concept.praemeditatio-malorum`, `concept.stoicism`.

> Full specification: [pages/concept-spec.md](pages/concept-spec.md)

### Synthesis

A **cross-cutting analysis** that links multiple entities or concepts into a higher-level analysis. Unlike a concept, which describes a single pattern, a synthesis establishes a cross-connection between multiple page types. Created from queries (≥3 sources linked), compile detection, or manual triggers. Example: `synthesis.stoicism-and-empiricism`.

> Full specification: [pages/synthesis-spec.md](pages/synthesis-spec.md)

### Report

An **automatically generated dashboard** — completely regenerated on every compile. Reports are read-only for the human; the LLM uses them for health monitoring. Examples: open questions report, contradictions report.

> Full specification: [pages/report-spec.md](pages/report-spec.md)

### Claim

The **central knowledge building block** of the wiki — a single, verifiable assertion with a unique ID, confidence, status, and evidence. Claims are structured entries in the `## Claims` chapter of every content page. They turn vague statements into a trackable belief system: every claim carries its own provenance directly in the `*Evidence:*` field.

> Full specification: [cross-cutting/claim-spec.md](cross-cutting/claim-spec.md)

### Human Block

The only marked section in a wiki page — enclosed by `<!-- exolith:human:start -->` and `<!-- exolith:human:end -->`. Contains the human's handwritten notes and is **never** touched by the LLM. Everything outside these markers is implicitly LLM-managed and may be read and written by the agent.

```markdown
{EVERYTHING outside the human markers is LLM-managed: prose, claims, links, open questions}

<!-- exolith:human:start -->
[Handwritten notes — NEVER touched by the LLM]
<!-- exolith:human:end -->
```

There is **no** managed-block marker. Only Human Blocks are explicitly marked — everything else is implicitly LLM-managed. These are the only HTML comments in the system.

### Confidence

Trustworthiness of a claim (0.0–1.0). Initially estimated by the LLM and calibrated by compile based on four factors: source type (30%), evidence quality (30%), number of pieces of evidence (20%), recency (20%). **Page-level confidence** is the arithmetic mean of all claim confidence values on the page.

> Full specification of the calibration model: [cross-cutting/confidence-spec.md](cross-cutting/confidence-spec.md)

---

## 3. The Architecture: Three Layers

The schema defines the rules of the game, the Raw Sources provide the input, the Wiki Pages are the result. No complex intermediate layer — a clear pipeline.

```
┌─────────────────────────────────────────────┐
│  The Schema    (foundation & rules)         │
│  AGENTS.md  wiki-schema.md  templates/      │
├─────────────────────────────────────────────┤
│  Raw Sources   (input, immutable)           │
│  raw-sources/  inbox/                       │
├─────────────────────────────────────────────┤
│  Wiki Pages    (output, LLM-maintained)     │
│  sources/  entities/  concepts/             │
│  syntheses/  reports/  index  log           │
└─────────────────────────────────────────────┘
```

**Layer 1 — The Schema (Foundation):** The configuration files that turn a generic LLM into a disciplined wiki maintainer. Defines folder structure, page types, naming conventions (identifiers: `entity.john-doe`, `concept.stoicism`), YAML frontmatter fields per page type, workflows for ingest/query/lint, and formatting rules. Co-developed by human and LLM over time. This layer is the bedrock — it determines *how* raw material becomes structured knowledge.

**Layer 2 — Raw Sources (Input):** Your curated collection of sources. Articles, papers, podcast notes, chat exports, book highlights, meeting transcripts. This layer is *immutable* — the LLM only reads, never writes. This is your Source of Truth. New sources land in `inbox/`, processed ones in `raw-sources/`. Raw Sources are only read once for the ingest; after that, the LLM works exclusively with the Sources created from them (Layer 3).

**Layer 3 — Wiki Pages (Output):** The resulting LLM-generated and maintained Markdown files. Sources (processed, human-verified knowledge foundation), Entity Pages (people, projects, tools, places), Concept Pages (ideas, theories, patterns), Syntheses (cross-cutting analyses), Reports (dashboards). The human reads; the LLM writes. This layer is deliberately kept simple — it is the *result* of the processing, not a complex intermediate layer.

Layer 3 is internally divided into two clearly separated categories:

* **Content Pages** — sources, entities, concepts, syntheses, reports. These are the actual knowledge carriers. They contain claims, evidence, cross-references. The human reads them actively; they are the purpose of the wiki.
* **Meta Pages** — index.md, log.md. These are navigation and audit trails. They exist so the LLM can work efficiently (lookup, chronicle, provenance tracking). The human occasionally browses them, but they are not the knowledge store itself.

> Full specification of the vault layout: [cross-cutting/vault-layout.md](cross-cutting/vault-layout.md)

---

## 4. The Wiki Structure

The Wiki Vault is a structured directory of Markdown files. The physical layout, page types, and relationships between them are specified in [cross-cutting/vault-layout.md](cross-cutting/vault-layout.md).

### Page Types

Every wiki page belongs to one of five types:

| Type | Folder | Spec | Description |
| --- | --- | --- | --- |
| `source` | `sources/` | [source-spec.md](pages/source-spec.md) | Processed knowledge foundation from a Raw Source |
| `entity` | `entities/` | [entity-spec.md](pages/entity-spec.md) | Distinct, identifiable things — the "nouns" of the wiki |
| `concept` | `concepts/` | [concept-spec.md](pages/concept-spec.md) | Abstract ideas, theories, patterns, methods |
| `synthesis` | `syntheses/` | [synthesis-spec.md](pages/synthesis-spec.md) | Cross-cutting analyses, comparisons, theses |
| `report` | `reports/` | [report-spec.md](pages/report-spec.md) | Auto-generated dashboards |

### Format Conventions

All pages use Obsidian wikilinks (`[[path/to/page]]`), YAML frontmatter for metadata (id, page, title, status, tags, confidence, created, updated), and Human Blocks (`<!-- exolith:human:start -->` / `<!-- exolith:human:end -->`) as the only HTML comments. Page-level confidence is the arithmetic mean of all claim confidence values; claim confidence is calibrated via a four-factor model (source type, evidence quality, number of pieces of evidence, recency).

> Full specification: [cross-cutting/format-spec.md](cross-cutting/format-spec.md)

### Claims

Claims are structured assertions in the `## Claims` chapter with unique identifiers, confidence, status, and mandatory `*Evidence:*` wikilinks to Sources. Claims are vault-wide unique and tracked via their identifier.

> Full specification: [cross-cutting/claim-spec.md](cross-cutting/claim-spec.md)

### Meta Pages

* **[index.md](pages/index-spec.md)** — Auto-generated content catalog. Every page listed with slug, one-liner summary, claim count, confidence, tags. Supports two-phase lookup (exact slug match + semantic summary match). Even at 500 pages, it's ~25 KB — a single LLM read.
* **[log.md](pages/log-spec.md)** — Append-only chronicle of all operations. Reverse-chronological. The LLM reads the top 15-20 lines at session start to know what changed.

---

## 5. The Operations

The wiki is maintained through seven first-class operations:

| Operation | Spec | Description |
| --- | --- | --- |
| **Pre-Ingest** | [operations/pre-ingest.md](operations/pre-ingest.md) | Read raw → (optional) Discuss → Write source page to `sources/` |
| **Ingest** | [operations/ingest.md](operations/ingest.md) | Process a source page: extract → update wiki → compile → log |
| **Compile** | [operations/compile.md](operations/compile.md) | Read entire vault, regenerate index, backlinks, dashboards, machine-readable digests |
| **Lint** | [operations/lint.md](operations/lint.md) | Health check: structural errors, missing evidence, broken links, contradictions, stale claims. Generates a research agenda. |
| **Query** | [operations/query.md](operations/query.md) | Ask questions against compiled knowledge. Four phases: index scan → progressive deep-dive (L1-L4) → synthesis → query filing. |
| **Validate** | [operations/validate.md](operations/validate.md) | Provenance check. Spot-checks 5% of new claims against their sources with a stronger model to combat hallucination. |
| **Resolve** | [operations/resolution.md](operations/resolution.md) | Formally resolve contested claims. Resolution rules (confidence delta, source age, methodological quality). Automatic or human decision with cascading check on dependent claims. |

The core maintenance loop is **Pre-Ingest → Ingest → Compile → Lint**, with **Query** as the read-side operation, **Validate** as the integrity check, and **Resolve** as the conflict resolution workflow.

---

## 6. Design Principles

### 6.1 Human Blocks — Human and Agent in the Same File

Every wiki page can contain Human Blocks — the only HTML comments in the entire system. Everything outside these markers is implicitly LLM-managed:

```markdown
[Implicitly LLM-managed: prose, claims, links, open questions —
 everything outside the human markers may be read and written by the agent.]

<!-- exolith:human:start -->
[My handwritten notes — NEVER touched]
<!-- exolith:human:end -->
```

This builds trust: The agent can regenerate pages arbitrarily without destroying human annotations. The markers need no parser — pure regex/string matching. There are no managed-block markers; only Human Blocks are explicitly designated. Everything outside is implicitly LLM-managed.

### 6.2 Structured Claims Instead of Just Prose

Claims are structured data in the `## Claims` chapter, not just flowing text. Every claim has a unique ID:

```markdown
## Claims
- `id:claim.stoicism-stress` `conf:0.7` `status:active`
  Stoicism demonstrably reduces stress
  *Evidence:* [[sources/meta-analysis-2024]] (lines 45-62, n=1,200)
  *Evidence:* [[sources/personal-experience]] (lines 12-18)
```

This turns "I believe X" into a trackable belief system: claims can be directly referenced, evaluated, weighted, questioned, and updated via their ID — without destroying the surrounding prose.

### 6.3 Conflict Detection on Ingest

Before new claims are merged, the system checks:

* Does the new claim contradict an existing one? → Mark both as `contested`, create contradiction cluster
* Does the new claim supersede an older one with higher authority? → Confidence weighting by source type
* Is the existing claim obsolete? → `stale` flag with new claim as update candidate

Conflict detection works in two stages: first embedding-based similarity comparison, then LLM validation.

> Resolution of contested claims: [operations/resolution.md](operations/resolution.md)

### 6.4 Source Attribution via Claims

No claim without evidence. The `*Evidence:*` field of every claim always contains a wikilink to a Source — this is the mandatory provenance record. Entities, Concepts, and Syntheses link exclusively to Sources in `sources/`, not to Raw Sources. Provenance is thus anchored in every claim: every assertion carries its own evidence.

### 6.5 Dashboards as Health Monitoring

Instead of just ad-hoc lint, the compile step automatically generates dashboard pages under `reports/`:

* **Open Questions** — all unresolved questions from all pages
* **Contradictions** — page-level and claim-level contradictions
* **Low Confidence** — pages and claims with confidence < 0.5
* **Claim Health** — missing evidence, contested, stale claims
* **Stale Pages** — pages without updates despite new sources
* **Person/Agent Directory** — people with routing metadata
* **Relationship Graph** — all structured relationships
* **Source Coverage** — evidence statistics per source
* **Privacy Review** — pages with sensitive content

These dashboards are themselves wiki pages — the LLM can read them, the human can browse them.

---

## 7. Extensions Compared to the Original Pattern

| Aspect | Karpathy (Gist) | This Design |
| --- | --- | --- |
| **Source Pages** | Summaries as provenance | Sources as curated knowledge base — the sole place from which extraction and updates are fed |
| **Claims** | Flowing text | [Structured](cross-cutting/claim-spec.md) with own ID, evidence, confidence, status |
| **Human/Agent Coexistence** | Not addressed | Human Blocks (only human areas marked, everything else implicitly LLM-managed) |
| **Health Monitoring** | Ad-hoc lint | Automatic dashboards on every compile |
| **Query Filing** | Mentioned | Systematic [query-to-page pipeline](operations/query.md) |
| **Conflict Detection** | Not addressed | Automatic on ingest with two-stage validation + [resolution workflow](operations/resolution.md) |
| **Progressive Summarization** | Not addressed | L1-L4 compression levels |
| **Index** | Simple catalog | Catalog with slug lookup + semantic summary match + claim ID registry |
| **Lint** | Checklist | Structured issues (severity, category, code) + research agenda |
| **Multi-Source Conflicts** | Not addressed | Claim contradiction clustering with ID-based referencing |
| **Machine-Readable Output** | Not addressed | `agent-digest.json`, `claims.jsonl` |
| **Metadata Format** | Not specified | [YAML frontmatter](cross-cutting/format-spec.md) for machine-readable fields |
| **Claims as Source Attribution** | Not specified | Every claim carries its evidence directly in the `*Evidence:*` field |
| **Confidence Calibration** | Not addressed | [Four-factor model](cross-cutting/confidence-spec.md) (source type, evidence quality, number of sources, recency) |
| **Page Type Documentation** | Not addressed | Every page type documented in detail ([cross-cutting/](cross-cutting/)) |
| **Contested Claims Resolution** | Not addressed | [First-class resolve operation](operations/resolution.md) with resolution rules, documentation, cascading |

---

## 8. Risks, Error Sources, and Countermeasures

### Cold Start (Bootstrap Mode)

**Problem:** When the wiki starts, semantic matching has few reference points. The index is thin, summaries are few — the LLM has difficulty mapping concepts.

**Countermeasures:**
* Manual guidance: The system asks more frequently for the first 20 ingests — *"I found 'Stoic Ethics'. Should I create a new concept for this or does it fit under 'Philosophy'?"*
* An `is_bootstrapping: true` flag in `agent-digest.json` suppresses automatic syntheses and forces human confirmation for new entities/concepts.
* Only from ~50 pages onward is automatic mode fully activated.

### Schema Migration

**Problem:** You decide to rename the `confidence` field to `reliability` — all existing pages still have the old field.

**Countermeasures:**
* A migration agent reads `wiki-schema.md` (new) vs. the page's `_schema_version` (old).
* Migration as explicit command: `python exolith.py migrate --target-version 2.0`.
* The script runs over all `.md` files and transforms the YAML frontmatter fields to the new schema.
* Before each migration: git commit as a rollback point.

### Hallucination as "Knowledge"

**Problem:** The LLM invents facts, writes them as claims into the wiki, and the fabricated claims become the basis for later queries — a self-reinforcing error.

**Countermeasures:**
* Every claim **must** have at least one `*Evidence:*` with a wikilink to a Source. Claims without evidence are reported by lint as `claim-missing-evidence`.
* Confidence from evidence quality (peer-reviewed > book > blog post > LLM-generated). Low-confidence claims (< 0.5) prominently marked.
* Ingest prompt explicitly requests source citations. No source → `status: uncertain`.
* Human-in-the-loop: Review the diff after each ingest (~2-3 minutes for 10-15 pages).
* `review` status flag for pages not yet approved by a human.
* [Validate step](operations/validate.md): spot-check cross-checking with a stronger model.

### Knowledge Goes Stale Unnoticed

**Problem:** Claims remain `active` even though newer sources have refuted them or the original study is 10 years old.

**Countermeasures:**
* `updated` in the YAML frontmatter per page. Lint marks claims older than N days as `stale`.
* Ingest checks for contradictions with existing claims on each new source.
* Stale Pages dashboard shows untended pages.
* Proactive update: New source with the same source reference → suggest claim for review.

### Unstructured Growth

**Problem:** After 50+ sources and 200+ pages the wiki becomes unwieldy. Duplicates arise because similar concepts are created under different names.

**Countermeasures:**
* Fixed page types with folders. Compile checks directory consistency.
* Lint finds duplicate identifiers, orphan pages, broken wikilinks.
* Merge strategy: Before creating a new page, check via semantic similarity whether a similar one exists.
* Slug-based IDs enforce uniqueness.

### Agent Destroys Human Notes

**Problem:** The LLM overwrites handwritten annotations when updating a page.

**Countermeasures:**
* Human Blocks strictly protected as the only marked areas. Everything outside is implicitly LLM-managed.
* Human Blocks (`<!-- exolith:human:start -->` / `<!-- exolith:human:end -->`) are never touched.
* Git as safety net: before compile `git commit`, on error `git revert`.

### Scope Creep — the Wiki as an End in Itself

**Problem:** Wiki maintenance consumes more time than it saves. Every query → five new pages. The vault proliferates.

**Countermeasures:**
* YAGNI: Not every answer needs a synthesis page. Only with ≥3 sources or a new connection.
* Query-to-page is a suggestion, not an automatic action. Human confirms.
* Schema defines minimum requirements: "Concept needs ≥3 linked sources."
* Archiving: `status: archived` hides from active index.

### Loss of Nuance

**Problem:** Paper says "X holds under A, B, C". LLM extracts "X holds". Claim becomes misleading — the constraints are lost.

**Countermeasures:**
* Ingest prompt: "Extract conditions, limitations, uncertainties."
* Claims with qualifier fields: `*Limitation:*` explicitly documents the conditions.
* On contradictions, don't automatically prefer newer → both `contested`.

### Prompt Drift Across Sessions

**Problem:** Session 1 vs. Session 10 — inconsistent style, uneven quality. The wiki becomes a patchwork.

**Countermeasures:**
* Schema defines templates and golden example pages per type.
* Compile normalizes formatting.
* Lint checks schema conformance.
* AGENTS.md as single source of truth for all agents.

### Loss of Trust Due to Faulty Queries

**Problem:** Query returns wrong answer but convincingly cites wiki pages. The human loses trust in the entire system.

**Countermeasures:**
* Answers list referenced claims with confidence: "Claim X from Source Y (Confidence: 0.7)".
* Explicit marking: "wiki-based" vs. "speculative" (LLM synthesis without evidence).
* On low confidence: proactive question "Should I research a new source?"

### Cost Explosion with Large Vaults

**Problem:** Every compile reads all pages. At 500+ pages LLM calls become expensive.

**Countermeasures:**
* Incremental compile: Only pages changed since last compile (from ~500 pages).
* Index-first query: First `index.md`, then 3–5 pages — not the whole vault.
* Progressive Summarization: L1 scan saves full-page reads.
* Embedding index only from >500 pages.
* Ollama (local) for bulk operations, cloud models only for complex syntheses.

### Multi-Agent Inconsistency

**Problem:** Different models/sessions → patchwork style. Claude writes differently than GPT-4o.

**Countermeasures:**
* Schema with style guide and binding examples.
* Compile: optional normalize pass for headings, YAML frontmatter, links.
* Bridge mode: Only import structured data, always regenerate prose.

---

## 9. Summary

The pattern is astonishingly simple:

1. **Collect Raw Sources** (immutable in `raw-sources/`)
2. **Pre-Ingest: Create Source Pages** (processed, optionally discussed, human-reviewed knowledge base in `sources/`)
3. **Ingest: LLM builds and maintains a wiki from source pages** (interlinked Markdown, structured claims with IDs, based on Sources)
4. **Schema defines the rules** (AGENTS.md, wiki-schema.md)
5. **Pre-Ingest → Ingest → Compile → Lint** as the maintenance loop
6. **Query** accesses compiled knowledge, not raw chunks

The decisive shift: knowledge is **compiled once** and then kept current — not re-assembled for each question. And the critical second shift: Sources are not just provenance records, but the **curated knowledge base** through which all raw knowledge flows and on which all further processing builds. The wiki is a growing, compounding artifact. The LLM does the bookkeeping no human wants to do. The human thinks, curates sources, asks the right questions.

The technical implementation is deliberately kept lean: Plain-text Markdown with YAML frontmatter, no database, no server, no cloud dependency. The wiki is readable in any text editor, versionable with Git, and optionally visually navigable via Obsidian. The intelligence resides in the prompts and the pipeline architecture, not in the infrastructure.
