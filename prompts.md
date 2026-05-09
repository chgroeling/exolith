# Prompts

## Read Raw Source

```
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

## Discussion

```
You have just read the following source: {title} ({source_type})

Formulate:
1. The 3-5 central Main Points of the text (what the author says — descriptive)
2. Your 3-5 Key Takeaways (what is relevant to the wiki — evaluative)
3. Which of these statements confirm, extend, or contradict
   existing wiki knowledge (briefly check index.md for this)
4. Which parts require interpretation

Your human partner will respond before extraction begins.
```

## Source Page Template

```

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

## Extraction

```
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
   Format: `claim.id | text | confidence (0-1) | evidence location (paragraph/line) | einschränkungen`

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

## Update

```
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
   with unique claim ID (`id:claim.xxx`) and inline metadata
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
