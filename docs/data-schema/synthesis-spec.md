# Synthesis — Querschnittsanalysen

Der Page-Typ `synthesis` fasst mehrere Entities oder Concepts zu einer **höheren Analyse** zusammen. Anders als ein Concept, das ein einzelnes Pattern beschreibt, stellt eine Synthesis eine **Querverbindung** zwischen mehreren Page-Typen her.

**Wann entsteht eine Synthesis?**
- Aus einer Query, die mehrere Seiten verknüpft (≥3 Quellen oder neuer Zusammenhang entdeckt)
- Wenn der Compile erkennt, dass mehrere Seiten dasselbe Thema aus verschiedenen Perspektiven beleuchten
- Manuell durch den Menschen angestoßen ("Vergleiche mal X mit Y")

**Beispiele für Syntheses:**
- `synthesis.stoizismus-und-empirie` — Wie stoische Konzepte durch moderne Forschung bestätigt oder widerlegt werden
- `synthesis.c-plus-plus-embedded-vs-python` — Design-Philosophie-Unterschiede zwischen beiden Sprachwelten
- `synthesis.depression-bewältigungsstrategien` — Abgleich verschiedener Methoden (Stoa, KVT, Meditation) mit Wirksamkeitsbelegen

**Struktur einer Synthesis (Beispiel):**

```markdown
---
id: synthesis.stoizismus-und-empirie
page: synthesis
title: Stoizismus und Empirie — Was die Forschung sagt
confidence: 0.75
status: active
tags:
  - stoizismus
  - psychologie
  - empirisch
  - metastudie
created: 2026-05-02
updated: 2026-05-02
---

# Stoizismus und Empirie

Die moderne Psychologie hat mehrere stoische Praktiken empirisch
untersucht. Die Ergebnisse sind gemischt: Einige Konzepte (praemeditatio
malorum, Dichotomie der Kontrolle) zeigen messbare Effekte, andere
(stoische Affektlehre) sind bisher nicht operationalisiert worden.

## Claims

- `id:claim-praemeditatio-best-belegt` `conf:0.85` `status:active`
  Praemeditatio malorum ist die am besten empirisch belegte stoische Technik
  *Beleg:* [[sources/schneider-metastudie-2024]]
  *Einschränkung:* Andere Techniken (Dichotomie der Kontrolle) nicht in kontrollierten
  Studien untersucht

- `id:claim-stoa-kvt-vergleichbar` `conf:0.5` `status:uncertain`
  Stoische Praktiken sind der KVT in der Wirkstärke vergleichbar
  *Beleg:* [[sources/kvt-leitlinien-2023]] (indirekter Vergleich)
  *Einschränkung:* Kein direkter Head-to-Head-Vergleich; Confidence niedrig

## Verknüpfungen

- `vergleicht` → [[concepts/praemeditatio-malorum]]
- `vergleicht` → [[concepts/stoizismus]]
- `stellt_gegenüber` → [[concepts/kognitive-verhaltenstherapie]]

## Offene Fragen

- Gibt es stoische Techniken, die empirisch *widerlegt* wurden?
- Wie verhalten sich stoische und buddhistische Meditation im direkten Vergleich?

<!-- llm-wiki:human:start -->
## Meine Einschätzung

Die empirische Bestätigung ist nett, aber für mich nicht der
entscheidende Punkt. Stoizismus funktioniert für mich subjektiv —
das reicht. Trotzdem spannend zu sehen, dass die Forschung das
teilweise stützt.
<!-- llm-wiki:human:end -->
```

**Besonderheiten:**

- Auch Syntheses sammeln Claims — sie aggregieren und vergleichen Claims aus mehreren Quellen, formulieren aber auch eigene, synthetisierende Behauptungen.
- Eine Synthesis entsteht **nicht automatisch** bei jedem Ingest — sie ist ein bewusster Schritt (Query-Filing oder manueller Anstoß).
- Bootstrap-Modus: Bei <50 Seiten im Vault werden keine Syntheses automatisch vorgeschlagen.
- Die Confidence einer Synthesis ist der gewichtete Durchschnitt aller referenzierten Claims.
