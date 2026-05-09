# Entity — identifiable things

The Page type `entity` describes an **identifiable thing**: person, organization, project, tool, place, or event. Entities are the "nouns" of the wiki — they are *what* is being talked about.

**When does an Entity come into existence?** During extraction (step 4 of ingest), when the LLM recognizes a new person, organization, etc. in the source text that does not yet exist in the wiki (two-phase lookup fails → CREATE).

**Structure of an Entity (example):**

```markdown
---
id: entity.seneca
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

<!-- exolith:human:start -->
## Persönliche Notizen

Ich finde Senecas Briefe zugänglicher als Marc Aurels
Selbstbetrachtungen — weniger kryptisch, direkter anwendbar.
<!-- exolith:human:end -->
```

**Special characteristics:**

- Entities collect claims that *concern* a person/organization — not only statements *by* them.
- `## Verknüpfungen` lists directed relationships to other Entities and Concepts (e.g. `definierte → [[concepts/praemeditatio-malorum]]`).
- An Entity can reference claims from different Sources — each claim carries its own reference.
- Everything outside of `<!-- exolith:human:start -->` / `<!-- exolith:human:end -->` is implicitly LLM-managed.

## See Also

* [vault-layout.md](vault-layout.md) — where entities live in the vault
* [format-spec.md](format-spec.md) — YAML frontmatter and format conventions
* [claim-spec.md](claim-spec.md) — claim structure used in entities
