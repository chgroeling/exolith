# Ingest

The core workflow. A **source page** from `sources/` is not just indexed, but **actively integrated into the wiki**. This is the decisive difference from RAG: not storing chunks and searching later, but weaving the knowledge into the existing structure immediately.

Source pages are created by the [Enqueue](enqueue.md) operation (or placed manually in `inbox/`).

## The Steps of Ingest

1. **Extracts** entities and concepts **exclusively from the source**
2. **Creates skeleton pages** for all new entities and concepts — no claims, no cross-connections, only the page structure (title + tags + body)
3. **Rebuilds the index** if any pages were created (ensures new pages appear for the update phase)
4. **Updates all affected wiki pages** — every extracted entity and concept (including newly created ones) goes through the update step. During update, the LLM filters relevant pages from the index, reads their full content, and generates claims, cross-connections, and open questions.
5. **Writes an entry** in `log.md`
6. **Triggers the [compile](compile.md) operation** — a separate operation that regenerates index.md, backlinks, and dashboards

---

## Step 1 — Extraction

Step 1 is the heart of ingest — here the curated source becomes machine-readable knowledge.

**Important:** The LLM works **exclusively with the source page** from `sources/`. The raw text is never used — the LLM context contains only what is in the source.

### Name Constraints

- The `name` must be the shortest possible designation that uniquely identifies the entity or concept. The name is a label, not a definition — strip all unnecessary words.
- No abbreviations or acronyms are allowed. Always use the full, expanded term. "MOC" is forbidden — use "Map of Content" instead.
- No parenthetical annotations are allowed after the name. "Struktur Notiz (MOC)" is forbidden — use just "Struktur Notiz". The name must stand on its own without parenthetical suffixes of any kind.

**Concrete Example — Output (Extraction):**

```
## Entities
Dr. Maria Schneider | person | Researcher at University of Tübingen, author of the 2024 meta-study | "…in a meta-study (n=1,200)…"
Seneca | person | Roman philosopher, Stoic | "Seneca describes in the 13th letter…"

## Concepts
praemeditatio malorum | philosophy/psychology | Stoic exercise: deliberate visualization of the worst case | "the deliberate visualization of the worst case as an exercise against fear"
Cortisol reduction through meditation | neurobiology | measurable effect of mental exercises on stress hormones | "reduce cortisol levels by 18%"
```

---

## Step 2 — Create Skeleton Pages

Step 2 creates minimal page skeletons for every extracted entity and concept that has no existing match in the wiki. Skeletons contain only the core page structure — title, tags, and a body description derived from the source context. No claims, no cross-connections, no open questions are generated at this stage.

The create phase uses the same two-phase lookup (exact slug match + LLM semantic match) as the update phase to determine which items already have pages. Items with an existing match are skipped — they will be enriched during the update phase. Items without any match receive a skeleton page with `confidence: 0.50` (a neutral default, since no claims exist yet to compute an average from).

### Process — Create-Only

```
1. READ index.md
   ↓
2. For each extracted element:
   ┌─ PHASE 1: Exact Slug Match (string comparison, no LLM)
   │  entity.seneca ↔ slug "seneca" → HIT ✓ → skip (already exists)
   │
   └─ PHASE 2: Semantic Summary Match (LLM-based)
        Only for elements without a Phase 1 hit:
        "Cortisol reduction" → all concept summaries →
          "cortisol-senkung-durch-meditation" → HIT ✓ → skip (will update existing)
        "Dr. Maria Schneider" → all entity summaries → NO HIT → CREATE SKELETON
   ↓
3. For each NO-HIT element: generate skeleton page via LLM structured output
   → title + tags + body only
   → no claims, no open questions, no cross-connections
```

---

## Step 3 — Rebuild Index

If any skeleton pages were created in step 2, the compile operation is triggered to regenerate `index.md`. This is critical because the update phase (step 4) needs the freshly created pages to appear in the index for matching and relevance filtering.

If no pages were created, this step is skipped.

---

## Step 4 — Update All Pages

Step 4 is the actual wiki work — here every extracted entity and concept is enriched with claims, cross-connections, and open questions. All items go through this phase, including those whose skeleton was just created in step 2.

### Process — Relevance-Filtered Update

For each entity and concept, the update step:

