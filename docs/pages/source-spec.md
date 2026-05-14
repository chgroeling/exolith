# Source — the Knowledge Foundation

The page type `source` (stored in `sources/`) is the **knowledge foundation** of the wiki. Each source is created during enqueue — processed and enriched by the LLM, verified and corrected as needed by human feedback from the discussion. The source is the linchpin: All further processing (extraction of Entities, Concepts, Claims; updates) is based exclusively on the source.

The source links to the Raw Source so that the human can consult the original at any time. For the LLM, however, the source is the sole working object — the Raw Source is not read again after the ingest.

**When is a source created?** During enqueue. A source is written once and never modified by the LLM thereafter. The list of linked wiki pages (automatically maintained by the compile) is the only exception.

**Structure of a Source:**

```markdown
---
id: source.briefe-an-lucilius
title: Letters to Lucilius (13th Letter)
status: active
tags:
  - philosophie
  - stoizismus
  - seneca
created: 2026-05-01
updated: 2026-05-01
---

# Letters to Lucilius (13th Letter)

*Type:* transcript
*Author(s):* Lucius Annaeus Seneca
*Date:* ca. 62–64 CE
*URL/Reference:* —

## Summary
{1-2 paragraphs summarizing what the source says — neutral, no value judgment}

## Main Points
- Main Point 1
- Main Point 2
```

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

*Type:* {article|paper|transcript|note|book}
*Author(s):* {authors}
*Date:* {date}
*URL/Reference:* {url_or_ref}

## Summary
{1-2 paragraphs summarizing what the source says — neutral, no value judgment}

## Main Points
- Main Point 1
- Main Point 2
- ...
```

**Main Points** are the central claims *of the author* — neutral, descriptive, objective. They answer the question: "What does the source state as key claims?" They are calibrated by the discussion feedback: the human's confidence signals, priority hints, and nuance flags determine which claims are emphasized, de-emphasized, or contextually framed.

**Special Characteristics:**

- All other page types (entity, concept, synthesis) link exclusively to sources.
- The source is the processed foundation: What is not stated here does not exist for the LLM. It is the bottleneck through which all raw knowledge flows and is verified.
- The source itself has no Human Block — it is entirely LLM-managed.
- Main Points do not change after the source is created. They are calibrated by discussion feedback. They are part of the source page and remain stable — the source is never overwritten by the LLM after first ingest.

The source page is never modified by the LLM after the enqueue step.

## See Also

* [vault-layout.md](vault-layout.md) — where sources live in the vault
* [format-spec.md](format-spec.md) — YAML frontmatter and format conventions
* [claim-spec.md](claim-spec.md) — claim structure used in sources
