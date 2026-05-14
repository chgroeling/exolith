# Entity — identifiable things

An **entity** is a distinct, identifiable thing that can be described, referenced, and connected to other things within the system. Entities represent the primary subjects of knowledge — the "nouns" of the wiki.

An entity may be concrete or abstract, singular or collective, and typically persists independently of any single document or claim. Examples include people, organizations, projects, products, tools, places, works, datasets, events, or systems.

**Entities are NOT patterns, methods, or theories** — those belong under [Concepts](concept-spec.md). If something describes *how* things relate rather than being a thing itself, it is a Concept.

Each entity can:

- hold structured or unstructured claims,
- link to related entities,
- aggregate references from multiple sources,
- evolve over time as new information is added,
- serve as a stable identity target across the knowledge graph.

Entities provide the canonical layer of meaning in the wiki: pages, claims, discussions, and evidence are ultimately about entities.

> Documents describe things.
> Entities are the things being described.

**When does an Entity come into existence?** During ingest Step 2 (Update), when the LLM recognizes a distinct thing extracted from the source that does not yet exist in the wiki (two-phase lookup fails → CREATE). The LLM then generates the entity page with claims and open questions derived from the source context.

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

- `id:claim.seneca-angst-these` `conf:0.3` `status:uncertain`
  Senecas These: „Die meisten Ängste entstehen aus antizipiertem Leiden,
  nicht aus realem"
  *Beleg:* [[sources/briefe-an-lucilius]] (13. Brief)
  *Einschränkung:* Philosophische Behauptung, 2.000 Jahre alt, kein empirischer Beleg

- `id:claim.cortisol-senkung` `conf:0.85` `status:active`
  Praemeditatio malorum senkt Cortisol um durchschnittlich 18%
  *Beleg:* [[sources/schneider-metastudie-2024]] (Absatz 3, n=1.200)
  *Einschränkung:* Keine Wirkung bei Teilnehmern unter 25 Jahren

- `id:claim.definierte-praemeditatio` `conf:0.9` `status:active`
  Seneca definierte die praemeditatio malorum als stoische Übung
  gegen Angst im 13. Brief an Lucilius
  *Evidence:* [[concepts/praemeditatio-malorum]]

- `id:claim.bestaetigt-durch-schneider` `conf:0.85` `status:active`
  Senecas Übung wurde 2024 von Dr. Maria Schneider empirisch bestätigt
  *Evidence:* [[entities/maria-schneider]]

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
- Relationship claims live in `## Claims` alongside factual claims. A claim asserting a connection to another entity or concept carries its evidence link pointing to the target page (e.g. `*Evidence:* [[entities/maria-schneider]]` for an entity connection, or `*Evidence:* [[concepts/praemeditatio-malorum]]` for a concept connection). Every claim has exactly one evidence link.
- An Entity can reference claims from different Sources — each claim carries its own reference.
- Everything outside of `<!-- exolith:human:start -->` / `<!-- exolith:human:end -->` is implicitly LLM-managed.

## See Also

* [vault-layout.md](vault-layout.md) — where entities live in the vault
* [format-spec.md](format-spec.md) — YAML frontmatter and format conventions
* [claim-spec.md](claim-spec.md) — claim structure used in entities
