# Ingest

The core workflow. A source is not just indexed, but **actively integrated into the wiki**. This is the decisive difference from RAG: not storing chunks and searching later, but weaving the knowledge into the existing structure immediately.

## The Seven Steps of Ingest

1. LLM reads the raw source completely (not chunk-by-chunk)
2. Discusses key takeaways with the human (optional, but recommended)
3. Writes a source page in `sources/` — the processed knowledge base
4. **Extracts** entities, concepts, claims, relationships **exclusively from the source**
5. **Updates all affected wiki pages** — a single source can touch 10-15 pages
6. Triggers the **compile** step: index.md, backlinks, dashboards
7. Writes an entry in `log.md`

---

## Step 1 — Read Raw Source Completely

The first step is the simplest but most critical: the LLM receives the entire source text at once, not chunk-by-chunk. This is the fundamental difference from RAG — the LLM understands the full context, recognizes implicit connections, and can establish cross-references within the source that chunk-based systems miss.

New sources land in `inbox/`. After processing (step 3), the raw source is moved to `raw-sources/` — that is the archive. `raw-sources/` is not processed further by the LLM; it serves exclusively as a reference for the human. The sources in `sources/` link to the corresponding raw source in `raw-sources/` via wikilink (`*Originaldatei:*`).

**Prompt for Step 1:**

```markdown
Read the following source text completely. Take notes on:
- Main statements and line of argument
- Named people, organizations, methods, theories
- Notable claims with or without evidence
- Contradictions to what you already know about the topic

Source: {title} ({source_type})

{source_content}

After reading, we will summarize the key takeaways before
structured extraction begins.
```

Here the LLM only reads and builds a mental model. It does not write anything yet. The context is then "warm" — all subsequent steps (discussion, source creation, extraction, update) benefit from the source being fully in the LLM's short-term memory.

---

## Step 2 — Discuss Key Takeaways & Main Points (optional)

