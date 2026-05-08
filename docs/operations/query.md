# Query

Asking questions against the wiki. Unlike RAG, the search is not against raw chunks, but against compiled knowledge. The query workflow runs in four phases:

**Phase 1 — Index Scan (L1):** The LLM reads `index.md` and identifies relevant pages based on one-liner summaries and tags. No full-text scan — the index provides an overview of the entire vault in a single read.

**Phase 2 — Progressive Deep-Dive:** Relevant pages are escalated as needed: first L1 (one-liner), then L2 (TL;DR = first paragraph), then L3 (full page) only for high relevance. This saves tokens: for broad questions, many pages are scanned at L1/L2, only the top hits are loaded at L3.

**Phase 3 — Synthesis:** The LLM synthesizes an answer from the loaded pages. Every assertion is backed by citable sources — not raw chunks, but source pages with context. The confidence of the referenced claims flows into the answer: low-confidence statements are explicitly marked as uncertain.

**Phase 4 — Query Filing:** Substantial answers are proposed as candidates for new wiki pages. Criteria: ≥3 sources linked? New connection discovered? Contradiction resolved? The human confirms or discards — the LLM does the rest.

## Example: A Query from Start to Finish

**Input (human):** *"What does current research say about the effectiveness of Stoic practices — and how do they compare to CBT?"*

### Step 1 — Index Scan

The LLM reads `index.md` and scans summaries and tags for `#stoizismus`, `#psychologie`, `#empirisch`, `#kvt`:

```
Index scan (L1, filtered by tags #stoizismus OR #psychologie):
  ✓ concept.praemeditatio-malorum — "Stoic exercise for anxiety management" (2 claims, conf:0.7)
  ✓ concept.stoizismus — "Philosophical school of Stoicism" (1 claim, conf:0.8)
  ✓ synthesis.stoizismus-und-empirie — "What the research says" (2 claims, conf:0.75)
  ✓ concept.kognitive-verhaltenstherapie — "Therapy form with Stoic roots" (3 claims, conf:0.9)
  → 4 candidates, 2 of them highly relevant (praemeditatio, stoizismus-und-empirie)
```

### Step 2 — Progressive Deep-Dive

```
L2 scan (TL;DR = first paragraph):
  concept.praemeditatio-malorum:
    "Praemeditatio malorum is a Stoic exercise for anxiety management.
     2024 empirically confirmed: cortisol reduction of 18% (n=1,200)."
    → HIGHLY relevant → escalate to L3

  synthesis.stoizismus-und-empirie:
    "Modern psychology has empirically examined several Stoic practices.
     Results mixed: praemeditatio confirmed, affect theory not."
    → HIGHLY relevant → escalate to L3

  concept.kognitive-verhaltenstherapie:
    "CBT is an evidence-based therapy form. Effect size d=0.8 for
     anxiety disorders. Draws on central Stoic concepts."
    → relevant → escalate to L3

  concept.stoizismus:
    "Stoicism is a philosophical school of antiquity..."
    → basic knowledge, L2 is sufficient
```

### Step 3 — Synthesis (LLM Answer)

```markdown
## Stoic Practices and CBT — State of Research

### What is empirically confirmed

**Praemeditatio malorum** is the best-confirmed Stoic technique:
- Cortisol reduction of 18% in a meta-study with n=1,200 (Schneider 2024,
  Nature Human Behaviour) — [[sources/schneider-metastudie-2024]]
  `claim-cortisol-signifikant` (conf: 0.85)
- Limitation: No effect in participants under 25 years

### Comparison with CBT

There is **no direct head-to-head comparison** between Stoic
practices and CBT. The available data only allows indirect
comparisons:
- CBT for anxiety disorders: d=0.8 ([[sources/kvt-leitlinien-2023]])
- Praemeditatio: Cortisol reduction 18%, but no clinical
  endpoint studies ([[sources/schneider-metastudie-2024]])
- `claim-stoa-kvt-vergleichbar` (conf: 0.5, uncertain) — this assertion
  is speculative, direct comparative studies are lacking

### What is NOT confirmed

- Stoic affect theory: no operationalizable studies
- Dichotomy of control: no controlled studies

### Conclusion

The data is thin. Only one Stoic technique (praemeditatio) is
robustly confirmed. The comparison to CBT is flawed — CBT has decades
of clinical research, Stoicism has one meta-study.

⚠️ This answer is based on 3 wiki pages and 2 Sources.
   Confidence of the strongest statement: 0.85.
   Confidence of the weakest statement: 0.5 (speculative).
```

### Step 4 — Query Filing

```
> This query linked 3 sources and established a new connection
> (Stoicism vs. CBT evidence base). Should I create a synthesis page
> `synthesis.stoa-vs-kvt-evidenz` from it?
```

The human can confirm (→ new page is created), discard, or modify.

## Progressive Summarization — The Four Compression Levels

| Level | Name         | Source                        | Usage                             |
| ----- | ------------ | ----------------------------- | --------------------------------- |
| L1    | One-Liner    | First sentence after `# Title` | Index scan, initial scoping       |
| L2    | TL;DR        | First paragraph of the page    | Quick content grasp               |
| L3    | Full Page    | Complete page                  | Deep analysis, synthesis          |
| L4    | Source Links | Claims with `*Beleg:*`         | Provenance check, further reading |
