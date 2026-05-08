# Entity — identifizierbare Dinge

Der Page-Typ `entity` beschreibt eine **identifizierbare Sache**: Person, Organisation, Projekt, Tool, Ort oder Ereignis. Entities sind die "Substantive" des Wikis — sie sind das, *wortüber* gesprochen wird.

**Wann entsteht eine Entity?** Bei der Extraktion (Schritt 4 des Ingest), wenn das LLM eine neue Person, Organisation etc. im Quelltext erkennt, die noch nicht im Wiki existiert (Zwei-Phasen-Lookup schlägt fehl → CREATE).

**Struktur einer Entity (Beispiel):**

```markdown
---
id: entity.seneca
page: entity
title: Seneca
confidence: 0.9
status: active
tags:
  - philosophie
  - stoizismus
  - antike
created: 2026-04-15
updated: 2026-05-02
---

# Seneca

Lucius Annaeus Seneca (ca. 4 v. Chr. — 65 n. Chr.) war ein römischer
Philosoph, Dramatiker und Staatsmann. Seine "Briefe an Lucilius" sind
eine Sammlung von 124 moralischen Briefen. Seneca betonte die praktische
Anwendung der Philosophie im Alltag.

Eine seiner wirkmächtigsten Techniken ist die **praemeditatio malorum**
— die bewusste Vorstellung des Schlimmsten als Übung gegen Angst. Diese
Technik wurde 2024 von Dr. Maria Schneider in einer Metastudie empirisch
bestätigt: tägliche Übungen senken den Cortisol-Spiegel um 18%.

## Claims

- `id:claim-seneca-angst-these` `conf:0.3` `status:uncertain`
  Senecas These: „Die meisten Ängste entstehen aus antizipiertem Leiden,
  nicht aus realem"
  *Beleg:* [[sources/briefe-an-lucilius]] (13. Brief)
  *Einschränkung:* Philosophische Behauptung, 2.000 Jahre alt, kein empirischer Beleg

- `id:claim-cortisol-senkung` `conf:0.85` `status:active`
  Praemeditatio malorum senkt Cortisol um durchschnittlich 18%
  *Beleg:* [[sources/schneider-metastudie-2024]] (Absatz 3, n=1.200)
  *Einschränkung:* Keine Wirkung bei Teilnehmern unter 25 Jahren

## Verknüpfungen

- `definierte` → [[concepts/praemeditatio-malorum]]
- `praktizierte` → [[concepts/stoizismus]]
- `wurde_empirisch_bestätigt_durch` → [[entities/maria-schneider]]
  *Notiz:* Schneiders Metastudie (2024) belegt Senecas These

## Offene Fragen

- Hält die Cortisol-Senkung nach Absetzen der Übungen an?
  *Kontext:* Studie misst nur akute Effekte

<!-- llm-wiki:human:start -->
## Persönliche Notizen

Ich finde Senecas Briefe zugänglicher als Marc Aurels
Selbstbetrachtungen — weniger kryptisch, direkter anwendbar.
<!-- llm-wiki:human:end -->
```

**Besonderheiten:**

- Entities sammeln Claims, die eine Person/Organisation *betreffen* — nicht nur Aussagen *von* ihnen.
- `## Verknüpfungen` listet gerichtete Beziehungen zu anderen Entities und Concepts (z.B. `definierte → [[concepts/praemeditatio-malorum]]`).
- Eine Entity kann Claims aus verschiedenen Sources referenzieren — jeder Claim trägt seinen eigenen Beleg.
- Alles außerhalb von `<!-- llm-wiki:human:start -->` / `<!-- llm-wiki:human:end -->` ist implizit LLM-verwaltet.