Before the LLM creates the source and extracts knowledge, the human can initiate a brief discussion. From the read source text (step 1), the LLM formulates both the **Main Points** (the author's central statements — neutral, descriptive) and the **Key Takeaways** (what *you* find interesting — which statements are relevant to your wiki, which confirm or contradict existing knowledge, what is new). The human gives feedback on both: "This main point is the core," "I would weight this takeaway differently," "here the source contradicts my experience."

This step is optional but valuable for:
- **New, complex sources** (>5 pages), where the LLM doesn't have the full overview
- **Contradictory content**, where the human must assess epistemic authority ("This is a blog post, not a paper — weight it low")
- **Personal notes**, where the human has supplementary context not in the text

The human feedback from this step flows directly into source creation (step 3) — the source is thus not just an LLM summary, but a human-reviewed and potentially corrected document.

**The Discussion Prompt (Template):**

```markdown
You have just read the following source: {title} ({source_type})

Formulate:
1. The 3-5 central Main Points of the text (what the author says — descriptive)
2. Your 3-5 Key Takeaways (what is relevant to the wiki — evaluative)
3. Which of these statements confirm, extend, or contradict
   existing wiki knowledge (briefly check index.md for this)
4. Which parts require interpretation

Your human partner will respond before extraction begins.
```

---

## Step 3 — Write Source Page

The source page in `sources/` is the **processed knowledge base** of the wiki. It is created from the raw source (read in step 1), enriched by the human feedback from the discussion (step 2).

**Template for Source Pages:**

```markdown
---
id: source.{slug}
title: {title}
status: active
tags:
  - {tag1}
  - {tag2}
created: {YYYY-MM-DD}
updated: {YYYY-MM-DD}
---

# {title}

*Typ:* {article|paper|transcript|note|book}
*Autor(en):* {authors}
*Datum:* {date}
*URL/Referenz:* {url_or_ref}
*Originaldatei:* [[raw-sources/{raw_filename}]]

## Zusammenfassung
{1-2 paragraphs, what the source states — neutral, no value judgment}

## Main Points
- Main Point 1
- Main Point 2
- ...

## Key Takeaways
- Takeaway 1
- Takeaway 2
- ...

## Verlinkte Wiki-Seiten
- [[entities/seneca]] (2 Claims)
- [[concepts/praemeditatio-malorum]] (1 Claim)
```

The source links to the raw source in `raw-sources/` — but exclusively for the human. For the LLM, the source is the sole working object from this point on. The raw source is not read again after step 3. All further processing (extraction in step 4, updates in step 5) is based exclusively on the source.

---

## Step 4 — Extraction

Step 4 is the heart of ingest — here the curated source becomes machine-readable knowledge.

**Important context switch:** From this step on, the LLM works **exclusively with the source** from step 3. The raw text from step 1 is no longer used — the LLM context is cleaned. Only what is in the source exists for extraction.

**The Extraction Prompt (Template):**

```markdown
You are a knowledge extractor. Your task is to extract structured
knowledge from the following source. Extract ONLY what is explicitly
stated in the source — do not invent anything.

## Source
Title: {title}
Type: {source_type}
ID: {source_id}

{source_content}

## Extraction Instructions

1. **Entities** — identifiable things (people, organizations,
   projects, tools, places, events).
   Format: `name | typ | beschreibung (1 satz) | schlüsselzitat`

2. **Concepts** — abstract ideas, theories, methods, patterns,
   frameworks.
   Format: `name | domäne | definition (1-2 sätze) | schlüsselzitat`

3. **Claims** — verifiable assertions contained in the source.
   Each claim needs a unique claim ID (slug pattern),
   and an assessment of how strongly the source supports it.
   Format: `claim-id | text | confidence (0-1) | evidence location (paragraph/line) | einschränkungen`

4. **Relationships** — explicit connections between entities
   and/or concepts.
   Format: `von | beziehung | nach | begründung (1 satz)`

5. **Open Questions** — questions the source raises but does not
   answer.
   Format: `frage | kontext (warum ist sie relevant)`

## Output
Deliver ONLY the structured extraction in the specified format.
No introduction, no commentary.
```

**Concrete Example — Output (Extraction):**

```
## Entities
Dr. Maria Schneider | person | Researcher at University of Tübingen, author of the 2024 meta-study | "…in a meta-study (n=1,200)…"
Seneca | person | Roman philosopher, Stoic | "Seneca describes in the 13th letter…"

## Concepts
praemeditatio malorum | philosophy/psychology | Stoic exercise: deliberate visualization of the worst case | "the deliberate visualization of the worst case as an exercise against fear"
Cortisol reduction through meditation | neurobiology | measurable effect of mental exercises on stress hormones | "reduce cortisol levels by 18%"

## Claims
claim-cortisol-senkung | praemeditatio malorum reduces cortisol by 18% | 0.85 | Paragraph 2 | Meta-study, n=1,200, Nature Human Behaviour; limitation: no effect <25 yrs
claim-seneca-angst-these | Anxieties arise from anticipation, not from real events | 0.3 | Paragraph 1 | Seneca's philosophical assertion, no empirical evidence

## Relationships
Seneca | defined | praemeditatio malorum | 13th letter to Lucilius
Dr. Maria Schneider | provided_empirical_evidence_for | praemeditatio malorum | Meta-study (cortisol -18%)

## Open Questions
Does the cortisol reduction persist after discontinuing the exercises? | only acute effects measured
```

---

## Step 5 — Update

Step 5 is the actual wiki work — here the LLM decides for each extracted knowledge element *where* it belongs and *how* it is integrated.

### Process — Index-First with Two-Phase Lookup

The update step does not begin with a filesystem scan, but with a **two-phase index lookup**: first exact slug match (string comparison), then semantic summary match (LLM-based).

```
1. READ index.md (one file, ~12 KB)
   ↓
2. For each extracted element:
   ┌─ PHASE 1: Exact Slug Match (string comparison, no LLM)
   │  entity.seneca ↔ slug "seneca" → HIT ✓
   │  concept.praemeditatio-malorum ↔ slug
   │    "praemeditatio-malorum" → HIT ✓
   │  "Dr. Maria Schneider" ↔ slug "maria-schneider"
   │    → NO slug hit → continue to Phase 2
   │  "Cortisol reduction" ↔ slugs → NO hit → continue to Phase 2
   │
   └─ PHASE 2: Semantic Summary Match (LLM-based)

      Only for elements without a Phase 1 hit:
      LLM receives all summaries of the matching category
      and checks semantic similarity.
      "Dr. Maria Schneider" → all entity summaries → "none"
      "Cortisol reduction" → all concept summaries →
        "cortisol-senkung-durch-meditation" → HIT ✓
   ↓
3. Only on HITS: load the corresponding page and update
   On NO HIT: generate a new page from template
   → Result: 3-4 pages loaded (not all 27)
```

### The Decision Logic

```
For each extracted entity:
  ├─ Phase 1: Exact slug match?
  │   ├─ YES → LOAD PAGE → UPDATE
  │   └─ NO → Phase 2: Semantic summary match (LLM)?
  │       ├─ YES → LOAD PAGE → UPDATE (possibly merge two similar pages)
  │       └─ NO → CREATE: New page from entity template

For each extracted concept:
  ├─ Phase 1: Exact slug match?
  │   ├─ YES → LOAD PAGE → UPDATE
  │   └─ NO → Phase 2: Semantic summary match (LLM)?
  │       ├─ YES → LOAD PAGE → check whether merge or separate concept
  │       └─ NO → CREATE: New page from concept template

For each extracted claim (after loading the target page):
  ├─ Is there a substantively similar claim on the page?
  │   ├─ YES and new claim has HIGHER confidence
  │   │   └─ SUPERSEDE: Supersede old claim, activate new one
  │   ├─ YES and new claim has LOWER/EQUAL confidence
  │   │   └─ APPEND: Add as additional perspective
  │   ├─ YES and claims CONTRADICT each other
  │   │   └─ CONFLICT: Mark both as contested, create contradiction cluster
  │   └─ NO → CREATE: Create new claim with evidence and new claim ID

For each extracted relationship:
  ├─ Does this connection already exist on the loaded page?
  │   ├─ YES → SKIP (duplicate)
  │   └─ NO → CREATE: Enter on BOTH affected pages (also update the other side)

For each open question:
  └─ Enter on the loaded affected pages as ## Offene Fragen
```

### The Update Prompt

This prompt is executed **individually per affected page**.

```markdown
You are a wiki maintainer. Your task is to update ONE existing
wiki page with new knowledge from a just-ingested source.
This prompt concerns EXCLUSIVELY the page specified below —
other pages receive their own prompts.

## Existing Page
{current_page_content}

## New Knowledge from Source "{source_title}" (ID: [[sources/{source_slug}]])
- Entities: {extracted_entities_for_this_page}
- Claims: {extracted_claims_for_this_page}
- Relationships: {extracted_relationships_for_this_page}
- Open Questions: {extracted_questions_for_this_page}

## Update Rules

1. **Human Block** — Your changes go ONLY into the implicitly LLM-managed
   area. Human blocks (`<!-- exolith:human -->`) are OFF-LIMITS.

2. **Update prose** — Integrate the new information seamlessly
   into the existing text. No "Update: ..." prefix, but genuine merge.

3. **Append claims** — Add new claims in the `## Claims` chapter,
   with unique claim ID (`id:claim-xxx`) and inline metadata
   (`conf:0.X` `status:...`). Do not delete existing claims
   (unless superseded → `status:superseded`).
   Each claim receives a new, stable ID that never changes.

4. **Maintain relationships** — Add new connections in the `## Verknüpfungen`
   chapter. RECIPROCAL: If A → B is new, also add B → A.

5. **Mark contradictions** — If a new claim contradicts an existing one:
   do NOT resolve independently. Mark both with `status:contested`.

6. **Open Questions** — Add new questions to the `## Offene Fragen` chapter.

## Output
Deliver the COMPLETE updated page.
No diff, no commentary — the whole page.
```

### Before/After — Example on the `entity.seneca` Page

**Before Ingest:**

```markdown
---
id: entity.seneca
title: Seneca
confidence: 0.8
status: active
tags:
  - philosophie
  - stoizismus
  - antike
created: 2026-04-15
updated: 2026-04-15
---

# Seneca

Lucius Annaeus Seneca (ca. 4 BC — 65 AD) was a Roman
philosopher, dramatist, and statesman. His "Letters to Lucilius" are
a collection of 124 moral letters.

Seneca emphasized the practical application of philosophy in everyday life.
Central is the distinction between what we can control
and what we cannot control.

<!-- exolith:human:start -->
## Persönliche Notizen
I find Seneca's letters more accessible than Marcus Aurelius's
Meditations — less cryptic, more directly applicable.
<!-- exolith:human:end -->
```

**After Ingest:**

```markdown
---
id: entity.seneca
title: Seneca
confidence: 0.8
status: active
tags:
  - philosophie
  - stoizismus
  - antike
created: 2026-04-15
updated: 2026-05-02
---

# Seneca

Lucius Annaeus Seneca (ca. 4 BC — 65 AD) was a Roman
philosopher, dramatist, and statesman. His "Letters to Lucilius" are
a collection of 124 moral letters.

Seneca emphasized the practical application of philosophy in everyday life.
Central is the distinction between what we can control
and what we cannot control.

One of his most powerful techniques is **praemeditatio malorum**
— the deliberate visualization of the worst case as an exercise against fear. This
technique was empirically confirmed in 2024 by Dr. Maria Schneider in a meta-study:
daily exercises reduce cortisol levels by 18%.

His influence extends to modern psychology (Cognitive
Behavioral Therapy draws on central Stoic concepts).

## Claims

- `id:claim-seneca-angst-these` `conf:0.3` `status:uncertain`
  Seneca's thesis: "Most anxieties arise from anticipated suffering,
  not from real suffering"
  *Beleg:* [[sources/briefe-an-lucilius]] (13th Letter)
  *Einschränkung:* Philosophical assertion, 2,000 years old, no empirical evidence

- `id:claim-cortisol-senkung` `conf:0.85` `status:active`
  Praemeditatio malorum reduces cortisol by an average of 18%
  *Beleg:* [[sources/schneider-metastudie-2024]] (Paragraph 3, n=1,200)
  *Einschränkung:* No effect in participants under 25 years

## Verknüpfungen

- `praktizierte` → [[concepts/stoizismus]]
- `definierte` → [[concepts/praemeditatio-malorum]]
- `wurde_empirisch_bestätigt_durch` → [[entities/maria-schneider]]
  *Notiz:* Schneider's meta-study (2024) confirms the cortisol reduction

<!-- exolith:human:start -->
## Persönliche Notizen
I find Seneca's letters more accessible than Marcus Aurelius's
Meditations — less cryptic, more directly applicable.
<!-- exolith:human:end -->
```

**Breakdown — what exactly happened:**

1. **Prose merge:** The "Teachings" section was expanded with two new paragraphs — praemeditatio definition, empirical evidence, limitation.
2. **Structured claim:** Seneca's anxiety thesis with `id:claim-seneca-angst-these`, `confidence: 0.3` and `status: uncertain` — explicitly marked as a philosophical assertion.
3. **New relationships:** Reciprocal update on both affected pages.
4. **Human block untouched:** The personal note remained exactly preserved.

**Other affected pages (analogous):**
- `entity.maria-schneider` — newly created with research profile
- `concept.praemeditatio-malorum` — expanded with empirical evidence
- `concept.cortisol-senkung-durch-meditation` — newly created
- `entity.uni-tuebingen` — newly created or expanded

In total, a single source touched **8-10 pages** — exactly Karpathy's "a single source might touch 10-15 wiki pages."

## See Also

* [../architecture.md](../architecture.md) — architectural overview
* [../pages/source-spec.md](../pages/source-spec.md) — source page specification (created in step 3)
* [../cross-cutting/claim-spec.md](../cross-cutting/claim-spec.md) — claim specification (extracted in step 4)
* [compile.md](compile.md) — compile step (triggered in step 6)
