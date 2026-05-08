# Source — die Wissensgrundlage

Der Page-Typ `source` (liegt in `sources/`) ist die **Wissensgrundlage** des Wikis. Jede Source entsteht aus einer Raw Source (`raw-sources/`) im Ingest-Schritt 3 — verarbeitet und angereichert durch das LLM, geprüft und gegebenenfalls korrigiert durch menschliches Feedback aus der Key-Takeaways-Diskussion (Schritt 2). Die Source ist der Dreh- und Angelpunkt: Alle weiteren Verarbeitungen (Extraktion von Entities, Concepts, Claims in Schritt 4; Updates in Schritt 5) basieren ausschließlich auf der Source, nicht mehr auf der Raw Source.

Die Source verlinkt auf die Raw Source, damit der Mensch jederzeit das Original einsehen kann. Für das LLM ist die Source jedoch der alleinige Arbeitsgegenstand — die Raw Source wird nach dem Ingest nicht mehr gelesen.

**Wann entsteht eine Source?** Bei jedem Ingest — Schritt 3 der Pipeline. Eine Source wird genau einmal geschrieben und danach nicht mehr vom LLM verändert. Die Liste der verlinkten Wiki-Seiten (automatisch vom Compile gepflegt) ist die einzige Ausnahme.

**Struktur einer Source:**

```markdown
---
id: source.briefe-an-lucilius
page: source
title: Briefe an Lucilius (13. Brief)
status: active
tags:
  - philosophie
  - stoizismus
  - seneca
created: 2026-05-01
updated: 2026-05-01
---

# Briefe an Lucilius (13. Brief)

*Typ:* transcript
*Autor(en):* Lucius Annaeus Seneca
*Datum:* ca. 62–64 n. Chr.
*URL/Referenz:* —
*Originaldatei:* [[raw-sources/briefe-an-lucilius-13.md]]

## Zusammenfassung
{1-2 Absätze, was die Quelle aussagt — neutral, kein Werturteil}

## Main Points
- Main Point 1
- Main Point 2

## Key Takeaways
- Takeaway 1
- Takeaway 2

## Verlinkte Wiki-Seiten
- [[entities/seneca]] (2 Claims)
- [[concepts/praemeditatio-malorum]] (1 Claim)
```

**Template für Source-Seiten:**

```markdown
---
id: source.{slug}
page: source
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
{1-2 Absätze, was die Quelle aussagt — neutral, kein Werturteil}

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

**Main Points vs. Key Takeaways:**

- **Main Points** sind die zentralen Aussagen *des Autors* — neutral, deskriptiv, objektiv. Sie beantworten: „Was sagt die Quelle?" Beispiel: *„Seneca beschreibt die praemeditatio malorum als Übung gegen Angst."*

- **Key Takeaways** sind die Aussagen, die *für das Wiki relevant* sind. Sie werden aus der Raw Source extrahiert — das LLM identifiziert, was daran für den Menschen von Interesse sein könnte. Der Mensch gibt in der Diskussion (Schritt 2) Feedback und bestimmt, welche Aspekte betont, umgewichtet oder verworfen werden.

**Besonderheiten:**

- Die `## Verlinkte Wiki-Seiten`-Liste wird **ausschließlich vom Compile** gepflegt, nicht vom LLM beim Ingest.
- Die Source ist der *einzige* Page-Typ, der direkt auf eine Raw Source (`[[raw-sources/...]]`) verlinkt — und das ausschließlich für den Menschen.
- Alle anderen Page-Typen (entity, concept, synthesis) verlinken ausschließlich auf Sources.
- Die Source ist die verarbeitete Grundlage: Was hier nicht steht, existiert für das LLM nicht. Sie ist der Flaschenhals, durch den alles Rohwissen fließt und geprüft wird.
- Die Source selbst hat keinen Human Block — sie ist komplett LLM-verwaltet.
- Weder Main Points noch Key Takeaways ändern sich nach der Source-Erstellung. Beide sind aus der Raw Source extrahiert und ausschließlich daraus entnommen. Sie sind Teil der Source-Page, die — mit Ausnahme der `## Verlinkte Wiki-Seiten`-Liste — nach Schritt 3 stabil bleibt und nie vom LLM überschrieben wird.

Die Source-Page wird nach dem ersten Ingest nie wieder vom LLM verändert — mit einer Ausnahme: Die Liste der verlinkten Wiki-Seiten wird beim Compile automatisch aktualisiert. Sie enthält alle Entities, Concepts und Syntheses, die mindestens einen Claim aus dieser Source referenzieren. Die Zahl in Klammern zeigt, wie stark die Source in der jeweiligen Seite verankert ist.
