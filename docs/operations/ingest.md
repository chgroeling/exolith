# Ingest

Der Kern-Workflow. Eine Quelle wird nicht nur indiziert, sondern **aktiv ins Wiki integriert**. Das ist der entscheidende Unterschied zu RAG: Nicht Chunks ablegen und später suchen, sondern das Wissen sofort in die bestehende Struktur einweben.

## Die sieben Schritte des Ingest

1. LLM liest die Raw Source vollständig (nicht chunk-weise)
2. Diskutiert Key Takeaways mit dem Menschen (optional, aber empfohlen)
3. Schreibt eine Source-Page in `sources/` — die verarbeitete Wissensgrundlage
4. **Extrahiert** Entities, Concepts, Claims, Relationships **ausschließlich aus der Source**
5. **Updated alle betroffenen Wiki-Seiten** — eine einzige Quelle kann 10-15 Seiten berühren
6. Löst den **Compile**-Schritt aus: index.md, Backlinks, Dashboards
7. Schreibt einen Eintrag in `log.md`

---

## Schritt 1 — Raw Source vollständig lesen

Der erste Schritt ist der einfachste, aber entscheidend: Das LLM bekommt den gesamten Quelltext auf einmal, nicht chunk-weise. Das ist der fundamentale Unterschied zu RAG — das LLM versteht den vollen Kontext, erkennt implizite Zusammenhänge und kann Querbezüge innerhalb der Quelle herstellen, die chunk-basierte Systeme übersehen.

Neue Quellen landen in `inbox/`. Nach der Verarbeitung (Schritt 3) wird die Raw Source nach `raw-sources/` verschoben — das ist das Archiv. `raw-sources/` wird vom LLM nicht weiter verarbeitet; es dient ausschließlich als Referenz für den Menschen. Die Sources in `sources/` verweisen per Wikilink (`*Originaldatei:*`) auf die zugehörige Raw Source in `raw-sources/`.

**Prompt für Schritt 1:**

```markdown
Lies den folgenden Quelltext vollständig. Mache dir Notizen zu:
- Hauptaussagen und Argumentationskette
- Genannten Personen, Organisationen, Methoden, Theorien
- Auffälligen Behauptungen mit oder ohne Beleg
- Widersprüchen zu dem, was du bereits über das Thema weißt

Quelle: {title} ({source_type})

{source_content}

Nach dem Lesen fassen wir die Key Takeaways zusammen, bevor die
strukturierte Extraktion beginnt.
```

Das LLM liest hier nur und bildet ein mentales Modell. Es schreibt noch nichts. Der Context ist danach „warm" — alle folgenden Schritte (Diskussion, Source-Erstellung, Extraktion, Update) profitieren davon, dass die Quelle komplett im Kurzzeitgedächtnis des LLMs liegt.

---

## Schritt 2 — Key Takeaways & Main Points diskutieren (optional)

Bevor das LLM die Source erstellt und Wissen extrahiert, kann der Mensch eine kurze Diskussion anstoßen. Das LLM formuliert aus dem gelesenen Quelltext (Schritt 1) sowohl die **Main Points** (die zentralen Aussagen des Autors — neutral, deskriptiv) als auch die **Key Takeaways** (was *dich* daran interessiert — welche Aussagen relevant für dein Wiki sind, welche bestätigen oder widersprechen bestehendem Wissen, was ist neu). Der Mensch gibt Feedback zu beidem: „Dieser Main Point ist der Kern", „diesen Takeaway würde ich anders gewichten", „hier widerspricht die Quelle meiner Erfahrung".