1. **Resolves** the item to its page file via two-phase lookup (should find a match for every item now — newly created pages match via phase 1 exact slug)
2. **Filters** the index for relevant pages: passes the item (name, type, description, source context) and all entity/concept index summaries to the LLM, which returns only the slugs of semantically relevant pages
3. **Reads** the full content of all relevant pages
4. **Updates** the page via LLM `complete()` — the LLM receives the current page content, the item being updated, all relevant pages' full content, and the source page. It generates claims with cross-connections to relevant pages and open questions.

```
For each extracted entity/concept:
   ├─ Resolve page file (two-phase lookup)
   ├─ FILTER: LLM determines which pages are relevant to this item
   │    Current item + all entity/concept index summaries
   │    → returns slugs of semantically relevant pages
   ├─ READ: Full content of all relevant pages
   └─ UPDATE: LLM receives current page + item + all relevant pages + source
        → generates claims connecting to relevant pages
        → weaves new knowledge into prose
        → preserves human blocks
        → generates open questions
```

### The Decision Logic (Lookup)

```
For each extracted entity:
  ├─ Phase 1: Exact slug match?
  │   ├─ YES → LOAD PAGE → UPDATE
  │   └─ NO → Phase 2: Semantic summary match (LLM)?
  │       ├─ YES → LOAD PAGE → UPDATE
  │       └─ NO → should not happen — page was already created in step 2

For each extracted concept:
  ├─ Phase 1: Exact slug match?
  │   ├─ YES → LOAD PAGE → UPDATE
  │   └─ NO → Phase 2: Semantic summary match (LLM)?
  │       ├─ YES → LOAD PAGE → UPDATE
  │       └─ NO → should not happen — page was already created in step 2
```

Claims and open questions are not extracted from the source — they are generated by the LLM during the update phase. The LLM receives the current item, all relevant pages' full content, and the source page. This ensures claims can establish connections between the item being updated and any other relevant entity or concept.

### Before/After — Example on the `entity.seneca` Page

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

- `id:claim.definierte-praemeditatio` `conf:0.9` `status:active`
  Seneca defined praemeditatio malorum as a Stoic exercise
  *Evidence:* [[concepts/praemeditatio-malorum]]

- `id:claim.bestaetigt-durch-schneider` `conf:0.85` `status:active`
  Seneca's technique was empirically confirmed by Dr. Maria Schneider
  *Evidence:* [[entities/maria-schneider]]

<!-- exolith:human:start -->
## Persönliche Notizen
I find Seneca's letters more accessible than Marcus Aurelius's
Meditations — less cryptic, more directly applicable.
<!-- exolith:human:end -->
```

**Breakdown — what exactly happened:**

1. **Prose merge:** The "Teachings" section was expanded with two new paragraphs — praemeditatio definition, empirical evidence, limitation.
2. **Structured claim:** Seneca's anxiety thesis with `id:claim.seneca-angst-these`, `confidence: 0.3` and `status: uncertain` — explicitly marked as a philosophical assertion.
3. **Claims as connections:** Claims establish relationships between entities, concepts, and sources. A claim about an entity may link it to a concept or another entity via its evidence field (e.g. `*Evidence:* [[concepts/praemeditatio-malorum]]`), forming the knowledge graph.
4. **Human block untouched:** The personal note remained exactly preserved.

**Other affected pages (analogous):**
- `entity.maria-schneider` — created as skeleton, then updated with research profile and claims
- `concept.praemeditatio-malorum` — created as skeleton, then updated with empirical evidence and entity connections
- `concept.cortisol-senkung-durch-meditation` — created as skeleton, then updated
- `entity.uni-tuebingen` — created as skeleton, then updated

In total, a single source touched **8-10 pages** — exactly Karpathy's "a single source might touch 10-15 wiki pages."

## Step 5 — Log

Writes a summary entry to `log.md` documenting what was processed and which pages were created or modified.

## Step 6 — Compile

Triggers the [compile](compile.md) operation — a separate operation that regenerates index.md, backlinks, dashboards, and machine-readable digests from the updated vault.

## See Also

* [../architecture.md](../architecture.md) — architectural overview
* [enqueue.md](enqueue.md) — the enqueue operation (creates source pages in `inbox/`)
* [../pages/source-spec.md](../pages/source-spec.md) — source page specification
* [../cross-cutting/claim-spec.md](../cross-cutting/claim-spec.md) — claim specification
* [compile.md](compile.md) — compile operation (triggered in step 6)
