# Ingest

The core workflow. A source is not just indexed, but **actively integrated into the wiki**. This is the decisive difference from RAG: not storing chunks and searching later, but weaving the knowledge into the existing structure immediately.

## The Seven Steps of Ingest

1. Read and validate the raw source file (no LLM)
2. Discuss key takeaways with the human (interactive, calibration-focused)
3. Writes a source page in `sources/` — the processed knowledge base
4. **Extracts** entities, concepts, claims, relationships **exclusively from the source**
5. **Updates all affected wiki pages** — a single source can touch 10-15 pages
6. Triggers the **compile** step: index.md, backlinks, dashboards
7. Writes an entry in `log.md`

---

## Step 1 — Read Raw Source Completely

The first step reads and validates the raw source file without involving the LLM. The file is checked for existence, type (`.md`, `.txt`, `.textile`), size (under the configured limit), and binary content (null bytes rejected). Once validated, the full content is read into memory.

New sources land in `inbox/`. After processing (step 3), the raw source is moved to `raw-sources/` — that is the archive. `raw-sources/` is not processed further by the LLM; it serves exclusively as a reference for the human. The sources in `sources/` link to the corresponding raw source in `raw-sources/` via wikilink (`*Originaldatei:*`).

The raw content is held in memory for the subsequent discussion and extraction steps — the LLM will receive the entire source at once, not chunk-by-chunk. This is the fundamental difference from RAG: the LLM understands the full context, recognizes implicit connections, and can establish cross-references within the source that chunk-based systems miss.

---

## Step 2 — Discuss Key Takeaways & Main Points

Before the LLM creates the source and extracts knowledge, the human engages in an interactive discussion. The LLM reads the raw source content and summarizes it conversationally, then asks the human for opinionated judgment to calibrate the upcoming extraction step.

The human is asked to weigh in on:
- Which claims are central and which are peripheral?
- How credible is the source — should claims carry high or low confidence?
- Which entities, concepts, or relationships deserve priority extraction?
- What should be ignored or deprioritized?
- Are there nuances the source hints at but doesn't fully unpack?

The discussion is a back-and-forth: the LLM responds, the human provides feedback, and the loop continues until the human signals completion (empty input).

### Discussion Summary and Archiving

After the discussion ends, the LLM extracts the human's key feedback and calibration decisions into a concise summary. The raw source file is then copied to `raw-sources/` and the summary is appended as a `## Discussion Summary` chapter.

This enriched file in `raw-sources/` becomes the canonical source for all subsequent steps — it contains both the original content and the human's calibration signals. The full discussion transcript is discarded; only the extracted summary is preserved. This ensures the wiki can be rebuilt without losing the critical decisions that emerged from the human interaction.

---

## Step 3 — Write Source Page

The source page in `sources/` is the **processed knowledge base** of the wiki. It is created from the raw source (read in step 1), enriched by the human feedback from the discussion (step 2).

The source links to the raw source in `raw-sources/` — but exclusively for the human. For the LLM, the source is the sole working object from this point on. The raw source is not read again after step 3. All further processing (extraction in step 4, updates in step 5) is based exclusively on the source.

---

## Step 4 — Extraction

Step 4 is the heart of ingest — here the curated source becomes machine-readable knowledge.

**Important context switch:** From this step on, the LLM works **exclusively with the source** from step 3. The raw text from step 1 is no longer used — the LLM context is cleaned. Only what is in the source exists for extraction.

**Concrete Example — Output (Extraction):**

```
## Entities
Dr. Maria Schneider | person | Researcher at University of Tübingen, author of the 2024 meta-study | "…in a meta-study (n=1,200)…"
Seneca | person | Roman philosopher, Stoic | "Seneca describes in the 13th letter…"

## Concepts
praemeditatio malorum | philosophy/psychology | Stoic exercise: deliberate visualization of the worst case | "the deliberate visualization of the worst case as an exercise against fear"
Cortisol reduction through meditation | neurobiology | measurable effect of mental exercises on stress hormones | "reduce cortisol levels by 18%"

## Claims
claim.cortisol-senkung | praemeditatio malorum reduces cortisol by 18% | 0.85 | Paragraph 2 | Meta-study, n=1,200, Nature Human Behaviour; limitation: no effect <25 yrs
claim.seneca-angst-these | Anxieties arise from anticipation, not from real events | 0.3 | Paragraph 1 | Seneca's philosophical assertion, no empirical evidence

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

- `id:claim.seneca-angst-these` `conf:0.3` `status:uncertain`
  Seneca's thesis: "Most anxieties arise from anticipated suffering,
  not from real suffering"
  *Beleg:* [[sources/briefe-an-lucilius]] (13th Letter)
  *Einschränkung:* Philosophical assertion, 2,000 years old, no empirical evidence

- `id:claim.cortisol-senkung` `conf:0.85` `status:active`
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
2. **Structured claim:** Seneca's anxiety thesis with `id:claim.seneca-angst-these`, `confidence: 0.3` and `status: uncertain` — explicitly marked as a philosophical assertion.
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