Dieser Schritt ist optional, aber wertvoll bei:
- **Neuen, komplexen Quellen** (>5 Seiten), wo das LLM nicht den vollen Überblick hat
- **Widersprüchlichen Inhalten**, wo der Mensch die epistemische Autorität einschätzen muss („Das ist ein Blogpost, kein Paper — niedrig gewichten")
- **Persönlichen Notizen**, wo der Mensch ergänzenden Kontext hat, der nicht im Text steht

Das menschliche Feedback aus diesem Schritt fließt direkt in die Source-Erstellung (Schritt 3) ein — die Source ist damit nicht nur eine LLM-Zusammenfassung, sondern ein menschlich geprüftes und gegebenenfalls korrigiertes Dokument.

**Der Diskussions-Prompt (Template):**

```markdown
Du hast soeben folgende Quelle gelesen: {title} ({source_type})

Formuliere:
1. Die 3-5 zentralen Main Points des Texts (was der Autor sagt — deskriptiv)
2. Deine 3-5 Key Takeaways (was daran für das Wiki relevant ist — evaluativ)
3. Welche dieser Aussagen bestehendes Wiki-Wissen bestätigen, erweitern oder
   widersprechen (sieh dazu kurz in index.md nach)
4. Welche Teile interpretationsbedürftig sind

Dein menschlicher Partner wird darauf antworten, bevor die Extraktion beginnt.
```

---

## Schritt 3 — Source-Page schreiben

Die Source-Page in `sources/` ist die **verarbeitete Wissensgrundlage** des Wikis. Sie entsteht aus der Raw Source (gelesen in Schritt 1), angereichert durch das menschliche Feedback aus der Diskussion (Schritt 2).

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

Die Source verlinkt auf die Raw Source in `raw-sources/` — aber ausschließlich für den Menschen. Für das LLM ist die Source ab diesem Punkt der alleinige Arbeitsgegenstand. Die Raw Source wird nach Schritt 3 nicht mehr gelesen. Alle weiteren Verarbeitungen (Extraktion in Schritt 4, Updates in Schritt 5) basieren ausschließlich auf der Source.

---

## Schritt 4 — Extraktion

Schritt 4 ist das Herzstück des Ingest — hier wird aus der kuratierten Source maschinenlesbares Wissen.

**Wichtiger Kontextwechsel:** Ab diesem Schritt arbeitet das LLM **ausschließlich mit der Source** aus Schritt 3. Der Rohtext aus Schritt 1 wird nicht mehr verwendet — der LLM-Kontext wird bereinigt. Nur was in der Source steht, existiert für die Extraktion.

**Der Extraktions-Prompt (Template):**

```markdown
Du bist ein Wissensextraktor. Deine Aufgabe ist es, aus der folgenden
Source strukturiertes Wissen zu extrahieren. Extrahiere NUR, was
explizit in der Source steht — erfinde nichts dazu.

## Source
Titel: {title}
Typ: {source_type}
ID: {source_id}

{source_content}

## Extraktionsanweisung

1. **Entities** — identifizierbare Dinge (Personen, Organisationen,
   Projekte, Tools, Orte, Ereignisse).
   Format: `name | typ | beschreibung (1 satz) | schlüsselzitat`

2. **Concepts** — abstrakte Ideen, Theorien, Methoden, Patterns,
   Frameworks.
   Format: `name | domäne | definition (1-2 sätze) | schlüsselzitat`

3. **Claims** — überprüfbare Behauptungen, die die Source enthält.
   Jeder Claim braucht eine eindeutige Claim-ID (Slug-Pattern),
   eine Bewertung, wie stark die Source ihn stützt.
   Format: `claim-id | text | confidence (0-1) | belegstelle (absatz/zeile) | einschränkungen`

4. **Relationships** — explizite Verbindungen zwischen Entities
   und/oder Concepts.
   Format: `von | beziehung | nach | begründung (1 satz)`

5. **Open Questions** — Fragen, die die Source aufwirft aber nicht
   beantwortet.
   Format: `frage | kontext (warum ist sie relevant)`

## Ausgabe
Liefere NUR die strukturierte Extraktion im angegebenen Format.
Keine Einleitung, kein Kommentar.
```

**Konkretes Beispiel — Ausgabe (Extraktion):**

```
## Entities
Dr. Maria Schneider | person | Forscherin Uni Tübingen, Autorin der 2024er Metastudie | "…in einer Metastudie (n=1.200)…"
Seneca | person | römischer Philosoph, Stoiker | "Seneca beschreibt im 13. Brief…"

## Concepts
praemeditatio malorum | philosophie/psychologie | stoische Übung: bewusste Vorstellung des Schlimmsten | "die bewusste Vorstellung des Schlimmsten als Übung gegen Angst"
Cortisol-Senkung durch Meditation | neurobiologie | messbare Wirkung mentaler Übungen auf Stresshormone | "Cortisol-Spiegel um 18% senken"

## Claims
claim-cortisol-senkung | praemeditatio malorum senkt Cortisol um 18% | 0.85 | Absatz 2 | Meta-Studie, n=1.200, Nature Human Behaviour; Einschränkung: keine Wirkung <25 J.
claim-seneca-angst-these | Ängste entstehen aus Antizipation, nicht aus realen Ereignissen | 0.3 | Absatz 1 | philosophische Behauptung Senecas, kein empirischer Beleg

## Relationships
Seneca | definierte | praemeditatio malorum | 13. Brief an Lucilius
Dr. Maria Schneider | lieferte_empirischen_beleg_für | praemeditatio malorum | Meta-Studie (Cortisol -18%)

## Open Questions
Hält die Cortisol-Senkung nach Absetzen der Übungen an? | nur akute Effekte gemessen
```

---

## Schritt 5 — Update

Schritt 5 ist die eigentliche Wiki-Arbeit — hier entscheidet das LLM für jedes extrahierte Wissenselement, *wo* es hineingehört und *wie* es integriert wird.

### Ablauf — Index-First mit Zwei-Phasen-Lookup

Der Update-Schritt beginnt nicht mit einem Dateisystem-Scan, sondern mit einem **Index-Lookup in zwei Phasen**: Erst exakter Slug-Match (String-Vergleich), dann Semantic-Summary-Match (LLM-basiert).

```
1. index.md LESEN (eine Datei, ~12 KB)
   ↓
2. Für jedes extrahierte Element:
   ┌─ PHASE 1: Exakter Slug-Match (String-Vergleich, kein LLM)
   │  entity.seneca ↔ slug "seneca" → TREFFER ✓
   │  concept.praemeditatio-malorum ↔ slug
   │    "praemeditatio-malorum" → TREFFER ✓
   │  "Dr. Maria Schneider" ↔ slug "maria-schneider"
   │    → KEIN Slug-Treffer → weiter zu Phase 2
   │  "Cortisol-Senkung" ↔ Slugs → KEIN Treffer → weiter zu Phase 2
   │
   └─ PHASE 2: Semantic Summary-Match (LLM-basiert)

      Nur für Elemente ohne Phase-1-Treffer:
      LLM bekommt alle Summaries der passenden Kategorie
      und prüft semantische Ähnlichkeit.
      "Dr. Maria Schneider" → alle Entity-Summaries → "keiner"
      "Cortisol-Senkung" → alle Concept-Summaries →
        "cortisol-senkung-durch-meditation" → TREFFER ✓
   ↓
3. Nur bei TREFFERN: die entsprechende Seite laden und updaten
   Bei KEINEM TREFFER: neue Seite aus Template generieren
   → Ergebnis: 3-4 Seiten geladen (nicht alle 27)
```

### Die Entscheidungslogik

```
Für jede extrahierte Entity:
  ├─ Phase 1: Exakter Slug-Match?
  │   ├─ JA → SEITE LADEN → UPDATE
  │   └─ NEIN → Phase 2: Semantic Summary-Match (LLM)?
  │       ├─ JA → SEITE LADEN → UPDATE (evtl. Merge zweier ähnlicher Seiten)
  │       └─ NEIN → CREATE: Neue Seite aus Entity-Template

Für jedes extrahierte Concept:
  ├─ Phase 1: Exakter Slug-Match?
  │   ├─ JA → SEITE LADEN → UPDATE
  │   └─ NEIN → Phase 2: Semantic Summary-Match (LLM)?
  │       ├─ JA → SEITE LADEN → prüfen ob Merge oder separates Concept
  │       └─ NEIN → CREATE: Neue Seite aus Concept-Template

Für jeden extrahierten Claim (nach dem Laden der Zielseite):
  ├─ Gibt es einen inhaltlich ähnlichen Claim auf der Seite?
  │   ├─ JA und neuer Claim hat HÖHERE Confidence
  │   │   └─ SUPERSEDE: Alten Claim superseden, neuen aktivieren
  │   ├─ JA und neuer Claim hat NIEDRIGERE/GLEICHE Confidence
  │   │   └─ APPEND: Als zusätzliche Perspektive anfügen
  │   ├─ JA und Claims WIDERSPRECHEN sich
  │   │   └─ CONFLICT: Beide als contested markieren, Widerspruchs-Cluster anlegen
  │   └─ NEIN → CREATE: Neuen Claim mit Evidence und neuer Claim-ID anlegen

Für jede extrahierte Relationship:
  ├─ Existiert diese Connection bereits in der geladenen Seite?
  │   ├─ JA → SKIP (Duplikat)
  │   └─ NEIN → CREATE: In BEIDE betroffenen Seiten eintragen (Gegenseite auch updaten)

Für jede Open Question:
  └─ In die geladenen betroffenen Seiten als ## Offene Fragen eintragen
```

### Der Update-Prompt

Dieser Prompt wird **pro betroffener Seite einzeln** ausgeführt.

```markdown
Du bist ein Wiki-Maintainer. Deine Aufgabe ist es, EINE bestehende
Wiki-Seite mit neuem Wissen aus einer soeben ingestierten Quelle
zu aktualisieren. Dieser Prompt betrifft AUSSCHLIESSLICH die unten
angegebene Seite — andere Seiten erhalten eigene Prompts.

## Bestehende Seite
{current_page_content}

## Neues Wissen aus Source "{source_title}" (ID: [[sources/{source_slug}]])
- Entities: {extracted_entities_for_this_page}
- Claims: {extracted_claims_for_this_page}
- Relationships: {extracted_relationships_for_this_page}
- Open Questions: {extracted_questions_for_this_page}

## Update-Regeln

1. **Human Block** — Deine Änderungen gehen NUR in den implizit LLM-verwalteten
   Bereich. Human-Blöcke (`<!-- llm-wiki:human -->`) sind TABU.

2. **Prosa aktualisieren** — Integriere die neuen Informationen fließend
   in den bestehenden Text. Kein "Update: ..."-Prefix, sondern echter Merge.

3. **Claims anfügen** — Neue Claims im `## Claims`-Kapitel ergänzen,
   mit eindeutiger Claim-ID (`id:claim-xxx`) und Inline-Metadaten
   (`conf:0.X` `status:...`). Keine bestehenden Claims löschen
   (es sei denn superseded → `status:superseded`).
   Jeder Claim erhält eine neue, stabile ID, die sich nie ändert.

4. **Relationships pflegen** — Neue Verknüpfungen im `## Verknüpfungen`-
   Kapitel ergänzen. GEGENSEITIG: Wenn A → B neu ist, wird auch B → A ergänzt.

5. **Widersprüche markieren** — Wenn ein neuer Claim einem bestehenden
   widerspricht: NICHT eigenständig lösen. Beide mit `status:contested`
   markieren.

6. **Open Questions** — Neue Fragen ins `## Offene Fragen`-Kapitel aufnehmen.

## Ausgabe
Liefere die VOLLSTÄNDIGE aktualisierte Seite.
Kein Diff, kein Kommentar — die ganze Seite.
```

### Vorher/Nachher — Beispiel an der `entity.seneca`-Seite

**Vor dem Ingest:**

```markdown
---
id: entity.seneca
page: entity
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

Lucius Annaeus Seneca (ca. 4 v. Chr. — 65 n. Chr.) war ein römischer
Philosoph, Dramatiker und Staatsmann. Seine "Briefe an Lucilius" sind
eine Sammlung von 124 moralischen Briefen.

Seneca betonte die praktische Anwendung der Philosophie im Alltag.
Zentral ist die Unterscheidung zwischen dem, was wir kontrollieren
können und dem, was wir nicht kontrollieren können.

<!-- llm-wiki:human:start -->
## Persönliche Notizen
Ich finde Senecas Briefe zugänglicher als Marc Aurels
Selbstbetrachtungen — weniger kryptisch, direkter anwendbar.
<!-- llm-wiki:human:end -->
```

**Nach dem Ingest:**

```markdown
---
id: entity.seneca
page: entity
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

Lucius Annaeus Seneca (ca. 4 v. Chr. — 65 n. Chr.) war ein römischer
Philosoph, Dramatiker und Staatsmann. Seine "Briefe an Lucilius" sind
eine Sammlung von 124 moralischen Briefen.

Seneca betonte die praktische Anwendung der Philosophie im Alltag.
Zentral ist die Unterscheidung zwischen dem, was wir kontrollieren
können und dem, was wir nicht kontrollieren können.

Eine seiner wirkmächtigsten Techniken ist die **praemeditatio malorum**
— die bewusste Vorstellung des Schlimmsten als Übung gegen Angst. Diese
Technik wurde 2024 von Dr. Maria Schneider in einer Metastudie empirisch
bestätigt: tägliche Übungen senken den Cortisol-Spiegel um 18%.

Sein Einfluss reicht bis in die moderne Psychologie (Kognitive
Verhaltenstherapie greift zentrale stoische Konzepte auf).

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

- `praktizierte` → [[concepts/stoizismus]]
- `definierte` → [[concepts/praemeditatio-malorum]]
- `wurde_empirisch_bestätigt_durch` → [[entities/maria-schneider]]
  *Notiz:* Schneiders Metastudie (2024) belegt die Cortisol-Senkung

<!-- llm-wiki:human:start -->
## Persönliche Notizen
Ich finde Senecas Briefe zugänglicher als Marc Aurels
Selbstbetrachtungen — weniger kryptisch, direkter anwendbar.
<!-- llm-wiki:human:end -->
```

**Zerlegung — was genau passiert ist:**

1. **Prosa-Merge:** Der Abschnitt "Lehre" wurde um zwei neue Absätze ergänzt — praemeditatio-Definition, empirischer Beleg, Einschränkung.
2. **Strukturierter Claim:** Senecas Angst-These mit `id:claim-seneca-angst-these`, `confidence: 0.3` und `status: uncertain` — explizit als philosophische Behauptung markiert.
3. **Neue Relationships:** Gegenseitige Aktualisierung auf beiden betroffenen Seiten.
4. **Human Block unangetastet:** Die persönliche Notiz blieb exakt erhalten.

**Weitere betroffene Seiten (analog):**
- `entity.maria-schneider` — neu angelegt mit Forschungsprofil
- `concept.praemeditatio-malorum` — ergänzt um empirische Evidenz
- `concept.cortisol-senkung-durch-meditation` — neu angelegt
- `entity.uni-tuebingen` — neu angelegt oder ergänzt

Insgesamt wurden aus einer Quelle **8-10 Seiten** berührt — genau Karpathys "a single source might touch 10-15 wiki pages".
