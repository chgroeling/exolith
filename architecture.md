# LLM Wiki — Karpathy-Pattern as a Python Project for OpenClaw

# TODO

* [ ] **Contested Claims — Define resolution workflow.** The compile process detects contradictions between claims and sets the status to `contested`, but a formal resolve process is missing:
* Resolve as a first-class operation (alongside Ingest, Query, Lint)
* Resolution rules: Confidence delta? Age of source? Methodological quality? Automatic vs. human decision?
* Resolution documentation: `resolved_by` field in the claim, `## Resolutions` section?
* Cascading: Check dependent claims when a referenced claim is resolved



> Idea / Design Document — Status 2026-05-07 (Feedback round 5 incorporated: Claim section shortened, Claim specification moved to Chapter 4, only Human Blocks marked, examples after explanations, Key Takeaways/Main Points clarified)

---

## Table of Contents

* [1. The Problem: Why RAG is Not Enough](https://www.google.com/search?q=%231-the-problem-why-rag-is-not-enough)
* [2. Basics — The Core Concepts](https://www.google.com/search?q=%232-basics--the-core-concepts)
* [3. The Architecture: Three Layers](https://www.google.com/search?q=%233-the-architecture-three-layers)
* [4. The Wiki Structure]()
* [4.1 Vault Layout & Page Types]()
* [4.2 Source — The Knowledge Foundation]()
* [4.3 Entity — Identifiable Things]()
* [4.4 Concept — Abstract Ideas]()
* [4.5 Synthesis — Cross-cutting Analyses]()
* [4.6 Report — Dashboards]()
* [4.7 Format Conventions]()
* [4.8 The Claim in Detail]()
* [4.9 index.md — The Content Catalog]()
* [4.10 log.md — The Chronicle]()


* [5. The Operations]()
* [5.1 Ingest — Overview]()
* [5.2 Query]()
* [5.3 Lint]()
* [5.4 Compile]()
* [5.5 Validate — Provenance Check]()


* [6. Design Principles]()
* [7. Expansions Beyond the Original Pattern]()
* [8. PKM Concepts]()
* [9. Use Cases]()
* [10. Glossary]()
* [11. Risks, Sources of Error, and Countermeasures]()
* [12. Summary]()
* [13. Sources]()

---

## 1. The Problem: Why RAG is Not Enough

Retrieval-Augmented Generation (RAG) is the status quo for "LLM meets documents": put chunks into a vector database, pull out the most similar chunks during a query, pack them into the prompt, and generate an answer. This works well for simple factual questions — but systematically fails on three points:

1. **No Knowledge Building.** Every query starts from scratch. The LLM has to re-synthesize from fragmented chunks every single time. Cross-references between documents do not exist — they are approximated at runtime via cosine similarity, which is error-prone and context-blind.
2. **No Accumulation.** If you read Paper A today and Paper B tomorrow, and Paper B contradicts Paper A, nobody notices. The contradiction is only "discovered" if both chunks happen to land in the same query by chance.
3. **No Curation.** RAG delivers raw chunks. There is no abstraction layer — no synthesis, no contextualization, no evaluation of the quality or timeliness of an information piece.

**Karpathy's Counter-Proposal:** Don't scrape everything together anew for every query; instead, **compile once and then keep it up to date**. The Wiki is a persistent, growing artifact — a curated, linked knowledge layer between you and the raw sources. Karpathy's most concise formulation:

> *"Obsidian is the IDE; the LLM is the programmer; the wiki is the codebase."*

---

## 2. Basics — The Core Concepts

Before we dive into the architecture and structure, here are the fundamental building blocks of the LLM Wiki. This chapter serves as a reference — if you encounter a term later, you will find it defined here.

### Raw Source

An unprocessed source document: article, paper, transcript, podcast note, chat export, book highlight. Raw Sources are **immutable** — the LLM only reads them during the initial Ingest, never overwriting them. They are stored in `raw-sources/`. After processing, they are no longer used by the LLM; they serve solely as the original reference for the human.

### Source

A processed Wiki page of type `source` in the `sources/` folder. The Source is created from a Raw Source during the Ingest step — prepared by the LLM, reviewed and (if necessary) corrected by a human. The Source is the **curated knowledge foundation**: Key Takeaways are prioritized, ambiguities are flagged, and the context is framed. All further processing (extraction, claims, updates) is based exclusively on Sources — never directly on Raw Sources.

### Wiki Page

An LLM-generated and maintained Markdown file with a fixed type: `source`, `entity`, `concept`, `synthesis`, or `report`. Each Page has a YAML frontmatter with metadata (ID, Status, Tags, Confidence) and structured chapters with Markdown headings.

### Entity

Describes an **identifiable thing**: person, organization, project, tool, place, or event. Entities are the "nouns" of the Wiki — they are what is being talked *about*. An Entity collects Claims, has links to other pages, and can reference multiple Sources. Example: `entity.seneca`, `entity.maria-schneider`.

### Concept

Describes an **abstract idea, theory, pattern, method, or framework**. Concepts are the "verbs and adjectives" of the Wiki — they describe *how* things are connected. A Concept collects Claims, has connections, and grows with every new source (Evergreen Notes). Example: `concept.praemeditatio-malorum`, `concept.stoicism`.

### Synthesis

A **cross-cutting analysis** that links multiple Entities or Concepts into a higher-level analysis. Unlike a Concept, which describes a single pattern, a Synthesis establishes a cross-connection between multiple Page types. It originates from Queries (≥3 sources linked), Compile detection, or manual triggering. Example: `synthesis.stoicism-and-empiricism`.

### Report

An **automatically generated dashboard** — completely regenerated with every Compile. Reports are read-only for humans; the LLM uses them for health monitoring. Example: `reports/open-questions.md`, `reports/contradictions.md`.

### Claim

The **central knowledge building block** of the Wiki — a single, verifiable assertion with a unique ID, Confidence, Status, and Evidence. Claims are structured entries in the `## Claims` chapter of every Content Page. They turn vague statements into a trackable belief system: Every Claim carries its own proof of provenance directly in the `*Evidence:*` field. The detailed Claim specification (fields, status values, ID conventions) is in [4.8 — The Claim in Detail]().

### Evidence

The proof for a Claim — always a wikilink to a Source in the `*Evidence:*` field. No Claim without Evidence. Every Claim carries its own proof of provenance directly attached to it, rather than referring to a separate source list. This makes traceability more granular and precise.

### Human Block

The only marked section in a Wiki page — enclosed by `<!-- llm-wiki:human:start -->` and `<!-- llm-wiki:human:end -->`. Contains handwritten notes by the human and is **never** touched by the LLM. Everything outside these markers is implicitly LLM-managed and may be read and written by the agent.

```markdown
{EVERYTHING outside the Human markers is LLM-managed: prose, Claims, links, Open Questions}

<!-- llm-wiki:human:start -->
[Handwritten notes — NEVER touched by the LLM]
<!-- llm-wiki:human:end -->

```

There are **no** Managed-Block markers. Only Human Blocks are explicitly marked — everything else is implicitly LLM-Managed. These are the only HTML comments in the system.

### Confidence

The trustworthiness of a Claim (0.0–1.0). Initially estimated by the LLM and calibrated by the Compile process based on four factors: Source type (30%), Evidence quality (30%), Number of pieces of evidence (20%), Recency (20%). The **Page-Level Confidence** is the arithmetic mean of all Claim Confidence values on the page.

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

**Layer 1 — The Schema (Foundation):** The configuration files that turn a generic LLM into a disciplined Wiki maintainer. Defines folder structure, page types, naming conventions (slug-based IDs: `entity.john-doe`, `concept.stoicism`), YAML frontmatter fields per page type, workflows for Ingest/Query/Lint, and formatting rules. Co-developed by human and LLM over time. This layer is the bedrock — it determines *how* raw material becomes structured knowledge.

**Layer 2 — Raw Sources (Input):** Your curated collection of sources. Articles, papers, podcast notes, chat exports, book highlights, meeting transcripts. This layer is *immutable* — the LLM only reads, never writes. This is your Source of Truth. New sources land in `inbox/`, processed ones in `raw-sources/`. Raw Sources are only read once for the Ingest; after that, the LLM works exclusively with the Sources created from them (Layer 3).

**Layer 3 — Wiki Pages (Output):** The resulting LLM-generated and maintained Markdown files. Sources (processed, human-verified knowledge foundation), Entity Pages (people, projects, tools, places), Concept Pages (ideas, theories, patterns), Syntheses (cross-cutting analyses), Reports (dashboards). The human reads; the LLM writes. Unlike the original, this layer is deliberately kept simple — it is the *result* of the processing, not a complex intermediate layer.

Layer 3 is internally divided into two clearly separated categories:

* **Content Pages** — sources, entities, concepts, syntheses, reports. These are the actual knowledge carriers. They contain Claims, evidence, cross-references. The human reads them actively; they are the purpose of the Wiki.
* **Meta Pages** — index.md, log.md. These are navigation and audit trails. They exist so the LLM can work efficiently (lookup, chronicle, provenance tracking). The human occasionally browses them, but they are not the knowledge store itself.

Both are written by the LLM, both live in the same Vault. The difference is the function: Content Pages *store* knowledge, Meta Pages *organize* access to it. A formal sub-layer separation would introduce more overhead than benefit — but the distinction flows conceptually into the schema (e.g., `index.md` and `log.md` get their own templates that will never be confused with a Content Page).

---

## 4. The Wiki Structure

This chapter defines the physical and logical structure of the Wiki Vault: which folders exist, which page types live in them, how they are structured, and how they are networked together. We start with the big picture — the Vault Layout — and then go into detail: the five page types, format conventions, and the meta-structures (Index and Log).

### 4.1 Vault Layout & Page Types

The Wiki is structured as follows:

```
wiki-vault/
├── AGENTS.md              # Layer 1: Schema for the agent
├── wiki-schema.md         # Layer 1: Wiki conventions (Templates, Style Guide)
├── index.md               # Layer 3: Content catalog (auto-generated)
├── log.md                 # Chronicle (append-only)
├── inbox/                 # Layer 2: New sources, not yet ingested
├── raw-sources/           # Layer 2: Raw sources (immutable, moved here post-Ingest)
├── sources/               # Layer 3: Processed sources — the knowledge foundation of the Wiki
├── entities/              # Layer 3: People, projects, tools, organizations
├── concepts/              # Layer 3: Ideas, patterns, theories
├── syntheses/             # Layer 3: Cross-cutting analyses
└── reports/               # Layer 3: Dashboards (auto-generated)

```

The raw sources reside in `raw-sources/` (immutable, the LLM only reads them during Ingest). After the Ingest, the LLM creates a **Source** in `sources/`. The Source is the **processed, human-verified knowledge foundation** — it contains the prepared content of the Raw Source, enriched by human feedback from the discussion (Step 2 of the Ingest). From this point on, the LLM works exclusively with the Source. The Raw Source is no longer used; it serves only as a traceable original reference for the human via the link in the Source.

Unlike the Raw Source, which is raw material, the Source is already curated knowledge: Key Takeaways are prioritized, ambiguities are flagged, the context is framed. All further processing steps (extraction, update) build on this foundation — not on the Raw Source.

**Overview of the five Page Types:**

| Type | Folder | Description |
| --- | --- | --- |
| `source` | `sources/` | Processed knowledge foundation from a Raw Source — the basis of all further processing |
| `entity` | `entities/` | Identifiable things: person, project, tool, organization |
| `concept` | `concepts/` | Abstract ideas, theories, patterns, methods |
| `synthesis` | `syntheses/` | Cross-cutting analyses, comparisons, theses |
| `report` | `reports/` | Auto-generated dashboards |

Below, each Page Type is described in detail — when it is created, what it contains, and how it is structured.

### 4.2 Source — The Knowledge Foundation

The Page Type `source` (located in `sources/`) is the **knowledge foundation** of the Wiki. Every Source is generated from a Raw Source (`raw-sources/`) in Ingest Step 3 — processed and enriched by the LLM, reviewed and potentially corrected by human feedback from the Key Takeaways discussion (Step 2). The Source is the pivot point: All subsequent processing (extraction of Entities, Concepts, Claims in Step 4; Updates in Step 5) is based exclusively on the Source, no longer on the Raw Source.

The Source links to the Raw Source so the human can view the original at any time. For the LLM, however, the Source is the sole subject of work — the Raw Source is not read again after the Ingest.

**When is a Source created?** During every Ingest — Step 3 of the pipeline. A Source is written exactly once and not modified by the LLM thereafter. The list of linked Wiki pages (automatically maintained by the Compile process) is the only exception.

**Structure of a Source:**

```markdown
---
id: source.letters-to-lucilius
page: source
title: Letters to Lucilius (13th Letter)
status: active
tags:
  - philosophy
  - stoicism
  - seneca
created: 2026-05-01
updated: 2026-05-01
---

# Letters to Lucilius (13th Letter)

*Type:* transcript
*Author(s):* Lucius Annaeus Seneca
*Date:* approx. 62–64 AD
*URL/Reference:* —
*Original file:* [[raw-sources/letters-to-lucilius-13.md]]

## Summary
{1-2 paragraphs on what the source states — neutral, no value judgment}

## Main Points
- Main Point 1
- Main Point 2

## Key Takeaways
- Takeaway 1
- Takeaway 2

## Linked Wiki Pages
- [[entities/seneca]] (2 Claims)
- [[concepts/praemeditatio-malorum]] (1 Claim)

```

**Special characteristics:**

* The `## Linked Wiki Pages` list is maintained **exclusively by the Compile process**, not by the LLM during Ingest.
* The Source is the *only* Page Type that links directly to a Raw Source (`[[raw-sources/...]]`) — and exclusively for the human.
* All other Page Types (entity, concept, synthesis) link solely to Sources.
* The Source is the processed foundation: what is not written here does not exist for the LLM. It is the bottleneck through which all raw knowledge flows and is vetted.
* The Source itself has no Human Block — it is completely LLM-managed.

---

### 4.3 Entity — Identifiable Things

The Page Type `entity` describes an **identifiable thing**: person, organization, project, tool, place, or event. Entities are the "nouns" of the Wiki — they are what is being talked *about*.

**When is an Entity created?** During Extraction (Step 4 of the Ingest) when the LLM detects a new person, organization, etc., in the source text that does not yet exist in the Wiki (Two-Phase Lookup fails → CREATE).

**Structure of an Entity (Example):**

```markdown
---
id: entity.seneca
page: entity
title: Seneca
confidence: 0.9
status: active
tags:
  - philosophy
  - stoicism
  - antiquity
created: 2026-04-15
updated: 2026-05-02
---

# Seneca

Lucius Annaeus Seneca (approx. 4 BC — 65 AD) was a Roman
philosopher, dramatist, and statesman. His "Letters to Lucilius" are
a collection of 124 moral letters. Seneca emphasized the practical
application of philosophy in daily life.

One of his most impactful techniques is **praemeditatio malorum**
— the conscious visualization of the worst-case scenario as an exercise against fear. This
technique was empirically confirmed in a 2024 meta-study by Dr. Maria Schneider: daily exercises lower cortisol levels by 18%.

## Claims

- `id:claim-seneca-fear-thesis` `conf:0.3` `status:uncertain`
  Seneca's thesis: "Most fears arise from anticipated suffering,
  not from real suffering"
  *Evidence:* [[sources/letters-to-lucilius]] (13th Letter)
  *Limitation:* Philosophical assertion, 2,000 years old, no empirical proof

- `id:claim-cortisol-reduction` `conf:0.85` `status:active`
  Praemeditatio malorum lowers cortisol by an average of 18%
  *Evidence:* [[sources/schneider-meta-study-2024]] (Paragraph 3, n=1,200)
  *Limitation:* No effect on participants under 25 years old

## Connections

- `defined` → [[concepts/praemeditatio-malorum]]
- `practiced` → [[concepts/stoicism]]
- `was_empirically_confirmed_by` → [[entities/maria-schneider]]
  *Note:* Schneider's meta-study (2024) proves Seneca's thesis

## Open Questions

- Does the cortisol reduction persist after stopping the exercises?
  *Context:* Study only measures acute effects

<!-- llm-wiki:human:start -->
## Personal Notes

I find Seneca's letters more accessible than Marcus Aurelius's
Meditations — less cryptic, more directly applicable.
<!-- llm-wiki:human:end -->

```

**Special characteristics:**

* Entities collect Claims that *concern* a person/organization — not just statements *from* them.
* `## Connections` lists directional relationships to other Entities and Concepts (e.g., `defined → [[concepts/praemeditatio-malorum]]`).
* An Entity can reference Claims from different Sources — each Claim carries its own evidence.
* Everything outside of `<!-- llm-wiki:human:start -->` / `<!-- llm-wiki:human:end -->` is implicitly LLM-managed.

---

### 4.4 Concept — Abstract Ideas

The Page Type `concept` describes an **abstract idea, theory, pattern, method, or framework**. Concepts are the "verbs and adjectives" of the Wiki — they describe *how* things are connected and *what* properties they possess.

**When is a Concept created?** During Extraction, when the LLM recognizes a new pattern, method, or theory. Concepts also arise from Queries ("What connects X and Y?") and are then suggested as Synthesis candidates.

**Structure of a Concept (Example):**

```markdown
---
id: concept.praemeditatio-malorum
page: concept
title: Praemeditatio Malorum
confidence: 0.7
status: active
tags:
  - stoicism
  - psychology
  - coping-with-fear
created: 2026-05-02
updated: 2026-05-02
---

# Praemeditatio Malorum

Praemeditatio malorum (Lat. "pre-meditation of evils") is a
Stoic exercise: the conscious, detailed visualization of the worst
that could happen. It serves to cope with fear — not through
suppression, but through confrontation. Seneca described it in the
13th Letter to Lucilius. In 2024, it was empirically confirmed by Dr. Maria Schneider (Cortisol reduction by 18%, n=1,200, Nature Human Behaviour).

## Claims

- `id:claim-cortisol-significant` `conf:0.85` `status:active`
  Daily praemeditatio significantly lowers cortisol (p < 0.001)
  *Evidence:* [[sources/schneider-meta-study-2024]] (Paragraph 3, n=1,200)
  *Limitation:* No effect on participants under 25 years old

- `id:claim-age-limit` `conf:0.8` `status:active`
  The effect only occurs in participants over 25 years old
  *Evidence:* [[sources/schneider-meta-study-2024]] (Paragraph 4)
  *Limitation:* Age limit not granularly investigated (only </≥25)

## Connections

- `defined_by` → [[entities/seneca]]
- `empirically_confirmed_by` → [[entities/maria-schneider]]
- `belongs_to` → [[concepts/stoicism]]
- `related_to` → [[concepts/dichotomy-of-control]]

## Open Questions

- Does the cortisol reduction persist after stopping the exercises?
  *Context:* Study only measures acute effects
- Why does praemeditatio not work for those under 25?
  *Context:* Possible explanation: prefrontal cortex not yet fully developed

<!-- llm-wiki:human:start -->
## Personal Notes

Been practicing this since January — subjectively noticeable effect before
presentations. The empirical confirmation makes it more credible to me.
<!-- llm-wiki:human:end -->

```

**Special characteristics:**

* Concepts collect Claims just like Entities do — every pattern, every method can be supported by empirical or theoretical Claims.
* Concepts are the heart of knowledge networking — they connect Entities and other Concepts.
* A Concept without empirical evidence is valid, but receives a lower Confidence.
* Concepts grow with every new source — they are Evergreen Notes in the classic sense.
* Here too: Everything outside the Human Block markers is implicitly LLM-managed.

---

### 4.5 Synthesis — Cross-cutting Analyses

The Page Type `synthesis` groups multiple Entities or Concepts into a **higher-level analysis**. Unlike a Concept, which describes a single pattern, a Synthesis establishes a **cross-connection** between multiple Page Types.

**When is a Synthesis created?**

* From a Query that links multiple pages (≥3 sources or a new connection discovered)
* When the Compile process detects that multiple pages illuminate the same topic from different perspectives
* Manually triggered by the human ("Compare X with Y")

**Examples of Syntheses:**

* `synthesis.stoicism-and-empiricism` — How Stoic concepts are confirmed or refuted by modern research
* `synthesis.c-plus-plus-embedded-vs-python` — Design philosophy differences between both language worlds
* `synthesis.depression-coping-strategies` — Comparison of different methods (Stoicism, CBT, Meditation) with evidence of efficacy

**Structure of a Synthesis (Example):**

```markdown
---
id: synthesis.stoicism-and-empiricism
page: synthesis
title: Stoicism and Empiricism — What the Research Says
confidence: 0.75
status: active
tags:
  - stoicism
  - psychology
  - empirical
  - meta-study
created: 2026-05-02
updated: 2026-05-02
---

# Stoicism and Empiricism

Modern psychology has empirically investigated several Stoic practices.
The results are mixed: Some concepts (praemeditatio malorum, Dichotomy
of Control) show measurable effects, others (Stoic theory of affects)
have not yet been operationalized.

## Claims

- `id:claim-praemeditatio-best-proven` `conf:0.85` `status:active`
  Praemeditatio malorum is the most empirically proven Stoic technique
  *Evidence:* [[sources/schneider-meta-study-2024]]
  *Limitation:* Other techniques (Dichotomy of Control) not investigated in controlled
  studies

- `id:claim-stoa-cbt-comparable` `conf:0.5` `status:uncertain`
  Stoic practices are comparable in efficacy to CBT
  *Evidence:* [[sources/cbt-guidelines-2023]] (indirect comparison)
  *Limitation:* No direct head-to-head comparison; confidence low

## Connections

- `compares` → [[concepts/praemeditatio-malorum]]
- `compares` → [[concepts/stoicism]]
- `contrasts_with` → [[concepts/cognitive-behavioral-therapy]]

## Open Questions

- Are there Stoic techniques that have been empirically *refuted*?
- How do Stoic and Buddhist meditation compare directly?

<!-- llm-wiki:human:start -->
## My Assessment

The empirical confirmation is nice, but for me, not the
crucial point. Stoicism works for me subjectively —
that is enough. Still fascinating to see that research
partially backs this up.
<!-- llm-wiki:human:end -->

```

**Special characteristics:**

* Syntheses also collect Claims — they aggregate and compare Claims from multiple sources, but also formulate their own synthesizing assertions.
* A Synthesis is **not automatically created** with every Ingest — it is a conscious step (Query filing or manual trigger).
* Bootstrap mode: With <50 pages in the Vault, no Syntheses are automatically suggested.
* The Confidence of a Synthesis is the weighted average of all referenced Claims.

---

### 4.6 Report — Dashboards

The Page Type `report` is an **automatically generated dashboard**. Unlike all other Page Types, a Report is completely regenerated with every Compile. Reports are read-only for humans; the LLM uses them for health monitoring.

**When is a Report created?** Exclusively during Compile (Phase 4: Dashboards). Never through Ingest or Query.

**List of Standard Reports:**

| Report | Description |
| --- | --- |
| `reports/open-questions.md` | All unresolved questions from all pages |
| `reports/contradictions.md` | Page-level and Claim-level contradictions |
| `reports/low-confidence.md` | Pages & Claims with confidence < 0.5 |
| `reports/claim-health.md` | Missing Evidence, Contested, Stale Claims |
| `reports/stale-pages.md` | Pages without an update despite new sources |
| `reports/person-directory.md` | All Entities of type "person" |
| `reports/relationship-graph.md` | All structured Relationships |
| `reports/provenance-coverage.md` | Evidence statistics per Source |
| `reports/privacy-review.md` | Pages with sensitive content |

**Structure of a Report (Example `reports/open-questions.md`):**

```markdown
---
id: report.open-questions
page: report
title: Open Questions
status: active
tags:
  - dashboard
created: 2026-05-02
updated: 2026-05-02
---

# Open Questions

> Auto-generated at 2026-05-02T10:35:00Z | 3 pages with 5 questions

## [[entities/seneca]]
- Does the cortisol reduction persist after stopping the exercises?
  *Context:* Study only measures acute effects

## [[concepts/praemeditatio-malorum]]
- Does the cortisol reduction persist after stopping the exercises?
  *Context:* Study only measures acute effects
- Why does praemeditatio not work for those under 25?
  *Context:* Possible explanation: prefrontal cortex not yet fully developed

## [[syntheses/stoicism-and-empiricism]]
- Are there Stoic techniques that have been empirically *refuted*?
- How do Stoic and Buddhist meditation compare directly?

```

**Special characteristics:**

* Reports have **no** Human Block — they are completely regenerated and contain no personal notes.
* Claims are identified in Dashboards via their `page-id#claim-id` reference.
* Reports are optional — the Compile process only generates those for which data actually exists.

---

### 4.7 Format Conventions

The entire Wiki uses Obsidian wikilinks (`[[path/to/page]]`) instead of Markdown links. Metadata that needs to be machine-parsed is located in the **YAML frontmatter** — Tags, ID, Page Type, Status, Confidence, Timestamps. Everything else (Claims, connections) is written as standard Markdown in the body.

**Human Blocks** (`<!-- llm-wiki:human:start -->` / `<!-- llm-wiki:human:end -->`) are the only HTML comments in the system and protect handwritten notes from being overwritten. Everything outside these markers is implicitly LLM-managed — there are no Managed-Block markers. Standard Markdown headings (`##`, `###`) are used exclusively for chapter structuring.

#### YAML Frontmatter: Fields in Detail

Every Wiki page begins with a YAML frontmatter block. The following fields are defined:

| Field | Req'd | Type | Description |
| --- | --- | --- | --- |
| `id` | ✅ | string | Unique identifier, e.g. `entity.seneca`. Prefix = Page Type, Suffix = Slug. |
| `page` | ✅ | enum | `source`, `entity`, `concept`, `synthesis`, `report` |
| `title` | ✅ | string | Display name of the page |
| `status` | ✅ | string | `active`, `review`, `archived` |
| `tags` | ✅ | list | Thematic tags for filtering (e.g. `[philosophy, stoicism]`) |
| `confidence` | ❌ | float | Page-Level Confidence (0.0–1.0). Average of all Claims. `null` for pages without Claims. |
| `created` | ✅ | date | Creation date (ISO 8601) |
| `updated` | ✅ | date | Last modified date (ISO 8601) |

**Rules:**

* `id` is unique across the entire Vault. No two pages may have the same ID.
* `page` must match the folder (`entities/seneca.md` → `page: entity`). Mismatch → Lint Error.
* `tags` are a YAML list, not inline flags. Tags are saved in lowercase and without a `#` prefix.
* `confidence` is `null` if the page has no Claims (e.g. freshly created, no extraction yet).
* `status: review` means: The page is new and has not yet been approved by a human.

#### Confidence — How It Is Calculated

The **Page-Level Confidence** (`confidence` in the YAML frontmatter) is the **arithmetic mean** of all Claim Confidence values on the page:

```
page.confidence = sum(claim.confidence for claim in claims) / len(claims)

```

The **Claim-Confidence** (`conf:0.X` in the `## Claims` chapter) is set by the LLM during extraction and is later refined by the