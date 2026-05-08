# Concept — abstrakte Ideen

Der Page-Typ `concept` beschreibt eine **abstrakte Idee, Theorie, Pattern, Methode oder ein Framework**. Concepts sind die "Verben und Adjektive" des Wikis — sie beschreiben, *wie* Dinge zusammenhängen und *welche* Eigenschaften sie haben.

**Wann entsteht ein Concept?** Bei der Extraktion, wenn das LLM ein neues Pattern, eine Methode oder Theorie erkennt. Concepts entstehen auch aus Queries ("Was verbindet X und Y?") und werden dann als Synthesis-Kandidaten vorgeschlagen.

**Struktur eines Concept (Beispiel):**

```markdown
---
id: concept.praemeditatio-malorum
page: concept
title: Praemeditatio Malorum
confidence: 0.7
status: active
tags:
  - stoizismus
  - psychologie
  - angstbewältigung
created: 2026-05-02
updated: 2026-05-02
---

# Praemeditatio Malorum

Die praemeditatio malorum (lat. „Vorausdenken des Schlechten") ist eine
stoische Übung: die bewusste, detaillierte Vorstellung des Schlimmsten,
was eintreten könnte. Sie dient der Angstbewältigung — nicht durch
Verdrängung, sondern durch Konfrontation. Seneca beschrieb sie im
13. Brief an Lucilius. 2024 wurde sie von Dr. Maria Schneider empirisch
bestätigt (Cortisol-Senkung um 18%, n=1.200, Nature Human Behaviour).

## Claims

- `id:claim-cortisol-signifikant` `conf:0.85` `status:active`
  Tägliche praemeditatio senkt Cortisol signifikant (p < 0.001)
  *Beleg:* [[sources/schneider-metastudie-2024]] (Absatz 3, n=1.200)
  *Einschränkung:* Keine Wirkung bei Teilnehmern unter 25 Jahren

- `id:claim-altersgrenze` `conf:0.8` `status:active`
  Die Wirkung tritt nur bei Teilnehmern über 25 Jahren ein
  *Beleg:* [[sources/schneider-metastudie-2024]] (Absatz 4)
  *Einschränkung:* Altersgrenze nicht granular untersucht (nur </≥25)

## Verknüpfungen

- `definiert_von` → [[entities/seneca]]
- `empirisch_bestätigt_von` → [[entities/maria-schneider]]
- `gehört_zu` → [[concepts/stoizismus]]
- `verwandt_mit` → [[concepts/dichotomie-der-kontrolle]]

## Offene Fragen

- Hält die Cortisol-Senkung nach Absetzen der Übungen an?
  *Kontext:* Studie misst nur akute Effekte
- Warum wirkt praemeditatio nicht bei unter 25-Jährigen?
  *Kontext:* Mögliche Erklärung: präfrontaler Cortex noch nicht voll entwickelt

<!-- llm-wiki:human:start -->
## Persönliche Notizen

Praktiziere das seit Januar — subjektiv spürbarer Effekt vor
Präsentationen. Die empirische Bestätigung macht es für mich
glaubwürdiger.
<!-- llm-wiki:human:end -->
```

**Besonderheiten:**

- Concepts sammeln ebenso Claims wie Entities — jedes Pattern, jede Methode kann durch empirische oder theoretische Claims gestützt sein.
- Concepts sind das Herzstück der Wissensvernetzung — sie verknüpfen Entities und andere Concepts.
- Ein Concept ohne empirischen Beleg ist valide, bekommt aber niedrigere Confidence.
- Concepts wachsen mit jeder neuen Quelle — sie sind Evergreen Notes im klassischen Sinn.
- Alles außerhalb der Human-Block-Marker ist implizit LLM-verwaltet.
