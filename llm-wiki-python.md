# LLM Wiki — Karpathy-Pattern als Python-Projekt für OpenClaw

# TODO

- [ ] **Contested Claims — Auflösungs-Workflow definieren.** Der Compile erkennt Widersprüche zwischen Claims und setzt den Status auf `contested`, aber es fehlt ein formaler Resolve-Prozess:
  - Resolve als First-Class-Operation (neben Ingest, Query, Lint)
  - Auflösungsregeln: Confidence-Delta? Quellenalter? Methodische Qualität? Automatische vs. menschliche Entscheidung?
  - Auflösungsdokumentation: `resolved_by`-Feld im Claim, `## Resolutions`-Sektion?
  - Kaskadierung: Abhängige Claims prüfen, wenn ein referenzierter Claim aufgelöst wird

> Idee / Design-Dokument — Stand 2026-05-07 (Feedback-Runde 5 eingearbeitet: Claim-Sektion gekürzt, Claim-Spezifikation nach Kap. 4 verschoben, nur noch Human Blocks markiert, Beispiele nach Erklärungen, Key-Takeaways/Main-Points präzisiert)

---

## Inhaltsverzeichnis

- [1. Das Problem: Warum RAG nicht reicht](#1-das-problem-warum-rag-nicht-reicht)
- [2. Grundlagen — Die zentralen Konzepte](#2-grundlagen--die-zentralen-konzepte)
- [3. Die Architektur: Drei Schichten](#3-die-architektur-drei-schichten)
- [4. Die Wiki-Struktur](#4-die-wiki-struktur)
  - [4.1 Vault-Layout \& Page-Typen](#41-vault-layout--page-typen)
  - [4.2 Source — die Wissensgrundlage](#42-source--die-wissensgrundlage)
  - [4.3 Entity — identifizierbare Dinge](#43-entity--identifizierbare-dinge)
  - [4.4 Concept — abstrakte Ideen](#44-concept--abstrakte-ideen)
  - [4.5 Synthesis — Querschnittsanalysen](#45-synthesis--querschnittsanalysen)
  - [4.6 Report — Dashboards](#46-report--dashboards)
  - [4.7 Format-Konventionen](#47-format-konventionen)
  - [4.8 Der Claim im Detail](#48-der-claim-im-detail)
  - [4.9 index.md — Der Content-Katalog](#49-indexmd--der-content-katalog)
  - [4.10 log.md — Die Chronik](#410-logmd--die-chronik)
- [5. Die Operationen](#5-die-operationen)
  - [5.1 Ingest — Überblick](#51-ingest--überblick)
  - [5.2 Query](#52-query)
  - [5.3 Lint](#53-lint)
  - [5.4 Compile](#54-compile)
  - [5.5 Validate — Herkunftsprüfung](#55-validate--herkunftsprüfung)
- [6. Design-Prinzipien](#6-design-prinzipien)
- [7. Erweiterungen gegenüber dem Original-Pattern](#7-erweiterungen-gegenüber-dem-original-pattern)
- [8. PKM-Konzepte](#8-pkm-konzepte-was-fehlt-was-passt-was-ergänzt)
- [9. Use Cases](#9-use-cases)
- [10. Glossar](#10-glossar)
- [11. Risiken, Fehlerquellen und Gegenmaßnahmen](#11-risiken-fehlerquellen-und-gegenmaßnahmen)
- [12. Zusammenfassung](#12-zusammenfassung)
- [13. Quellen](#13-quellen)

---

## 1. Das Problem: Warum RAG nicht reicht

Retrieval-Augmented Generation (RAG) ist der Status Quo für "LLM trifft Dokumente": Chunks in eine Vektordatenbank, bei Query die ähnlichsten Chunks rausziehen, ins Prompt packen, Antwort generieren. Das funktioniert für einfache Faktenfragen — scheitert aber systematisch an drei Punkten:

1. **Kein Wissensaufbau.** Jede Query startet bei Null. Das LLM muss aus fragmentierten Chunks jedes Mal neu synthetisieren. Cross-References zwischen Dokumenten existieren nicht — sie werden zur Laufzeit durch Cosine-Similarity approximiert, was fehleranfällig und kontextblind ist.

2. **Keine Akkumulation.** Wenn du heute Paper A liest und morgen Paper B, das Paper A widerspricht, merkt das niemand. Der Widerspruch wird nur dann "entdeckt", wenn zufällig beide Chunks in derselben Query landen.

3. **Keine Kuratierung.** RAG liefert Roh-Chunks. Es gibt keine Abstraktionsebene — keine Synthese, keine Einordnung, keine Bewertung der Qualität oder Aktualität einer Information.

**Karpathys Gegenentwurf:** Nicht bei jeder Query neu zusammensuchen, sondern **einmal kompilieren und dann aktuell halten**. Das Wiki ist ein persistentes, wachsendes Artefakt — eine kuratierte, verlinkte Wissensschicht zwischen dir und den Rohquellen. Karpathys prägnanteste Formulierung:

> *"Obsidian is the IDE; the LLM is the programmer; the wiki is the codebase."*

---

## 2. Grundlagen — Die zentralen Konzepte

Bevor wir in Architektur und Struktur eintauchen, hier die fundamentalen Bausteine des LLM Wikis. Dieses Kapitel dient als Referenz — wenn dir später ein Begriff begegnet, findest du ihn hier definiert.

### Raw Source

Ein unbearbeitetes Quelldokument: Artikel, Paper, Transkript, Podcast-Notiz, Chat-Export, Buch-Highlight. Raw Sources sind **immutable** — das LLM liest sie nur beim ersten Ingest, überschreibt sie nie. Sie liegen in `raw-sources/`. Nach der Verarbeitung werden sie vom LLM nicht mehr verwendet; sie dienen nur noch dem Menschen als Originalreferenz.

### Source

Eine verarbeitete Wiki-Seite vom Typ `source` im Ordner `sources/`. Die Source entsteht aus einer Raw Source im Ingest-Schritt — vom LLM aufbereitet, vom Menschen geprüft und gegebenenfalls korrigiert. Die Source ist die **kuratierte Wissensgrundlage**: Key Takeaways sind priorisiert, Unklarheiten sind markiert, der Kontext ist eingeordnet. Alle weiteren Verarbeitungen (Extraktion, Claims, Updates) basieren ausschließlich auf Sources — nie direkt auf Raw Sources.

### Wiki Page

Eine vom LLM generierte und gepflegte Markdown-Datei mit festem Typ: `source`, `entity`, `concept`, `synthesis` oder `report`. Jede Page hat ein YAML-Frontmatter mit Metadaten (ID, Status, Tags, Confidence) und strukturierte Kapitel mit Markdown-Überschriften.

### Entity

Beschreibt eine **identifizierbare Sache**: Person, Organisation, Projekt, Tool, Ort oder Ereignis. Entities sind die „Substantive" des Wikis — sie sind das, *wortüber* gesprochen wird. Eine Entity sammelt Claims, hat Verknüpfungen zu anderen Seiten und kann auf mehrere Sources verweisen. Beispiel: `entity.seneca`, `entity.maria-schneider`.

### Concept

Beschreibt eine **abstrakte Idee, Theorie, Pattern, Methode oder Framework**. Concepts sind die „Verben und Adjektive" des Wikis — sie beschreiben, *wie* Dinge zusammenhängen. Ein Concept sammelt Claims, hat Verknüpfungen und wächst mit jeder neuen Quelle (Evergreen Notes). Beispiel: `concept.praemeditatio-malorum`, `concept.stoizismus`.

### Synthesis

Eine **Querschnittsanalyse**, die mehrere Entities oder Concepts zu einer höheren Analyse verknüpft. Anders als ein Concept, das ein einzelnes Pattern beschreibt, stellt eine Synthesis eine Querverbindung zwischen mehreren Page-Typen her. Entsteht aus Queries (≥3 Quellen verknüpft), Compile-Erkennung oder manuellem Anstoß. Beispiel: `synthesis.stoizismus-und-empirie`.

### Report

Ein **automatisch generiertes Dashboard** — wird bei jedem Compile komplett neu generiert. Reports sind rein lesend für den Menschen; das LLM nutzt sie für Health-Monitoring. Beispiel: `reports/open-questions.md`, `reports/contradictions.md`.

### Claim

Der **zentrale Wissensbaustein** des Wikis — eine einzelne, überprüfbare Behauptung mit eindeutiger ID, Confidence, Status und Beleg. Claims sind strukturierte Einträge im `## Claims`-Kapitel jeder Content-Page. Sie machen aus vagen Aussagen ein trackbares Belief-System: Jeder Claim trägt seinen eigenen Herkunftsnachweis direkt im `*Beleg:*`-Feld. Die detaillierte Claim-Spezifikation (Felder, Status-Werte, ID-Konventionen) steht in [4.8 — Der Claim im Detail](#48-der-claim-im-detail).

### Evidence

Der Beleg für einen Claim — immer ein Wikilink auf eine Source im `*Beleg:*`-Feld. Kein Claim ohne Evidence. Jeder Claim trägt seinen eigenen Herkunftsnachweis direkt bei sich, statt auf eine separate Quellenliste zu verweisen. Das macht die Rückverfolgbarkeit granularer und präziser.

### Human Block

Der einzige markierte Abschnitt in einer Wiki-Seite — eingeschlossen von `<!-- llm-wiki:human:start -->` und `<!-- llm-wiki:human:end -->`. Enthält handschriftliche Notizen des Menschen und wird **niemals** vom LLM angetastet. Alles außerhalb dieser Marker ist implizit LLM-verwaltet und darf vom Agenten gelesen und geschrieben werden.

```markdown
{ALLES außerhalb der Human-Marker ist LLM-verwaltet: Prosa, Claims, Verknüpfungen, Offene Fragen}

<!-- llm-wiki:human:start -->
[Handschriftliche Notizen — werden NIE vom LLM angetastet]
<!-- llm-wiki:human:end -->
```

Es gibt **keinen** Managed-Block-Marker. Nur Human Blocks werden explizit markiert — alles andere ist implizit LLM-Managed. Dies sind die einzigen HTML-Kommentare im System.

### Confidence

Vertrauenswürdigkeit eines Claims (0.0–1.0). Wird vom LLM initial geschätzt und vom Compile anhand von vier Faktoren kalibriert: Quellentyp (30%), Belegqualität (30%), Anzahl Belege (20%), Aktualität (20%). Die **Page-Level Confidence** ist das arithmetische Mittel aller Claim-Confidence-Werte auf der Seite.

---

## 3. Die Architektur: Drei Schichten

Das Schema definiert die Spielregeln, die Raw Sources liefern den Input, die Wiki Pages sind das Ergebnis. Keine komplexe Zwischenschicht — eine klare Pipeline.

```
┌─────────────────────────────────────────────┐
│  Das Schema    (foundation & rules)         │
│  AGENTS.md  wiki-schema.md  templates/      │
├─────────────────────────────────────────────┤
│  Raw Sources   (input, immutable)           │
│  raw-sources/  inbox/                       │
├─────────────────────────────────────────────┤
│  Wiki Pages    (output, LLM-maintained)     │
│  sources/  entities/  concepts/             │
│  syntheses/  reports/  index  log           │
└─────────────────────────────────────────────┘
```

**Layer 1 — Das Schema (Grundlage):** Die Konfigurationsdateien, die aus einem generischen LLM einen disziplinierten Wiki-Maintainer machen. Definiert Ordnerstruktur, Page-Typen, Namenskonventionen (Slug-basierte IDs: `entity.john-doe`, `concept.stoizismus`), YAML-Frontmatter-Felder pro Page-Typ, Workflows für Ingest/Query/Lint und Formatierungsregeln. Wird von Mensch und LLM gemeinsam über die Zeit weiterentwickelt. Diese Schicht ist das Fundament — sie legt fest, *wie* aus Rohmaterial strukturiertes Wissen wird.

**Layer 2 — Raw Sources (Input):** Deine kuratierte Quellensammlung. Artikel, Papers, Podcast-Notizen, Chat-Exports, Buch-Highlights, Meeting-Transkripte. Diese Schicht ist *immutable* — das LLM liest nur, schreibt nie. Das ist dein Source of Truth. Neue Quellen landen in `inbox/`, verarbeitete in `raw-sources/`. Raw Sources werden nur einmalig für den Ingest eingelesen; danach arbeitet das LLM ausschließlich mit den daraus erstellten Sources (Layer 3).

**Layer 3 — Wiki Pages (Output):** Die resultierenden LLM-generierten und -gepflegten Markdown-Dateien. Sources (verarbeitete, menschlich geprüfte Wissensgrundlage), Entity Pages (Personen, Projekte, Tools, Orte), Concept Pages (Ideen, Theorien, Patterns), Syntheses (Querschnittsanalysen), Reports (Dashboards). Der Mensch liest; das LLM schreibt. Anders als im Original ist dieser Layer bewusst einfach gehalten — er ist das *Ergebnis* der Verarbeitung, nicht eine komplexe Zwischenschicht.

Layer 3 wird intern in zwei klar getrennte Kategorien aufgeteilt:

- **Content Pages** — sources, entities, concepts, syntheses, reports. Das sind die eigentlichen Wissensträger. Sie enthalten Claims, Belege, Querverweise. Der Mensch liest sie aktiv, sie sind der Purpose des Wikis.
- **Meta Pages** — index.md, log.md. Sie sind Navigation und Audit-Trail. Sie existieren, damit das LLM effizient arbeiten kann (Lookup, Chronik, Herkunftsnachweis). Der Mensch blättert sie gelegentlich durch, aber sie sind nicht der Wissensspeicher selbst.

Beide werden vom LLM geschrieben, beide leben im selben Vault. Der Unterschied ist die Funktion: Content Pages *speichern* Wissen, Meta Pages *organisieren* den Zugriff darauf. Eine formale Sub-Layer-Trennung würde mehr Overhead als Nutzen bringen — die Unterscheidung fließt aber konzeptionell in das Schema ein (z.B. dass `index.md` und `log.md` eigene Templates bekommen, die nie mit einer Content-Page verwechselt werden).

---

## 4. Die Wiki-Struktur

Dieses Kapitel definiert die physische und logische Struktur des Wiki-Vaults: Welche Ordner es gibt, welche Page-Typen darin leben, wie sie aufgebaut sind und wie sie miteinander vernetzt werden. Wir beginnen mit dem großen Ganzen — dem Vault-Layout — und gehen dann ins Detail: die fünf Page-Typen, die Format-Konventionen und die Meta-Strukturen (Index und Log).

### 4.1 Vault-Layout & Page-Typen

Das Wiki ist wie folgt aufgebaut:

```
wiki-vault/
├── AGENTS.md              # Layer 1: Schema für den Agenten
├── wiki-schema.md         # Layer 1: Wiki-Konventionen (Templates, Style Guide)
├── index.md               # Layer 3: Content-Katalog (auto-generiert)
├── log.md                 # Chronik (append-only)
├── inbox/                 # Layer 2: Neue Quellen, noch nicht ingested
├── raw-sources/           # Layer 2: Rohquellen (immutable, nach Ingest hierher verschoben)
├── sources/               # Layer 3: Verarbeitete Quellen — die Wissensgrundlage des Wikis
├── entities/              # Layer 3: Personen, Projekte, Tools, Orte
├── concepts/              # Layer 3: Ideen, Patterns, Theorien
├── syntheses/             # Layer 3: Querschnittsanalysen
└── reports/               # Layer 3: Dashboards (auto-generiert)
```

Die Rohquellen liegen in `raw-sources/` (immutable, das LLM liest sie nur beim Ingest). Nach dem Ingest erstellt das LLM eine **Source** in `sources/`. Die Source ist die **verarbeitete, menschlich geprüfte Wissensgrundlage** — sie enthält den aufbereiteten Inhalt der Raw Source, angereichert durch menschliches Feedback aus der Diskussion (Schritt 2 des Ingest). Ab diesem Punkt arbeitet das LLM ausschließlich mit der Source. Die Raw Source wird nicht mehr verwendet; sie dient nur noch dem Menschen zur Nachprüfbarkeit über den Link in der Source.

Anders als die Raw Source, die Rohmaterial ist, ist die Source bereits kuratiertes Wissen: Key Takeaways sind priorisiert, Unklarheiten sind markiert, der Kontext ist eingeordnet. Alle weiteren Verarbeitungsschritte (Extraktion, Update) bauen auf dieser Grundlage auf — nicht auf der Raw Source.

**Übersicht der fünf Page-Typen:**

| Typ         | Ordner       | Beschreibung                                                                                 |
| ----------- | ------------ | -------------------------------------------------------------------------------------------- |
| `source`    | `sources/`   | Verarbeitete Wissensgrundlage aus einer Raw Source — die Basis aller weiteren Verarbeitungen |
| `entity`    | `entities/`  | Identifizierbare Dinge: Person, Projekt, Tool, Organisation                                  |
| `concept`   | `concepts/`  | Abstrakte Ideen, Theorien, Patterns, Methoden                                                |
| `synthesis` | `syntheses/` | Querschnittsanalysen, Vergleiche, Thesen                                                     |
| `report`    | `reports/`   | Auto-generierte Dashboards                                                                   |

Im Folgenden wird jeder Page-Typ im Detail beschrieben — wann er entsteht, was er enthält, wie er strukturiert ist.

### 4.2 Source — die Wissensgrundlage

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

**Besonderheiten:**
- Die `## Verlinkte Wiki-Seiten`-Liste wird **ausschließlich vom Compile** gepflegt, nicht vom LLM beim Ingest.
- Die Source ist der *einzige* Page-Typ, der direkt auf eine Raw Source (`[[raw-sources/...]]`) verlinkt — und das ausschließlich für den Menschen.
- Alle anderen Page-Typen (entity, concept, synthesis) verlinken ausschließlich auf Sources.
- Die Source ist die verarbeitete Grundlage: Was hier nicht steht, existiert für das LLM nicht. Sie ist der Flaschenhals, durch den alles Rohwissen fließt und geprüft wird.
- Die Source selbst hat keinen Human Block — sie ist komplett LLM-verwaltet.

---

### 4.3 Entity — identifizierbare Dinge

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

---

### 4.4 Concept — abstrakte Ideen

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
- Auch hier: Alles außerhalb der Human-Block-Marker ist implizit LLM-verwaltet.

---

### 4.5 Synthesis — Querschnittsanalysen

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

---

### 4.6 Report — Dashboards

Der Page-Typ `report` ist ein **automatisch generiertes Dashboard**. Anders als alle anderen Page-Typen wird ein Report bei jedem Compile komplett neu generiert. Reports sind rein lesend für den Menschen; das LLM nutzt sie für Health-Monitoring.

**Wann entsteht ein Report?** Ausschließlich beim Compile (Phase 4: Dashboards). Nie durch Ingest oder Query.

**Liste der Standard-Reports:**

| Report                          | Beschreibung                              |
| ------------------------------- | ----------------------------------------- |
| `reports/open-questions.md`     | Alle ungelösten Fragen aus allen Seiten   |
| `reports/contradictions.md`     | Page-Level und Claim-Level Widersprüche   |
| `reports/low-confidence.md`     | Seiten & Claims mit confidence < 0.5      |
| `reports/claim-health.md`       | Missing Evidence, Contested, Stale Claims |
| `reports/stale-pages.md`        | Seiten ohne Update trotz neuer Quellen    |
| `reports/person-directory.md`   | Alle Entities vom Typ "person"            |
| `reports/relationship-graph.md` | Alle strukturierten Relationships         |
| `reports/herkunftsabdeckung.md` | Evidence-Statistiken pro Source           |
| `reports/privacy-review.md`     | Seiten mit sensiblen Inhalten             |

**Struktur eines Report (Beispiel `reports/open-questions.md`):**

```markdown
---
id: report.open-questions
page: report
title: Offene Fragen
status: active
tags:
  - dashboard
created: 2026-05-02
updated: 2026-05-02
---

# Offene Fragen

> Auto-generated at 2026-05-02T10:35:00Z | 3 pages mit 5 Fragen

## [[entities/seneca]]
- Hält die Cortisol-Senkung nach Absetzen der Übungen an?
  *Kontext:* Studie misst nur akute Effekte

## [[concepts/praemeditatio-malorum]]
- Hält die Cortisol-Senkung nach Absetzen der Übungen an?
  *Kontext:* Studie misst nur akute Effekte
- Warum wirkt praemeditatio nicht bei unter 25-Jährigen?
  *Kontext:* Mögliche Erklärung: präfrontaler Cortex noch nicht voll entwickelt

## [[syntheses/stoizismus-und-empirie]]
- Gibt es stoische Techniken, die empirisch *widerlegt* wurden?
- Wie verhalten sich stoische und buddhistische Meditation im direkten Vergleich?
```

**Besonderheiten:**
- Reports haben **keinen** Human Block — sie werden komplett neu generiert und enthalten keine persönlichen Notizen.
- Claims werden in Dashboards über ihre `page-id#claim-id`-Referenz identifiziert.
- Reports sind optional — der Compile generiert nur die, für die es auch Daten gibt.

---

### 4.7 Format-Konventionen

Das gesamte Wiki verwendet Obsidian-Wikilinks (`[[pfad/zur/seite]]`) statt Markdown-Links. Metadaten, die maschinell geparst werden müssen, stehen im **YAML-Frontmatter** — Tags, ID, Page-Typ, Status, Confidence, Zeitstempel. Alles andere (Claims, Verknüpfungen) steht als normales Markdown im Body.

**Human Blocks** (`<!-- llm-wiki:human:start -->` / `<!-- llm-wiki:human:end -->`) sind die einzigen HTML-Kommentare im System und schützen handschriftliche Notizen vor Überschreiben. Alles außerhalb dieser Marker ist implizit LLM-verwaltet — es gibt keine Managed-Block-Marker. Zur Kapitelstrukturierung werden ausschließlich normale Markdown-Überschriften (`##`, `###`) verwendet.

#### YAML-Frontmatter: Felder im Detail

Jede Wiki-Seite beginnt mit einem YAML-Frontmatter-Block. Die folgenden Felder sind definiert:

| Feld         | Pflicht | Typ    | Beschreibung                                                                               |
| ------------ | ------- | ------ | ------------------------------------------------------------------------------------------ |
| `id`         | ✅       | string | Eindeutiger Identifier, z.B. `entity.seneca`. Präfix = Page-Typ, Suffix = Slug.            |
| `page`       | ✅       | enum   | `source`, `entity`, `concept`, `synthesis`, `report`                                       |
| `title`      | ✅       | string | Anzeigename der Seite                                                                      |
| `status`     | ✅       | string | `active`, `review`, `archived`                                                             |
| `tags`       | ✅       | list   | Thematische Tags für Filterung (z.B. `[philosophie, stoizismus]`)                          |
| `confidence` | ❌       | float  | Page-Level Confidence (0.0–1.0). Durchschnitt aller Claims. `null` bei Seiten ohne Claims. |
| `created`    | ✅       | date   | Erstellungsdatum (ISO 8601)                                                                |
| `updated`    | ✅       | date   | Letzte Änderung (ISO 8601)                                                                 |

**Regeln:**
- `id` ist eindeutig über den gesamten Vault. Keine zwei Seiten dürfen dieselbe ID haben.
- `page` muss mit dem Ordner übereinstimmen (`entities/seneca.md` → `page: entity`). Mismatch → Lint-Error.
- `tags` sind eine YAML-Liste, keine Inline-Flags. Tags werden kleingeschrieben und ohne `#`-Präfix gespeichert.
- `confidence` ist `null`, wenn die Seite keine Claims hat (z.B. frisch angelegt, noch keine Extraktion).
- `status: review` bedeutet: Seite ist neu und wurde noch nicht vom Menschen abgenommen.

#### Confidence — wie sie sich ergibt

Die **Page-Level Confidence** (`confidence` im YAML-Frontmatter) ist das **arithmetische Mittel** aller Claim-Confidence-Werte auf der Seite:

```
page.confidence = sum(claim.confidence for claim in claims) / len(claims)
```

Die **Claim-Confidence** (`conf:0.X` im `## Claims`-Kapitel) wird bei der Extraktion vom LLM gesetzt und später durch den Compile kalibriert. Die Kalibrierung gewichtet vier Faktoren:

| Faktor            | Gewicht | Beschreibung                                                                                                    |
| ----------------- | ------- | --------------------------------------------------------------------------------------------------------------- |
| **Quellentyp**    | 30%     | peer-reviewed (1.0) > Buch (0.8) > Konferenz (0.7) > Blogpost (0.5) > Social Media (0.2) > LLM-generiert (0.1)  |
| **Belegqualität** | 30%     | Direktzitat mit Seitenangabe (1.0) > Paraphrase mit Absatz (0.7) > Allgemeine Referenz (0.4) > Kein Beleg (0.0) |
| **Anzahl Belege** | 20%     | 1 Beleg = 0.5, 2 Belege = 0.7, 3+ Belege = 1.0 (logarithmische Skala)                                           |
| **Aktualität**    | 20%     | < 1 Jahr (1.0) > < 3 Jahre (0.8) > < 5 Jahre (0.6) > < 10 Jahre (0.4) > älter (0.2)                             |

**Beispielrechnung für einen Claim:**
```
Claim: "praemeditatio senkt Cortisol um 18%"
- Quellentyp: peer-reviewed (Nature Human Behaviour) → 1.0 × 0.30 = 0.30
- Belegqualität: Direktzitat mit Absatzangabe → 1.0 × 0.30 = 0.30
- Anzahl Belege: 1 Beleg → 0.5 × 0.20 = 0.10
- Aktualität: 2024, < 1 Jahr → 1.0 × 0.20 = 0.20
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Calibrated Confidence = 0.90 → gerundet auf 0.9
```

Das LLM setzt initial eine geschätzte Confidence. Der Compile kalibriert sie anhand der vier Faktoren nach. Die kalibrierte Confidence wird im Claim und als Page-Level-Durchschnitt ins Frontmatter zurückgeschrieben.

---

### 4.8 Der Claim im Detail

Dieses Kapitel spezifiziert den Claim vollständig — seine Felder, Status-Werte und die ID-Konvention. Claims sind die atomaren Wissensbausteine des Wikis; ihre präzise Definition ist essentiell für den Compile, die Dashboards und die Cross-Referenzierung.

#### Claim-Felder

Jeder Claim im `## Claims`-Kapitel hat:

| Feld               | Typ      | Pflicht | Beschreibung                                                                        |
| ------------------ | -------- | ------- | ----------------------------------------------------------------------------------- |
| `id:claim-xxx`     | string   | ✅       | Eindeutige Claim-ID, Slug-Pattern, page-scoped (z.B. `id:claim-cortisol-senkung`)   |
| `conf:0.X`         | float    | ✅       | Confidence (0.0–1.0), vom LLM gesetzt, vom Compile kalibriert                       |
| `status:...`       | enum     | ✅       | `active`, `contested`, `superseded`, `deprecated`, `uncertain`                      |
| `*Beleg:*`         | wikilink | ✅       | Wikilink auf Source + optionale Stellenangabe                                       |
| `*Einschränkung:*` | text     | ❌       | Methodische oder inhaltliche Limitationen                                           |
| `*aktualisiert:*`  | datum    | ❌       | Wann der Claim zuletzt überprüft wurde                                              |
| `*Kontext:*`       | text     | ❌       | Zusätzlicher Hintergrund                                                            |

#### Claim-Status im Detail

| Status       | Bedeutung                                                | Auslöser                                       |
| ------------ | -------------------------------------------------------- | ---------------------------------------------- |
| `active`     | Claim ist gültig und aktuell                             | Default bei Neuanlage                          |
| `contested`  | Zwei Claims widersprechen sich                           | Konflikt-Erkennung beim Ingest                 |
| `superseded` | Neuerer Claim mit höherer Confidence hat diesen abgelöst | Update-Schritt: SUPERSEDE                      |
| `deprecated` | Claim ist nicht mehr relevant                            | Manuell oder durch Lint                        |
| `uncertain`  | Claim ist spekulativ, keine harte Evidenz                | Extraktion: philosophische Behauptung, Meinung |

#### Claim-ID-Konvention

- Pattern: `claim-<kurzbeschreibung>` — slugifiziert, kleingeschrieben, Bindestriche
- Scope: eindeutig innerhalb einer Seite (nicht Vault-weit)
- Vollständige Referenz: `page-id#claim-id`, z.B. `entity.seneca#claim-cortisol-senkung`
- Die ID wird vom LLM beim Anlegen vergeben und ändert sich nie
- Dashboards und der Index referenzieren Claims über diese vollständige Referenz

#### Claims — Format und Beispiele

Claims im `## Claims`-Kapitel haben eine eindeutige ID. Der Beleg ist immer ein Wikilink auf eine Source:

```markdown
## Claims

- `id:claim-cortisol-senkung` `conf:0.85` `status:active`
  Praemeditatio malorum senkt Cortisol um durchschnittlich 18%
  *Beleg:* [[sources/schneider-metastudie-2024]] (Absatz 3, n=1.200)
  *Einschränkung:* Keine Wirkung bei Teilnehmern unter 25 Jahren

- `id:claim-seneca-angst-these` `conf:0.3` `status:uncertain`
  Senecas These: „Die meisten Ängste entstehen aus antizipiertem Leiden,
  nicht aus realem"
  *Beleg:* [[sources/briefe-an-lucilius]] (13. Brief)
  *Einschränkung:* Philosophische Behauptung, 2.000 Jahre alt, kein empirischer Beleg
  *aktualisiert:* 2026-05-02
```

---

### 4.9 index.md — Der Content-Katalog

Der Index ist die zentrale Navigationsstruktur des Wikis. Er wird bei jedem Compile automatisch neu generiert und listet **jede Wiki-Seite** mit den Feldern, die das LLM für Lookup und Query-Scoping braucht — nicht den Seiteninhalt selbst.

**Felder pro Index-Eintrag (extrahiert aus YAML-Frontmatter und Body):**

| Feld               | Quelle                        | Typ          | Beschreibung                                                     |
| ------------------ | ----------------------------- | ------------ | ---------------------------------------------------------------- |
| `id`               | `id` im Frontmatter           | string       | Eindeutiger Identifier, z.B. `entity.seneca`                     |
| `slug`             | Aus `id` abgeleitet           | string       | Dateiname ohne `.md`, z.B. `seneca`                              |
| `title`            | `title` im Frontmatter        | string       | Anzeigename, z.B. `Seneca`                                       |
| `pageType`         | `page` im Frontmatter         | enum         | `source`, `entity`, `concept`, `synthesis`, `report`             |
| `summary`          | Erster Satz nach `# Titel`    | string       | L1-One-Liner (max. 1 Satz)                                       |
| `path`             | Dateipfad                     | string       | Relativer Pfad, z.B. `entities/seneca.md`                        |
| `claimCount`       | `## Claims`                   | number       | Anzahl strukturierter Claims                                     |
| `claimIds`         | `id:claim-xxx` im `## Claims` | string[]     | Liste aller Claim-IDs auf der Seite (für direkte Referenzierung) |
| `hasOpenQuestions` | `## Offene Fragen`            | boolean      | Für Dashboard-Query: Welche Seiten haben offene Fragen?          |
| `confidence`       | `confidence` im Frontmatter   | number\|null | Page-Level Confidence (Durchschnitt aller Claims)                |
| `status`           | `status` im Frontmatter       | string       | `active`, `review`, `archived`                                   |
| `tags`             | `tags` im Frontmatter         | string[]     | Tags für thematische Filterung                                   |
| `updatedAt`        | `updated` im Frontmatter      | ISO-Datum    | Letzte Änderung                                                  |

Selbst bei 200 Seiten ist der Index nur ~10-15 KB groß. Das LLM kann ihn in einem einzigen Read erfassen und dann gezielt die 3-5 relevanten Seiten nachladen.

**Konkretes Beispiel:**
```markdown
# Wiki Index

> Auto-generated at 2026-05-02T10:30:00Z | 5 pages | 2 sources | 6 claims

## Sources

- [[sources/briefe-an-lucilius]]
  `page:source` `1 claim` `active` `2026-05-01` `#philosophie #stoizismus`
  — Verarbeitete Quelle: Senecas 13. Brief an Lucilius

- [[sources/schneider-metastudie-2024]]
  `page:source` `2 claims` `active` `2026-05-02` `#psychologie #metastudie`
  — Metastudie zur Wirksamkeit der praemeditatio malorum (n=1.200)

## Entities

- [[entities/seneca]]
  `page:entity` `2 claims` `conf:0.9` `active` `2026-05-01` `#philosophie #stoizismus #antike`
  — Römischer Philosoph, Stoiker, Autor der Briefe an Lucilius

- [[entities/maria-schneider]]
  `page:entity` `2 claims` `conf:0.8` `active` `2026-05-02` `#psychologie #forschung`
  — Forscherin an der Uni Tübingen, Autorin der 2024er Metastudie

## Concepts

- [[concepts/praemeditatio-malorum]]
  `page:concept` `2 claims` `❓` `conf:0.7` `active` `2026-05-02` `#stoizismus #psychologie`
  — Stoische Übung: bewusste Vorstellung des Schlimmsten zur Angstbewältigung

- [[concepts/stoizismus]]
  `page:concept` `1 claim` `conf:0.8` `active` `2026-05-01` `#philosophie`
  — Philosophische Schule der Stoa, Fokus auf das Kontrollierbare
```

**Wie die Index-Felder genutzt werden:**

- **`page:xxx`** → Page-Typ. Das LLM nutzt es zum Scoping (beim Update nur Entities durchsuchen, nicht alle Kategorien). Der Mensch erkennt auf einen Blick, ob ein Eintrag Person, Idee oder Analyse ist.
- **`X claims`** → Umfang. Hohe Claim-Zahlen signalisieren dem LLM: diese Seite ist dicht, beim Ingest lohnt ein Reload. Der Mensch sieht, welche Seiten viel Substanz haben.
- **`❓`** → `hasOpenQuestions`. Fehlt das Flag, gibt es keine offenen Punkte. Das Dashboard `report.open-questions` wird per Grep über den Index gebaut — kein LLM-Aufruf nötig.
- **`conf:0.X`** → Durchschnitts-Confidence aller Claims der Seite (aus dem YAML-Frontmatter). Das LLM nutzt es zur Gewichtung bei Syntheses (niedrige Confidence → vorsichtig zitieren, Disclaimer setzen). Der Mensch sieht sofort: „diese Seite hat harte Belege" oder „hier ist viel Spekulation".
- **`active` / `review` / `archived`** → Lebenszyklus. Archivierte Seiten werden bei neuen Ingests ignoriert, Review-Seiten erhalten einen Lint-nudge.
- **`#tag1 #tag2`** → Tags aus dem YAML-Frontmatter, für thematische Filterung.
- Datumsstempel (`2026-05-01`) → `updatedAt`, kompakt notiert. Das LLM prüft daran: ist diese Seite aktuell? Bei Quellen älter als 6 Monate löst der Lint einen Refresh-Vorschlag aus.

**Wie das LLM den Index nutzt — Ablauf im Update-Schritt:**
Der Index-Lookup arbeitet in **zwei Phasen, die immer beide durchlaufen werden**. Der Grund: Ein Slug-Match garantiert nicht, dass es das *richtige* Konzept ist (z.B. könnte ein neuer Seneca erwähnt werden, der nicht der Philosoph ist). Umgekehrt könnte ein Semantic-Match einen Treffer übersehen, den der exakte Slug sofort gefunden hätte. Nur durch das Zusammenspiel beider Phasen wird der Lookup robust.

1. **Phase 1 — Exakter Slug-Match** (Python-Script, String-Vergleich): Der extrahierte Name wird gegen alle Slugs im Index geprüft. Liefert einen Kandidaten oder „keiner".

2. **Phase 2 — Semantischer Summary-Match** (LLM-basiert): Parallel dazu bekommt das LLM alle Summaries der passenden Kategorie und sucht die semantisch ähnlichste Seite. Liefert ebenfalls einen Kandidaten oder „keiner".

**Ergebnis-Reconciliation nach beiden Phasen:**

- **Beide liefern denselben Treffer** → sicherer Match, Seite laden
- **Nur Phase 1 trifft** → Slug-Match gewinnt (der Name passt exakt, auch wenn die Summary abweicht)
- **Nur Phase 2 trifft** → Semantic-Match gewinnt (der Name ist neu, aber das Konzept existiert unter anderem Namen)
- **Keine trifft** → neue Seite anlegen (siehe unten: „Wie eine neue Seite angelegt wird")

**Wie eine neue Seite angelegt wird:**

Trifft keine der beiden Phasen, erzeugt das LLM eine neue Seite aus einem Template. Der Ablauf:

1. **Slug generieren:** Aus dem extrahierten Namen wird ein Slug gebildet (`slugify("Dr. Maria Schneider")` → `maria-schneider`). Der Page-Typ bestimmt das ID-Präfix und den Zielordner.
2. **Template laden:** Pro Page-Typ existiert ein Template in `wiki-schema.md`. Es definiert die erforderlichen Kapitel, das YAML-Frontmatter und die minimale Struktur.
3. **Seite schreiben:** Das LLM füllt das Template mit den extrahierten Daten. Die neue Seite erhält `status: review` (nicht `active`) — der Mensch muss sie einmalig abnehmen.
4. **Index-Nachtrag:** Die neue Seite wird sofort in den Index eingetragen (der Compile läuft ja direkt nach dem Update-Schritt).

**Beispiel Phase 1:**

```
Extrahiert: "Seneca"            → Slug "seneca" im Index? ✓   → TREFFER (entity.seneca)
Extrahiert: "praemeditatio"     → Slug "praemeditatio-malorum"? ✓ → TREFFER
Extrahiert: "Dr. Maria Schneider" → Slug "maria-schneider"?   — noch kein Eintrag
                                   → KEIN Slug-Treffer → weiter zu Phase 2
```

**Beispiel Phase 2:**

```
Phase-2-Eingabe: "Dr. Maria Schneider, Forscherin an der Uni Tübingen"
Index-Ausschnitt (Entity-Summaries):
  • entity.seneca: "Römischer Philosoph, Stoiker, Autor der Briefe an Lucilius"
  • entity.marc-aurel: "Römischer Kaiser und stoischer Philosoph, Autor der Selbstbetrachtungen"
LLM: "keiner" → Neuer Eintrag: entity.maria-schneider anlegen

Phase-2-Eingabe: "Cortisol-Senkung"
Index-Ausschnitt (Concept-Summaries):
  • concept.praemeditatio-malorum: "Stoische Übung zur Angstbewältigung"
  • concept.cortisol-senkung-durch-meditation: "Messbare Senkung des..."
LLM: "concept.cortisol-senkung-durch-meditation" → TREFFER
→ Seite laden und prüfen, ob es dasselbe Concept ist oder ergänzt werden muss
```

**Warum der Index so effizient ist:**

- **Eine Datei, ein Read.** Kein Directory-Scan, kein Glob-Pattern, kein "probier mal alle Dateien durch".
- **Summaries als Mini-Embeddings.** Die One-Liner erlauben dem LLM einen semantischen Vergleich, ohne echte Embeddings berechnen zu müssen.
- **Metadaten-Flags vermeiden unnötige Page-Loads.** Das `❓`-Flag zeigt sofort: offene Fragen — relevant fürs Dashboard, aber kein Grund, die Seite beim Ingest zu laden.
- **Claim-IDs ermöglichen präzise Referenzierung.** Dashboards und Cross-References können direkt auf einzelne Claims verweisen (`entity.seneca#claim-cortisol-senkung`), statt sich auf vage Textähnlichkeit zu verlassen.
- **Linear skalierend.** 500 Seiten = ~25 KB Index — passt locker in ein einzelnes LLM-Read.

Optional kann für Vaults >500 Seiten ein Embedding-Index (via `sentence-transformers` oder `ollama`) dazugeschaltet werden. Der kuratierte Index bleibt aber der primäre Navigationsmechanismus.

### 4.10 log.md — Die Chronik

**Aufbau eines Log-Eintrags:**

- **Überschrift:** `## YYYY-MM-DD • aktion | Kurztitel` — maschinenlesbar und grep-freundlich. Kein `[ ]` ums Datum (das wäre ein Wikilink).
- **Quelle:** Nur bei `ingest`, als Wikilink: `[[pfad/zur/quelle]]`
- **Aktion:** Was wurde erstellt, geändert, gelöscht. Zahlen zu Entities/Concepts/Claims/Relationships
- **Kontext:** Bei `lint` oder `compile`: Warum wurde der Schritt ausgelöst, was war das Ergebnis

**Struktur und Beispiel:**

```markdown
# Wiki Log

## 2026-05-02 • ingest | Praktische Stoizismus-Anwendung
Quelle: [[inbox/stoizismus-engineering]]
Aktion: 1 neue Source, 2 Entities angelegt (maria-schneider, uni-tuebingen),
  3 Concepts (praemeditatio-malorum, cortison-senkung, antizipiertes-leiden),
  6 Claims, 4 Relationships. 5 bestehende Seiten aktualisiert.

## 2026-05-01 • ingest | Briefe an Lucilius (Brief 13)
Quelle: [[inbox/briefe-an-lucilius-13]]
Aktion: 1 neue Source, Entity seneca erweitert, Concept praemeditatio-malorum
  angelegt. 2 Claims, 1 Relationship.

## 2026-04-30 • lint | Confidence-Review
3 Claims mit confidence < 0.5 gefunden → alle in [[concepts/dichotomie-der-kontrolle]].
  Mensch hat review-Flag gesetzt, LLM soll bei nächster passender Quelle neu bewerten.

## 2026-04-28 • compile | Auto-Compile nach 3 Ingests
Index regeneriert (12 → 15 Seiten). Backlinks aktualisiert.
  Dashboard [[reports/contradictions]]: 0 Widersprüche.
```

Das Log wird append-only geführt — neue Einträge kommen oben drauf (reverse-chronologisch). Beim Start einer Session liest das LLM die ersten 15-20 Zeilen des Logs und weiß sofort, was seit dem letzten Mal passiert ist. Kein Dateisystem-Timestamp-Vergleich nötig.

---

## 5. Die Operationen

### 5.1 Ingest — Überblick

Der Kern-Workflow. Eine Quelle wird nicht nur indiziert, sondern **aktiv ins Wiki integriert**. Das ist der entscheidende Unterschied zu RAG: Nicht Chunks ablegen und später suchen, sondern das Wissen sofort in die bestehende Struktur einweben.

**Die sieben Schritte des Ingest:**

1. LLM liest die Raw Source vollständig (nicht chunk-weise)
2. Diskutiert Key Takeaways mit dem Menschen (optional, aber empfohlen)
3. Schreibt eine Source-Page in `sources/` — die verarbeitete Wissensgrundlage
4. **Extrahiert** Entities, Concepts, Claims, Relationships **ausschließlich aus der Source** (siehe [5.1.4](#514-schritt-4--extraktion))
5. **Updated alle betroffenen Wiki-Seiten** (siehe [5.1.5](#515-schritt-5--update)) — eine einzige Quelle kann 10-15 Seiten berühren
6. Löst den **Compile**-Schritt aus: index.md, Backlinks, Dashboards (siehe [5.4](#54-compile))
7. Schreibt einen Eintrag in `log.md`

### 5.1.1 Schritt 1 — Raw Source vollständig lesen

Der erste Schritt ist der einfachste, aber entscheidend: Das LLM bekommt den gesamten Quelltext auf einmal, nicht chunk-weise. Das ist der fundamentale Unterschied zu RAG — das LLM versteht den vollen Kontext, erkennt implizite Zusammenhänge und kann Querbezüge innerhalb der Quelle herstellen, die chunk-basierte Systeme übersehen.

Neue Quellen landen in `inbox/`. Nach der Verarbeitung (Schritt 3) wird die Raw Source nach `raw-sources/` verschoben — das ist das Archiv. `raw-sources/` wird vom LLM nicht weiter verarbeitet; es dient ausschließlich als Referenz für den Menschen. Die Sources in `sources/` verweisen per Wikilink (`*Originaldatei:*`) auf die zugehörige Raw Source in `raw-sources/`. Das LLM liest die Raw Source einmalig beim Ingest direkt vom Dateisystem — kein Chunking, kein Embedding. Dieser Lesevorgang ist einmalig: Nach der Erstellung der Source in Schritt 3 wird die Raw Source vom LLM nicht mehr verwendet.

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

### 5.1.2 Schritt 2 — Key Takeaways & Main Points diskutieren (optional)

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

### 5.1.3 Schritt 3 — Source-Page schreiben

Die Source-Page in `sources/` ist die **verarbeitete Wissensgrundlage** des Wikis. Sie entsteht aus der Raw Source (gelesen in Schritt 1), angereichert durch das menschliche Feedback aus der Diskussion (Schritt 2). Anders als die Raw Source, die Rohmaterial ist, ist die Source bereits kuratiertes Wissen.

**Main Points vs. Key Takeaways — was ist der Unterschied?**

- **Main Points** sind die zentralen Aussagen *des Autors* — neutral, deskriptiv, objektiv. Sie beantworten: „Was sagt die Quelle?" Beispiel: *„Seneca beschreibt die praemeditatio malorum als Übung gegen Angst."*

- **Key Takeaways** sind die Aussagen, die *für das Wiki relevant* sind. Sie werden aus der Raw Source extrahiert — das LLM identifiziert, was daran für den Menschen von Interesse sein könnte (neue Erkenntnisse, Bestätigungen, Widersprüche zu bestehendem Wissen, actionable Informationen). Die Diskussion in Schritt 2 beeinflusst die Auswahl maßgeblich: Das menschliche Feedback bestimmt, welche Aspekte betont, umgewichtet oder verworfen werden. Fehlt die Diskussion, erzeugt das LLM die Key Takeaways eigenständig — es antizipiert, was ein Mensch sinnvoll daraus mitnehmen kann. Ein optionaler SOUL.md-Filter kann dabei helfen, die Relevanzbewertung auf die Person zuzuschneiden. Beispiel: *„Senecas Konzept wird 2024 empirisch bestätigt — relevant für den Stoizismus-Claim."*

**Wichtig:** Weder Main Points noch Key Takeaways ändern sich nach der Source-Erstellung. Beide sind aus der Raw Source extrahiert und ausschließlich daraus entnommen. Sie sind Teil der Source-Page, die — mit Ausnahme der `## Verlinkte Wiki-Seiten`-Liste — nach Schritt 3 stabil bleibt und nie vom LLM überschrieben wird.

Die Source verlinkt auf die Raw Source in `raw-sources/` — aber ausschließlich für den Menschen, der das Original einsehen möchte. Für das LLM ist die Source ab diesem Punkt der alleinige Arbeitsgegenstand. Die Raw Source wird nach Schritt 3 nicht mehr gelesen. Alle weiteren Verarbeitungen (Extraktion in Schritt 4, Updates in Schritt 5) basieren ausschließlich auf der Source.

Das trennt sauber: Rohmaterial wird einmalig eingelesen und durch den menschlich geprüften „Source-Filter" geschickt. Was danach im Wiki passiert, baut auf dieser kuratierten Grundlage auf.

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

Die Source-Page wird nach dem ersten Ingest nie wieder vom LLM verändert — mit einer Ausnahme: Die Liste der verlinkten Wiki-Seiten wird beim Compile automatisch aktualisiert. Sie enthält alle Entities, Concepts und Syntheses, die mindestens einen Claim aus dieser Source referenzieren. Das ermöglicht eine Rückwärtssuche: „Welches Wissen im Wiki stammt aus dieser Source?" — beantwortbar durch einen Klick auf die Wikilinks.

Die Zahl in Klammern ist ein Bonus für den Menschen — sie zeigt, wie stark die Source in der jeweiligen Seite verankert ist. Viele Claims → die Source ist zentral für diese Seite.

### 5.1.4 Schritt 4 — Extraktion

Schritt 4 ist das Herzstück des Ingest — hier wird aus der kuratierten Source maschinenlesbares Wissen.

**Wichtiger Kontextwechsel:** Ab diesem Schritt arbeitet das LLM **ausschließlich mit der Source** aus Schritt 3. Der Rohtext aus Schritt 1 wird nicht mehr verwendet — der LLM-Kontext wird bereinigt. Nur was in der Source steht, existiert für die Extraktion. Die Source ist die verarbeitete, menschlich geprüfte Wissensgrundlage — sie ist der alleinige Input für alle folgenden Schritte (Extraktion, Update).

Das LLM parst nicht erneut den Rohtext, sondern arbeitet gezielt mit dem kuratierten Material: Key Takeaways sind priorisiert, Main Points sind dokumentiert, Unklarheiten sind markiert.

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

**Konkretes Beispiel — Eingabe (Source aus Schritt 3):**
```
Source: "Praktische Stoizismus-Anwendung im Engineering-Alltag"

## Zusammenfassung
Der Artikel beschreibt, wie stoische Prinzipien im modernen
Engineering-Alltag angewendet werden können. Besonderer Fokus
liegt auf Senecas praemeditatio malorum und ihrer empirischen
Bestätigung durch moderne Forschung.

## Key Takeaways
- Seneca beschreibt im 13. Brief an Lucilius die praemeditatio
  malorum — die bewusste Vorstellung des Schlimmsten als Übung
  gegen Angst.
- Dr. Maria Schneider (Uni Tübingen) zeigte 2024 in einer
  Metastudie (n=1.200), dass tägliche praemeditatio-Übungen
  den Cortisol-Spiegel um 18% senken (Nature Human Behaviour).
- Keine Wirkung bei Teilnehmern unter 25 Jahren.
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

Die Extraktion liefert Rohmaterial mit abgestufter Confidence: 0.85 für den peer-reviewed Claim, 0.3 für Senecas philosophische Behauptung. Claims erhalten direkt bei der Extraktion eine ID. Dieses Material geht direkt in den Update-Schritt.

### 5.1.5 Schritt 5 — Update

Schritt 5 ist die eigentliche Wiki-Arbeit — hier entscheidet das LLM für jedes extrahierte Wissenselement, *wo* es hineingehört und *wie* es integriert wird. Das ist kein simples Append, sondern ein Merge mit Konfliktauflösung.

**Der Ablauf — Index-First mit Zwei-Phasen-Lookup:**

Der Update-Schritt beginnt nicht mit einem Dateisystem-Scan, sondern mit einem **Index-Lookup in zwei Phasen**: Erst exakter Slug-Match (String-Vergleich, kein LLM-Aufruf nötig), dann Semantic-Summary-Match (LLM liest alle Summaries einer Kategorie und findet semantisch ähnliche). Der `index.md` (siehe [4.9](#49-indexmd--der-content-katalog)) wird einmal gelesen und dient als Suchraum für beide Phasen.

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

**Warum zwei Phasen?** Ein reiner Slug-Match würde "Dr. Maria Schneider" nie finden (der Slug existiert noch nicht). Ein reiner Semantic-Match würde für "Seneca" unnötig einen LLM-Call verbrauchen, obwohl der Slug-Match trivial ist. Die Kombination ist schnell für Exact-Matches und trotzdem mächtig für nicht-triviale Zuordnungen.

**Die Entscheidungslogik (nach der Zwei-Phasen-Suche):**

```
Für jede extrahierte Entity:
  ├─ Phase 1: Exakter Slug-Match?
  │   ├─ JA → SEITE LADEN → UPDATE
  │   └─ NEIN → Phase 2: Semantic Summary-Match (LLM)?
  │       ├─ JA → SEITE LADEN → UPDATE (evtl. Merge zweier ähnlicher Seiten)
  │       └─ NEIN → CREATE: Neue Seite aus Entity-Template
  │
Für jedes extrahierte Concept:
  ├─ Phase 1: Exakter Slug-Match?
  │   ├─ JA → SEITE LADEN → UPDATE
  │   └─ NEIN → Phase 2: Semantic Summary-Match (LLM)?
  │       ├─ JA → SEITE LADEN → prüfen ob Merge oder separates Concept
  │       └─ NEIN → CREATE: Neue Seite aus Concept-Template
  │
Für jeden extrahierten Claim (nach dem Laden der Zielseite):
  ├─ Gibt es einen inhaltlich ähnlichen Claim auf der Seite?
  │   ├─ JA und neuer Claim hat HÖHERE Confidence
  │   │   └─ SUPERSEDE: Alten Claim superseden, neuen aktivieren
  │   ├─ JA und neuer Claim hat NIEDRIGERE/GLEICHE Confidence
  │   │   └─ APPEND: Als zusätzliche Perspektive anfügen
  │   ├─ JA und Claims WIDERSPRECHEN sich
  │   │   └─ CONFLICT: Beide als contested markieren, Widerspruchs-Cluster anlegen
  │   └─ NEIN → CREATE: Neuen Claim mit Evidence und neuer Claim-ID anlegen
  │
Für jede extrahierte Relationship:
  ├─ Existiert diese Connection bereits in der geladenen Seite?
  │   ├─ JA → SKIP (Duplikat)
  │   └─ NEIN → CREATE: In BEIDE betroffenen Seiten eintragen (Gegenseite auch updaten)
  │
Für jede Open Question:
  └─ In die geladenen betroffenen Seiten als ## Offene Fragen eintragen
```

**Der Update-Prompt (den das LLM pro betroffener Seite bekommt):**

**Wichtig:** Dieser Prompt wird **pro betroffener Seite einzeln** ausgeführt. Wenn eine Quelle 5 bestehende Seiten berührt, wird der Prompt 5-mal gesendet — jedes Mal mit dem aktuellen Inhalt genau einer Seite und nur den für diese Seite relevanten Extraktionsdaten. Das stellt sicher, dass jede Seite isoliert und konsistent aktualisiert wird, ohne dass das LLM den Überblick verliert.

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

**Konkretes Beispiel — Vorher/Nachher an der `entity.seneca`-Seite:**

Vor dem Ingest existiert diese Seite:

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

Nach dem Ingest der Schneider-Studie:

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

1. **Prosa-Merge:** Der Abschnitt "Lehre" wurde um zwei neue Absätze ergänzt — praemeditatio-Definition, empirischer Beleg, Einschränkung. Der Text liest sich aus einem Guss, nicht wie ein Patch.
2. **Strukturierter Claim:** Senecas Angst-These mit `id:claim-seneca-angst-these`, `confidence: 0.3` und `status: uncertain` — explizit als philosophische, nicht empirische Behauptung markiert. Der Beleg ist ein Wikilink auf [[sources/briefe-an-lucilius]].
3. **Neue Relationships:** Seneca → praemeditatio malorum (`definierte`) und Seneca → Maria Schneider (`wurde_empirisch_bestätigt_durch`). Die Gegenseite wird beim Update der jeweils anderen Seite automatisch ergänzt.
4. **Human Block unangetastet:** Die persönliche Notiz über Marc Aurel blieb exakt erhalten.

**Weitere betroffene Seiten (analog):**

- `entity.maria-schneider` — neu angelegt mit Forschungsprofil
- `concept.praemeditatio-malorum` — ergänzt um empirische Evidenz und Alters-Einschränkung
- `concept.cortisol-senkung-durch-meditation` — neu angelegt
- `entity.uni-tuebingen` — neu angelegt oder ergänzt

Insgesamt wurden aus einer Quelle **8-10 Seiten** berührt — genau Karpathys "a single source might touch 10-15 wiki pages".

### 5.2 Query

Fragen gegen das Wiki stellen. Anders als bei RAG wird nicht gegen Roh-Chunks gesucht, sondern gegen das kompilierte Wissen. Der Query-Workflow läuft in vier Phasen:

**Phase 1 — Index-Scan (L1):** Das LLM liest `index.md` und identifiziert relevante Seiten anhand der One-Liner-Summaries und Tags. Kein Volltext-Scan — der Index liefert in einem Read den Überblick über den gesamten Vault.

**Phase 2 — Progressive Deep-Dive:** Relevante Seiten werden nach Bedarf eskaliert: erst L1 (One-Liner), dann L2 (TL;DR = erster Absatz), dann L3 (Full Page) nur bei hoher Relevanz. Das spart Tokens: Bei breiten Fragen werden viele Seiten auf L1/L2 gescannt, nur die Top-Treffer auf L3 geladen.

**Phase 3 — Synthese:** Das LLM synthetisiert eine Antwort aus den geladenen Seiten. Jede Behauptung wird mit zitierfähigen Quellen belegt — nicht Roh-Chunks, sondern Source-Pages mit Kontext. Die Confidence der referenzierten Claims fließt in die Antwort ein: Low-Confidence-Aussagen werden explizit als unsicher markiert.

**Phase 4 — Query Filing:** Substanzielle Antworten werden als Kandidaten für neue Wiki-Seiten vorgeschlagen. Kriterien: ≥3 Quellen verknüpft? Neuer Zusammenhang entdeckt? Widerspruch aufgelöst? Der Mensch bestätigt oder verwirft — das LLM macht den Rest.

#### Beispiel: Eine Query von Anfang bis Ende

**Eingabe (Mensch):** *„Was sagt die aktuelle Forschung zur Wirksamkeit stoischer Praktiken — und wie schneiden sie im Vergleich zur KVT ab?"*

**Schritt 1 — Index-Scan:** Das LLM liest `index.md` und scannt Summaries und Tags nach `#stoizismus`, `#psychologie`, `#empirisch`, `#kvt`:

```
Index-Scan (L1, gefiltert nach Tags #stoizismus OR #psychologie):
  ✓ concept.praemeditatio-malorum — "Stoische Übung zur Angstbewältigung" (2 claims, conf:0.7)
  ✓ concept.stoizismus — "Philosophische Schule der Stoa" (1 claim, conf:0.8)
  ✓ synthesis.stoizismus-und-empirie — "Was die Forschung sagt" (2 claims, conf:0.75)
  ✓ concept.kognitive-verhaltenstherapie — "Therapieform mit stoischen Wurzeln" (3 claims, conf:0.9)
  → 4 Kandidaten, 2 davon hochrelevant (praemeditatio, stoizismus-und-empirie)
```

**Schritt 2 — Progressive Deep-Dive:** Die Top-Kandidaten werden stufenweise geladen:

```
L2-Scan (TL;DR = erster Absatz):
  concept.praemeditatio-malorum:
    "Die praemeditatio malorum ist eine stoische Übung zur Angstbewältigung.
     2024 empirisch bestätigt: Cortisol-Senkung um 18% (n=1.200)."
    → HOCH relevant → auf L3 eskalieren

  synthesis.stoizismus-und-empirie:
    "Die moderne Psychologie hat mehrere stoische Praktiken empirisch
     untersucht. Ergebnisse gemischt: praemeditatio belegt, Affektlehre nicht."
    → HOCH relevant → auf L3 eskalieren

  concept.kognitive-verhaltenstherapie:
    "KVT ist eine evidenzbasierte Therapieform. Effektstärke d=0.8 bei
     Angststörungen. Greift zentrale stoische Konzepte auf."
    → relevant → auf L3 eskalieren

  concept.stoizismus:
    "Die Stoa ist eine philosophische Schule der Antike..."
    → Basiswissen, L2 reicht
```

**Schritt 3 — Synthese (LLM-Antwort):**

```markdown
## Stoische Praktiken und KVT — Forschungsstand

### Was empirisch belegt ist

Die **praemeditatio malorum** ist die am besten belegte stoische Technik:
- Cortisol-Senkung um 18% in einer Metastudie mit n=1.200 (Schneider 2024,
  Nature Human Behaviour) — [[sources/schneider-metastudie-2024]]
  `claim-cortisol-signifikant` (conf: 0.85)
- Einschränkung: Keine Wirkung bei Teilnehmern unter 25 Jahren

### Vergleich mit KVT

Es gibt **keinen direkten Head-to-Head-Vergleich** zwischen stoischen
Praktiken und KVT. Die vorhandenen Daten erlauben nur indirekte
Vergleiche:
- KVT bei Angststörungen: d=0.8 ([[sources/kvt-leitlinien-2023]])
- Praemeditatio: Cortisol-Reduktion 18%, aber keine klinischen
  Endpunkt-Studien ([[sources/schneider-metastudie-2024]])
- `claim-stoa-kvt-vergleichbar` (conf: 0.5, uncertain) — diese Behauptung
  ist spekulativ, es fehlen direkte Vergleichsstudien

### Was NICHT belegt ist

- Stoische Affektlehre: keine operationalisierbaren Studien
- Dichotomie der Kontrolle: keine kontrollierten Studien

### Fazit

Die Datenlage ist dünn. Nur eine stoische Technik (praemeditatio) ist
robust belegt. Der Vergleich zur KVT hinkt — die KVT hat Jahrzehnte
klinischer Forschung, die Stoa hat eine Metastudie.

⚠️ Diese Antwort basiert auf 3 Wiki-Seiten und 2 Sources.
   Confidence der stärksten Aussage: 0.85.
   Confidence der schwächsten Aussage: 0.5 (spekulativ).
```

**Schritt 4 — Query Filing (Vorschlag an den Menschen):**

> *Diese Query hat 3 Quellen verknüpft und einen neuen Zusammenhang
> hergestellt (Stoa vs. KVT-Evidenzlage). Soll ich eine Synthesis-Seite
> `synthesis.stoa-vs-kvt-evidenz` daraus machen?*

Der Mensch kann bestätigen (→ neue Seite wird erstellt), verwerfen oder modifizieren („Nur den Vergleichsteil, ohne KVT-Detail"). Bestätigte Query-Filings werden als normale Wiki-Seiten angelegt und gehen in den nächsten Compile ein.

**Progressive Summarization — die vier Verdichtungsebenen im Überblick:**

| Level | Name         | Quelle                     | Nutzung                         |
| ----- | ------------ | -------------------------- | ------------------------------- |
| L1    | One-Liner    | Erster Satz nach `# Titel` | Index-Scan, erstes Scoping      |
| L2    | TL;DR        | Erster Absatz der Seite    | Schnelles inhaltliches Erfassen |
| L3    | Full Page    | Komplette Seite            | Tiefe Analyse, Synthese         |
| L4    | Source Links | Claims mit `*Beleg:*`      | Herkunftsprüfung, Nachlesen     |

### 5.3 Lint

Periodischer Health-Check des Wikis — als First-Class-Operation von Anfang an. Lint läuft nach jedem Compile (automatisch) und kann vom Menschen jederzeit manuell angestoßen werden (`lint`). Der Output ist nicht nur eine Fehlerliste, sondern generiert eine **Forschungsagenda** — Lint sagt nicht nur *was* falsch ist, sondern *was als nächstes zu tun ist*.

**Die vier Check-Kategorien mit Severity:**

| Kategorie    | Severity  | Checks                                                                                                                                                                       |
| ------------ | --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Struktur** | `error`   | Doppelte Page-IDs, fehlendes YAML-Frontmatter, Page-Type-Directory-Mismatch, Broken Wikilinks, Orphan Pages (keine Backlinks), doppelte Claim-IDs innerhalb einer Seite      |
| **Herkunft** | `error`   | Claims ohne Evidence (`*Beleg:*`-Feld fehlt), Evidence ohne gültigen Wikilink                                                                                                |
| **Qualität** | `warning` | Low-Confidence Claims (< 0.5), Stale Pages (>90 Tage ohne Update), Offene Questions ohne Fortschritt seit >30 Tagen, Widersprüche zwischen Claims (contested seit >14 Tagen) |
| **Wachstum** | `info`    | Konzepte ohne eigene Seite (in >2 Sources erwähnt), unterrepräsentierte Themenbereiche (<3 Seiten), veraltete Index-Einträge, ungenutzte Tags                                |

#### Beispiel: Ein Lint-Lauf

**Eingabe:** `lint` (nach einem Ingest, der 3 neue Claims und 1 neue Entity erzeugt hat)

**Ausgabe:**

```
🔍 Wiki Lint — 2026-05-06T10:45:00Z
   Vault: 15 Seiten, 4 Sources, 9 Claims

━━━ Struktur (errors) ━━━
❌ ERROR [E001] Duplicate page-id
   entities/seneca.md ↔ entities/seneca-briefe.md
   Beide haben id: entity.seneca
   → Fix: id in einer der beiden Seiten ändern

❌ ERROR [E003] Broken wikilink
   concepts/praemeditatio-malorum.md → [[entities/maria-schneider]]
   Ziel existiert nicht (Tippfehler? `maria-schneider` vs `maria-schneiderr`)
   → Fix: Link korrigieren oder Zielseite anlegen

━━━ Herkunft (errors) ━━━
❌ ERROR [E010] Claim ohne Evidence
   entities/neurologie.md → claim-dopamin-ausschuettung
   Kein *Beleg:* Feld vorhanden
   → Fix: Beleg aus Source ergänzen oder Claim löschen

━━━ Qualität (warnings) ━━━
⚠️  WARNING [W020] Low confidence claim (< 0.5)
   entity.seneca → claim-seneca-angst-these (conf: 0.3)
   Status: uncertain | Alter: 5 Tage
   → Aktion: Neue empirische Quelle zu diesem Claim ingestieren?

⚠️  WARNING [W022] Contested claims ungelöst (> 14 Tage)
   entity.seneca#claim-cortisol-senkung ↔ concept.kvt#claim-cortisol-kein-effekt
   Widerspruch seit 16 Tagen ungelöst
   → Aktion: Neue Quelle zur Auflösung recherchieren oder menschliche
     Entscheidung anfordern

━━━ Wachstum (info) ━━━
ℹ️  INFO [I030] Konzept ohne eigene Seite
   "Dichotomie der Kontrolle" — erwähnt in 3 Sources, keine Concept-Seite
   → Aktion: Ingest einer Quelle zu diesem Konzept oder manuelles CREATE

ℹ️  INFO [I032] Themen-Bias
   #philosophie: 12 Seiten | #embedded: 2 Seiten | #python: 1 Seite
   → Hinweis: Embedded- und Python-Bereich sind unterrepräsentiert

━━━ Zusammenfassung ━━━
   3 errors (müssen behoben werden)
   2 warnings (sollten zeitnah adressiert werden)
   2 info (Forschungsagenda, keine Eile)

   Nächster Schritt: errors beheben, dann compile erneut ausführen.
   Forschungsagenda: 4 neue Aktionen identifiziert.
```

**Forschungsagenda — was Lint über Fehler hinaus liefert:**

Lint ist nicht nur ein Validator, sondern ein Ideengenerator. Aus den `info`- und `warning`-Meldungen entsteht eine priorisierte To-Do-Liste:

1. 🔴 **Konzept "Dichotomie der Kontrolle"** wird in 3 Quellen erwähnt, hat aber keine eigene Seite — Ingest einer Primärquelle empfohlen
2. 🟡 **Contested Claims** (Cortisol-Senkung vs. kein Effekt) seit 16 Tagen ungelöst — Auflösung durch neue Quelle oder menschliche Entscheidung nötig
3. 🟡 **Themen-Bias** — Embedded- und Python-Bereich haben zusammen nur 3 Seiten vs. 12 für Philosophie. Bewusste Entscheidung oder Quellen-Lücke?
4. 🟢 **Low-Confidence-Claim** zu Senecas Angst-These — Gelegenheit, bei nächstem Stoa-Ingest eine empirische Quelle mitzulesen

Der Mensch kann einzelne Agenda-Punkte akzeptieren (→ Task wird getrackt), ablehnen (→ wird beim nächsten Lint nicht erneut vorgeschlagen) oder aufschieben.

### 5.4 Compile

Nach jedem Ingest läuft der Compile-Step. Er liest den gesamten Vault und aktualisiert die Querschnittsstrukturen. Im Gegensatz zum Ingest (der gezielt einzelne Seiten modifiziert) arbeitet Compile auf dem ganzen Vault — er ist der Schritt, der aus vielen Einzelseiten ein kohärentes Wiki macht.

**Die fünf Compile-Phasen:**

```
1. ALLE SEITEN PARSEN
   Jede .md-Datei in sources/, entities/, concepts/, syntheses/
   einlesen → YAML-Frontmatter + Markdown-Kapitel parsen → WikiPage-Modell befüllen
   ↓
2. INDEX GENERIEREN
   Aus allen WikiPage-Instanzen einen kategorisierten Katalog bauen
   ↓
3. BACKLINKS SCHREIBEN
   Für jede Seite: ## Related Block mit Sources, Inbound-Links,
   Shared-Source-Nachbarn generieren → in die Seite einfügen
   ↓
4. DASHBOARDS GENERIEREN
   Querschnittsanalysen über alle Seiten: Open Questions,
   Contradictions, Low Confidence, Claim Health, Stale Pages,
   Person Directory, Relationship Graph, Herkunftsabdeckung
   ↓
5. DIGESTS SCHREIBEN
   agent-digest.json + claims.jsonl für Maschinenkonsum
```

#### Index-Generierung im Detail

Die Index-Generierung ist Phase 2 des Compile — und das Herzstück der strukturellen Integrität. Hier wird aus lose verstreuten Markdown-Dateien ein navigierbarer Katalog.

**Ablauf — Schritt für Schritt:**

1. **Seiten einlesen und gruppieren:**
   - Alle Wiki-Seiten aus dem Vault laden (jede `.md`-Datei in `sources/`, `entities/`, `concepts/`, `syntheses/`, `reports/`)
   - Nach Page-Typ gruppieren: Sources, Entities, Concepts, Syntheses, Reports

2. **Statistiken aggregieren:**
   - Gesamtzahl Seiten, Anzahl Sources, Anzahl Claims summieren
   - Pro Seite: Claim-Count, Open-Questions-Flag, Confidence aus YAML-Frontmatter extrahieren

3. **Pro Seite eine Index-Zeile generieren:**
   - Format: `- [[pfad/zur/seite]]` als Wikilink
   - Metadaten in Backticks: `page:typ` `X claims` `❓` `conf:0.X` `status` `#tags`
   - Summary als L1-One-Liner (erster Satz nach `# Titel`)

4. **Claim-IDs registrieren:**
   - Alle `id:claim-xxx` aus dem `## Claims`-Kapitel jeder Seite extrahieren
   - Für direkte Referenzierung aus Dashboards und Cross-References speichern

5. **Nach Kategorie gruppiert ausgeben:**
   - Abschnitte in dieser Reihenfolge: `## Sources` → `## Entities` → `## Concepts` → `## Syntheses` → `## Reports`
   - Leere Kategorien werden nicht ausgegeben
   - Innerhalb jeder Kategorie alphabetisch nach `title` sortieren

**Skizze des Datenflusses:**

```
Eingabe: Alle Wiki-Seiten (.md-Dateien)
         │
         ├── YAML-Frontmatter parsen → id, title, page, tags, confidence, status, updated
         ├── Kapitel parsen
         │   ├── Erster Satz nach # Titel → summary (L1-One-Liner)
         │   ├── ## Claims → claimCount, claimIds
         │   └── ## Offene Fragen → hasOpenQuestions
         │
         ├── Seiten gruppieren nach pageType
         ├── Pro Seite Index-Zeile formatieren
         └── Als kategorisierte index.md ausgeben
```

**Woher die Index-Felder kommen:**

| Index-Feld         | Quelle                                    | Wie extrahiert             |
| ------------------ | ----------------------------------------- | -------------------------- |
| `id`               | YAML-Frontmatter: `id`                    | YAML-Parse                 |
| `slug`             | `id` minus Prefix                         | `entity.seneca` → `seneca` |
| `title`            | YAML-Frontmatter: `title`                 | YAML-Parse                 |
| `pageType`         | YAML-Frontmatter: `page` + Ordner-Prüfung | Mismatch → Lint-Warnung    |
| `summary`          | Erster Satz nach `# Titel`                | L1-One-Liner, max. 1 Satz  |
| `path`             | Dateipfad relativ zum Vault-Root          | Aus Dateisystem            |
| `claimCount`       | Claims im `## Claims`-Kapitel             | Gezählt                    |
| `claimIds`         | `id:claim-xxx` im `## Claims`-Kapitel     | Geparst                    |
| `hasOpenQuestions` | `len(questions) > 0`                      | Boolean                    |
| `confidence`       | YAML-Frontmatter: `confidence`            | YAML-Parse                 |
| `status`           | YAML-Frontmatter: `status`                | Default: `active`          |
| `tags`             | YAML-Frontmatter: `tags`                  | YAML-Parse als Liste       |
| `updatedAt`        | YAML-Frontmatter: `updated`               | Fallback: Dateisystem      |

**Konkretes Beispiel — Eingabe:**

Der Compile liest diese drei Seiten (gekürzt auf die index-relevanten Felder):

```markdown
# entities/seneca.md (YAML-Frontmatter):
---
id: entity.seneca
page: entity
confidence: 0.9
status: active
tags: [philosophie, stoizismus, antike]
updated: 2026-05-02
---
## Claims
- `id:claim-seneca-angst-these` `conf:0.3` Senecas Angst-These...

# entities/maria-schneider.md (YAML-Frontmatter):
---
id: entity.maria-schneider
page: entity
confidence: 0.8
status: active
tags: [psychologie, forschung]
updated: 2026-05-02
---
## Claims
- `id:claim-cortisol-senkung` `conf:0.85` Cortisol-Senkung belegt...
- `id:claim-altersgrenze` `conf:0.8` Altersgrenze identifiziert...

# concepts/praemeditatio-malorum.md (YAML-Frontmatter):
---
id: concept.praemeditatio-malorum
page: concept
confidence: 0.7
status: active
tags: [stoizismus, psychologie]
updated: 2026-05-02
---
## Claims
- `id:claim-cortisol-signifikant` `conf:0.85` praemeditatio senkt Cortisol signifikant...
- `id:claim-altersgrenze` `conf:0.8` Wirkung nur bei >25 Jahren...
## Offene Fragen
- Hält die Wirkung nach Absetzen an?
- Warum wirkt praemeditatio nicht bei unter 25-Jährigen?
```

**Ausgabe — index.md:**

```markdown
# Wiki Index

> Auto-generated at 2026-05-02T10:35:00Z | 3 pages | 2 sources | 6 claims

## Entities

- [[entities/seneca]]
  `page:entity` `1 claim` `active` `#philosophie #stoizismus #antike` — Römischer Philosoph, Stoiker, Autor der Briefe an Lucilius

- [[entities/maria-schneider]]
  `page:entity` `2 claims` `active` `#psychologie #forschung` — Forscherin an der Uni Tübingen, Autorin der 2024er praemeditatio-Metastudie

## Concepts

- [[concepts/praemeditatio-malorum]]
  `page:concept` `2 claims` `❓` `active` `#stoizismus #psychologie` — Stoische Übung: bewusste Vorstellung des Schlimmsten zur Angstbewältigung
```

**Was der Index-Generator dabei macht — Zeile für Zeile:**

1. **Header:** `# Wiki Index` mit Timestamp und Statistiken (aggregiert aus allen eingelesenen Seiten)
2. **Kategorien als ## Überschriften:** Gruppiert nach `pageType` — Sources, Entities, Concepts, Syntheses, Reports
3. **Pro Seite eine Zeile:** `id` als Linktext, `path` in Klammern, Metadaten in Backticks (`page:typ`, `X claims`), optional `❓` wenn `hasOpenQuestions`, dann `status`, dann `#tags`, dann `— summary`
4. **Claim-IDs registrieren:** Jede Claim-ID wird im Index-Modell gespeichert für Dashboard-Referenzen und Cross-Reference-Lookups
5. **Sortierung:** Innerhalb jeder Kategorie alphabetisch nach `title`
6. **Tags aus YAML-Frontmatter:** Tags werden als `#tag1 #tag2` im Index dargestellt
7. **Leere Kategorien:** Werden nicht ausgegeben

**Inkrementeller vs. vollständiger Index:**

Der Compile regeneriert den Index **immer vollständig** — nicht inkrementell. Das ist ein bewusster Trade-off: Ein vollständiger Index-Neubau ist bei <500 Seiten in Millisekunden erledigt (reiner Dateisystem-Scan + YAML/Regex-Parse) und garantiert Konsistenz. Ein inkrementeller Update wäre fehleranfällig (vergessene Löschungen, verschobene Seiten, geänderte Sources). Erst bei >1.000 Seiten würde man auf inkrementellen Index-Bau umschalten.

**Weitere Compile-Phasen (kurz):**

- **Backlink-Blöcke** (`## Related`) in jede Seite einfügen — listet Sources, Backlinks und Shared-Source-Nachbarn
- **Dashboard-Reports** unter `reports/` aktualisieren: Open Questions, Contradictions, Low Confidence, Claim Health, Stale Pages, Person/Agent Directory, Relationship Graph, Herkunftsabdeckung, Privacy Review. Claims werden in Dashboards über ihre `page-id#claim-id`-Referenz identifiziert.
- **Machine-Readable Digests** schreiben: `agent-digest.json` (kompakte Zusammenfassung aller Seiten inkl. Claim-IDs) und `claims.jsonl` (alle Claims mit vollständiger Referenz als JSON-Lines)
- Optional: Embedding-Index aktualisieren

Compile trennt "Daten schreiben" (Ingest) von "Struktur aktualisieren" — sauberer als beides in einem Schritt.

### 5.5 Validate — Herkunftsprüfung

Während der **Lint** die Struktur prüft (Syntax), stellt der **Validate**-Schritt die inhaltliche Integrität sicher. Er bekämpft Halluzinationen, indem er stichprobenartig Claims gegen ihre Sources prüft.

**Die Lösung: Cross-Checking**
Ein zweiter LLM-Lauf (idealerweise mit einem stärkeren Modell wie GPT-4o oder Claude 3.5 Sonnet) erhält nur den extrahierten Claim und den zugehörigen Source-Abschnitt.

**Beispiel-Workflow:**
1. System wählt zufällig 5% aller neuen Claims aus.
2. Prompt: *"Prüfe, ob der Claim 'Cortisol-Senkung um 18%' (ID: claim-cortisol-senkung) durch die folgende Source gedeckt ist: [Source-Snippet]. Antworte mit VALID, PARTIAL oder FAIL."*
3. Bei FAIL: Markierung der Seite mit einem `⚠️ halluzinations-verdacht` Flag im YAML-Frontmatter (als zusätzlicher Tag: `_halluzination-verdacht`) und Blockieren des automatischen Commits.

---

## 6. Design-Prinzipien

### 6.1 Human Blocks — Mensch und Agent in derselben Datei

Jede Wiki-Seite kann Human-Blöcke enthalten — die einzigen HTML-Kommentare im gesamten System. Alles außerhalb dieser Marker ist implizit LLM-verwaltet:

```markdown
[Implizit LLM-verwaltet: Prosa, Claims, Verknüpfungen, Offene Fragen —
 alles außerhalb der Human-Marker darf der Agent lesen und schreiben.]

<!-- llm-wiki:human:start -->
[Meine handschriftlichen Notizen — werden NIE angetastet]
<!-- llm-wiki:human:end -->
```

Das schafft Vertrauen: Der Agent kann Seiten beliebig regenerieren, ohne menschliche Annotationen zu zerstören. Die Marker brauchen keinen Parser — reines Regex/String-Matching. Es gibt keine Managed-Block-Marker; nur Human Blocks werden explizit ausgezeichnet. Alles außerhalb ist implizit LLM-Managed.

### 6.2 Structured Claims statt nur Prosa

Claims sind strukturierte Daten im `## Claims`-Kapitel, nicht nur Fließtext. Jeder Claim hat eine eindeutige ID:

```markdown
## Claims
- `id:claim-stoizismus-stress` `conf:0.7` `status:active`
  Stoizismus reduziert nachweislich Stress
  *Beleg:* [[sources/meta-analyse-2024]] (Zeilen 45-62, n=1.200)
  *Beleg:* [[sources/persoenliche-erfahrung]] (Zeilen 12-18)
```

Damit wird aus "ich glaube X" ein trackbares Belief-System: Claims können über ihre ID direkt referenziert, bewertet, gewichtet, hinterfragt und aktualisiert werden — ohne den umgebenden Prosatext zu zerstören. Die Confidence wird vom LLM initial geschätzt und vom Compile anhand der vier Kalibrierungsfaktoren (Quellentyp, Belegqualität, Anzahl Belege, Aktualität) nachjustiert.

### 6.3 Konflikt-Erkennung beim Ingest

Bevor neue Claims gemerged werden, prüft das System:

- Widerspricht der neue Claim einem bestehenden? → Beide als `contested` markieren, Widerspruchs-Cluster anlegen (Claims per ID referenzieren: `entity.seneca#claim-cortisol-senkung ↔ concept.praemeditatio-malorum#claim-cortisol-signifikant`)
- Überschreibt der neue Claim einen älteren mit höherer Autorität? → Confidence-Gewichtung nach Quellentyp (peer-reviewed > Buch > Blogpost)
- Ist der bestehende Claim veraltet? → `stale`-Flag mit neuem Claim als Update-Kandidat

Die Konflikt-Erkennung arbeitet zweistufig: Erst Embedding-basierter Similarity-Vergleich, dann LLM-Validierung ("Sind die ähnlichen Claims wirklich widersprüchlich?").

### 6.4 Quellen-Nachweis über Claims

Kein Claim ohne Beleg. Das `*Beleg:*`-Feld jedes Claims enthält immer einen Wikilink auf eine Source — das ist der Pflicht-Herkunftsnachweis. Entities, Concepts und Syntheses verlinken ausschließlich auf Sources in `sources/`, nicht auf Raw Sources. Der Herkunftsnachweis ist damit in jedem Claim verankert: Jede Behauptung trägt ihren eigenen Beleg bei sich. Das zwingt zur Nachvollziehbarkeit — und verhindert Halluzination als „Wissen".

### 6.5 Dashboards als Health-Monitoring

Statt nur Ad-Hoc-Lint generiert der Compile-Step automatisch Dashboard-Seiten unter `reports/`:

- **Open Questions** — alle ungelösten Fragen aus allen Seiten
- **Contradictions** — Page-Level und Claim-Level Widersprüche (Claims per `page-id#claim-id` referenziert)
- **Low Confidence** — Seiten und Claims mit confidence < 0.5
- **Claim Health** — Missing Evidence, Contested, Stale Claims (mit Claim-ID-Referenzen)
- **Stale Pages** — Seiten ohne Update trotz neuer Quellen
- **Person/Agent Directory** — Personen mit Routing-Metadaten
- **Relationship Graph** — alle strukturierten Relationships
- **Herkunftsabdeckung** — Evidence-Statistiken pro Source
- **Privacy Review** — Seiten mit sensiblen Inhalten

Diese Dashboards sind selbst Wiki-Seiten — das LLM kann sie lesen, der Mensch kann sie in Obsidian browsen.

---

## 7. Erweiterungen gegenüber dem Original-Pattern

| Aspekt                        | Karpathy (Gist)          | Dieser Entwurf                                                                                            |
| ----------------------------- | ------------------------ | --------------------------------------------------------------------------------------------------------- |
| **Source-Pages**              | Summaries als Provenance | Sources als kuratierte Wissensgrundlage — der einzige Ort, aus dem Extraktion und Updates gespeist werden |
| **Claims**                    | Fließtext                | Strukturiert mit eigener ID, Evidence, Confidence, Status                                                 |
| **Mensch/Agent-Koexistenz**   | Nicht adressiert         | Human Blocks (nur Human-Bereiche markiert, alles andere implizit LLM-verwaltet)                           |
| **Health-Monitoring**         | Ad-Hoc Lint              | Automatische Dashboards bei jedem Compile                                                                 |
| **Query-Filing**              | Erwähnt                  | Systematische Query-to-Page Pipeline                                                                      |
| **Konflikt-Erkennung**        | Nicht adressiert         | Automatisch bei Ingest mit zweistufiger Validierung                                                       |
| **Progressive Summarization** | Nicht adressiert         | L1-L4 Verdichtungsebenen                                                                                  |
| **Index**                     | Einfacher Katalog        | Katalog mit Slug-Lookup + Semantic Summary-Match + Claim-ID-Registry + optionalem Embedding-Index         |
| **Lint**                      | Checkliste               | Strukturierte Issues (severity, category, code) + Forschungsagenda                                        |
| **Multi-Source-Konflikte**    | Nicht adressiert         | Claim-Contradiction-Clustering mit ID-basierter Referenzierung                                            |
| **Machine-Readable Output**   | Nicht adressiert         | agent-digest.json, claims.jsonl (Claims mit vollständiger ID-Referenz)                                    |
| **Obsidian-Integration**      | Erwähnt (Viewer)         | Optionaler Obsidian-Render-Mode mit CLI-Integration                                                       |
| **Schema-Evolution**          | Erwähnt                  | Explizites Version-Tracking des Schemas                                                                   |
| **Metadaten-Format**          | Nicht spezifiziert       | YAML-Frontmatter für maschinenlesbare Felder (Tags, ID, Status, Confidence)                               |
| **Claims als Quellen-Nachweis** | Nicht spezifiziert     | Jeder Claim trägt seinen Beleg direkt im `*Beleg:*`-Feld            |
| **Confidence-Kalibrierung**   | Nicht adressiert         | Vier-Faktoren-Modell (Quellentyp, Belegqualität, Anzahl Belege, Aktualität)                               |
| **Page-Typ-Dokumentation**    | Nicht adressiert         | Jeder Page-Typ (source, entity, concept, synthesis, report) detailliert dokumentiert                      |
| **Grundlagen-Kapitel**        | Nicht adressiert         | Kapitel 2 definiert alle zentralen Konzepte (Claim, Entity, Concept etc.) vor der Architektur             |
| **Claim-Spezifikation**       | Nicht adressiert         | Kapitel 4.8 spezifiziert Claims vollständig (Felder, Status, ID-Konvention)                               |

---

## 8. PKM-Konzepte: Was fehlt, was passt, was ergänzt

Das LLM Wiki ist ein hybrides System — es verbindet automatische LLM-Kuration mit klassischen Personal-Knowledge-Management-Methoden (PKM). Nicht jedes PKM-Konzept passt in ein LLM-gewatetes Wiki, aber viele ergänzen es sinnvoll. Hier eine systematische Einordnung.

### Bereits integriert

**Atomic Notes (Zettelkasten).** Entity- und Concept-Seiten entsprechen atomaren Notizen: eine Seite = eine Sache. Sie sind dicht verlinkt (Relationships, Backlinks) und werden bei jedem relevanten Ingest aktualisiert. Der entscheidende Unterschied zum klassischen Zettelkasten: Die Verlinkung geschieht automatisch durch das LLM, nicht manuell durch den Menschen.

**Evergreen Notes.** Das Update-System (Merge statt Append) macht Wiki-Seiten zu Evergreen Notes — sie werden kontinuierlich verbessert, nicht einmal erstellt und dann vergessen. Claims können superseded werden, Confidence kann sich mit neuen Quellen ändern, die Prosa wird fließend aktualisiert.

**Progressive Summarization (Tiago Forte).** Bereits als L1-L4-System implementiert: One-Liner → TL;DR → Full Page → Source Links (via `*Beleg:*` in Claims). Das erlaubt kontextabhängiges Lesen und spart Tokens bei Queries.

**Maps of Content (MOCs).** `index.md` ist ein automatisch generiertes MOC. Syntheses-Seiten (`synthesis.stoizismus-und-empirie`) sind kuratierte MOCs für spezifische Themen. Was fehlt: vom Menschen kuratierte MOCs, die eine bewusste, nicht-algorithmische Struktur abbilden.

**Inbox / Fleeting Notes.** Der `inbox/`-Ordner ist genau das: Rohmaterial, das noch nicht ingested wurde. Fleeting Notes (schnelle Gedanken, Sprachnotizen) können hier abgelegt und später vom LLM verarbeitet werden.

### Teilweise integriert — ausbaufähig

**PARA-Methode (Projects, Areas, Resources, Archives).** Die Page-Typen (`entity`, `concept`, `synthesis`) decken Resources und Areas teilweise ab. Was fehlt:
- **Projects**: Keine native Unterstützung für zeitlich begrenzte, zielorientierte Sammlungen. Eine `project/`-Kategorie mit Fortschritts-Tracking wäre sinnvoll.
- **Archives**: Das `status: archived`-Flag existiert, aber es gibt keinen Archive-Ordner oder automatische Archivierungsregeln.

**Daily Notes / Journal.** Quellen können Journal-Notizen sein (`source.persoenliches-journal-2026-04`), aber das LLM Wiki behandelt sie wie jede andere Quelle. Besser wäre: Daily Notes als First-Class-Source-Typ mit automatischer Datums-Extraktion, Stimmungs-Tracking und Querverweisen zu thematisch ähnlichen Tagen ("Heute ähnlich wie der 15. März — auch Stress-Thema").

**Spaced Repetition.** Die Confidence- und Staleness-Mechanismen ähneln Spaced Repetition (Claims verfallen, wenn sie nicht aktualisiert werden). Was fehlt: ein expliziter Review-Zeitplan. Das System könnte pro Claim ein `reviewAfter`-Datum setzen und den Menschen proaktiv an überfällige Reviews erinnern — ähnlich wie Anki, aber für Wissens-Claims statt Vokabeln.

**Tagging / Folksonomy.** Tags existieren im YAML-Frontmatter jeder Seite. Sie werden genutzt für:
- Domain-übergreifende Filter (z.B. alle Seiten mit `#depression` oder `#c++`)
- Automatische Tag-Vorschläge durch das LLM beim Ingest
- Tag-basierte Dashboards ("Zeige alle Claims mit Tag `#empirisch-belegt`")

### Noch nicht integriert — Ergänzungsvorschläge

**Question-Driven Notes.** Statt von Quellen auszugehen, von Fragen: "Was ist der Zusammenhang zwischen X und Y?" → Das LLM recherchiert (Web-Suche, bestehende Quellen) → schreibt eine Synthesis-Seite, die mit der Frage beginnt. Das erweitert den Workflow von "Quelle → Wissen" zu "Frage → Wissen".

**Transclusion / Embedding.** Obsidian's `![[note]]`-Syntax erlaubt das Einbetten von Teilen einer Seite in eine andere. Im LLM Wiki wäre das nützlich für: "Fasse die Claims aus diesen drei Seiten zusammen und bette die relevanten Ausschnitte ein". Technisch: Der Compile-Step könnte `![[entity.seneca#Lehre]]` auflösen und den Inhalt vor dem LLM-Query expandieren.

**Templates / Scaffolding.** Aktuell hat das Wiki implizite Templates (Entity-Seite hat `## Claims`, Source-Seite hat `## Key Takeaways`). Besser: explizite, versionierte Templates im Schema (`wiki-schema.md`), die bei CREATE automatisch angewendet werden und deren Felder der Lint prüft.

**Serendipity Engine.** Ein LLM-basiertes "Zufallsentdeckungs"-Feature: "Hier sind zwei Seiten, die noch nicht verlinkt sind, aber ein interessantes Konzept teilen". Das Gegenteil von gerichteter Query — kreative Querverbindungen, die kein Mensch und kein intentionaler Algorithmus finden würde.

**Conflicting Perspectives (Dissoi Logoi).** Das aktuelle System markiert Widersprüche, löst sie aber bewusst nicht auf. Das ist stoisch korrekt. Was fehlt: eine explizite `perspectives/`-Seite pro kontroversem Thema, die beide (oder mehr) Seiten fair darstellt — nicht als "gelöster" Widerspruch, sondern als dokumentierte Kontroverse.

**Time-Based Views.** Der `log.md` ist chronologisch, aber rein operativ. Eine zusätzliche Ansicht: "Was wusste das Wiki am 1. Januar über Stoizismus?" — also eine historische Version des Wissensstands. Technisch via Git (Tags pro Tag) oder via Snapshot-Export des Index zu bestimmten Zeitpunkten.

### Was bewusst *nicht* integriert wird

**Mind Maps / Canvas.** Obsidian Canvas ist visuell ansprechend, aber für ein LLM nicht navigierbar. Das Wiki bleibt textbasiert — Beziehungen sind Einträge im `## Verknüpfungen`-Kapitel, nicht Linien auf einer Leinwand.

**Handschriftliche Notizen / Sketchnotes.** Bild-Eingabe ist möglich (via multimodale LLMs), aber das Wiki selbst ist reiner Text. Sketchnotes können als Raw Source dienen, werden aber in Text extrahiert.

**Soziale / Kollaborative Features.** Das LLM Wiki ist ein persönliches Werkzeug. Multi-User-Wikis mit Merge-Konflikten und Berechtigungen sind ein anderes Produkt.

**Gamification / Streaks.** Keine "Du hast 7 Tage in Folge ingested!"-Badges. Die Motivation kommt aus der Qualität des kompilierten Wissens, nicht aus externen Anreizen.

---

## 9. Use Cases

- **Persönliches Wissensmanagement:** Journal-Entries, Artikel, Podcast-Notizen, Buch-Exzerpte → strukturiertes Selbstbild
- **Research-Deep-Dive:** Papers, Reports, Interviews über Wochen/Monate → wachsende These mit Belegkette
- **Buch-Begleit-Wiki:** Kapitel für Kapitel → Charaktere, Themen, Plot-Threads (wie Tolkien Gateway im Kleinen)
- **Team-Wiki:** Slack-Threads, Meeting-Notizen, Projekt-Docs → automatisch gepflegtes Internal Wiki
- **Embedded Systems Knowledge Base:** C++ Patterns, Cortex R5 Details, Debugging-Erfahrungen
- **Stoische Philosophie:** Senecas Briefe, Epiktet, Marc Aurel — Querbezüge, Themen-Cluster, persönliche Anwendungen

---

## 10. Glossar

| Begriff              | Bedeutung                                                                                                                                                                                                                                                                                       |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Raw Source**       | Ein unbearbeitetes Quelldokument (Artikel, Paper, Transkript, Notiz). Immutable — das LLM liest nur beim Ingest, überschreibt nie. Liegt in `raw-sources/`. Wird nach der Source-Erstellung vom LLM nicht mehr verwendet.                                                                       |
| **Source**           | Wiki-Seite vom Typ `source` im Ordner `sources/`. Verarbeitete, menschlich geprüfte Wissensgrundlage aus einer Raw Source. Alle weiteren Verarbeitungen (Extraktion, Claims, Updates) basieren ausschließlich auf Sources. Verlinkt auf die Raw Source zur menschlichen Nachprüfbarkeit.        |
| **Wiki Page**        | Eine vom LLM generierte und gepflegte Markdown-Datei im Vault mit festem Typ (`source`, `entity`, `concept`, `synthesis`, `report`).                                                                                                                                                            |
| **Entity**           | Wiki-Seite vom Typ `entity`. Beschreibt eine identifizierbare Sache — Person, Projekt, Tool, Organisation, Ort, Ereignis. Sammelt Claims.                                                                                                                                                       |
| **Concept**          | Wiki-Seite vom Typ `concept`. Beschreibt eine abstrakte Idee, Theorie, Pattern, Methode oder Framework. Sammelt Claims.                                                                                                                                                                         |
| **Synthesis**        | Wiki-Seite vom Typ `synthesis`. Querschnittsanalyse, die mehrere Entities oder Concepts verknüpft. Entsteht aus Query oder Compile. Sammelt Claims.                                                                                                                                             |
| **Report**           | Wiki-Seite vom Typ `report`. Auto-generiertes Dashboard. Wird bei jedem Compile komplett neu generiert.                                                                                                                                                                                         |
| **Claim**            | Strukturierte, überprüfbare Behauptung mit eindeutiger `id:claim-xxx`, `conf`, `status` und `*Beleg:*` (Wikilink auf eine Source). Die ID erlaubt direkte Referenzierung aus Dashboards, Index und Cross-References (Format: `page-id#claim-id`). Macht aus Prosa ein trackbares Belief-System. |
| **Evidence**         | Beleg für einen Claim, als Wikilink im `*Beleg:*`-Feld. Jeder Claim trägt seinen eigenen Herkunftsnachweis. Kein Claim ohne Evidence.                                                                                                                |
| **Human Block**      | Markdown-Abschnitt zwischen `<!-- llm-wiki:human:start -->` und `<!-- llm-wiki:human:end -->`. Der einzige explizit markierte Bereich. Handschriftliche Notizen, niemals vom LLM angetastet. Alles außerhalb ist implizit LLM-verwaltet.                                                        |
| **YAML-Frontmatter** | Metadaten-Block am Anfang jeder Seite. Enthält `id`, `page`, `title`, `status`, `tags`, `confidence`, `created`, `updated`.                                                                                                                                                                     |
| **Ingest**           | Der Vorgang, eine Raw Source ins Wiki zu integrieren: lesen → diskutieren → Source-Page → Extraktion (aus der Source) → betroffene Seiten updaten → Compile triggern.                                                                                                                           |
| **Compile**          | Liest den gesamten Vault und regeneriert index.md, Backlinks, Dashboards und machine-readable Digests.                                                                                                                                                                                          |
| **Lint**             | Health-Check: Strukturfehler, fehlende Belege, broken Links, Widersprüche, stale Claims, offene Fragen, doppelte Claim-IDs.                                                                                                                                                                     |
| **Confidence**       | Vertrauenswürdigkeit eines Claims (0.0–1.0). Vom LLM initial geschätzt, vom Compile per Vier-Faktoren-Modell kalibriert. Page-Level-Confidence = arithmetisches Mittel aller Claims.                                                                                                            |
| **Claim-ID**         | Eindeutiger Identifier eines Claims (Pattern: `claim-<slug>`). Page-scoped, nicht Vault-weit. Vollständige Referenz: `page-id#claim-id`, z.B. `entity.seneca#claim-cortisol-senkung`.                                                                                                           |
| **index.md**         | Content-Katalog — jede Seite mit Link, One-Liner-Summary, Typ, Metadaten und Claim-ID-Registry. Erster Anlaufpunkt für Queries und Update-Lookups.                                                                                                                                              |
| **log.md**           | Append-only Chronik aller Operationen. Parsebar mit Unix-Tools.                                                                                                                                                                                                                                 |
| **Schema**           | AGENTS.md / wiki-schema.md — definiert Struktur, Konventionen und Workflows für das LLM.                                                                                                                                                                                                        |
| **Dashboard**        | Auto-generierte Report-Seite (`reports/`), die den Gesundheitszustand des Wikis visualisiert. Claims werden per `page-id#claim-id` referenziert.                                                                                                                                                |
| **Agent Digest**     | Maschinenlesbare JSON-Datei (`.llm-wiki/cache/agent-digest.json`) mit kompakter Zusammenfassung aller Wiki-Seiten inkl. Claim-IDs.                                                                                                                                                              |

---

## 11. Risiken, Fehlerquellen und Gegenmaßnahmen

Jedes System hat Failure Modes. Ein LLM-gewartetes Wiki ist keine Ausnahme. Für jedes Risiko: das konkrete Problem, die Gegenmaßnahmen, und wo sinnvoll ein illustrierendes Beispiel.

### Kalter Start (Bootstrap-Modus)

**Problem:** Beim Start des Wikis hat der Semantic Match kaum Anhaltspunkte. Der Index ist dünn, Summaries sind wenige — das LLM kann Konzepte schlecht zuordnen.

**Gegenmaßnahmen:**
- Manuelle Führung: Das System fragt bei den ersten 20 Ingests häufiger nach — *"Ich habe 'Stoische Ethik' gefunden. Soll ich dafür ein neues Concept anlegen oder passt das zu 'Philosophie'?"*
- Ein `is_bootstrapping: true` Flag im `agent-digest.json` unterdrückt automatische Synthesen und forciert menschliche Bestätigung für neue Entities/Concepts.
- Erst ab ~50 Seiten wird der automatische Modus voll aktiviert.

**Beispiel:** Bei den ersten 5 Ingests werden alle neu erkannten Entities und Concepts als `status: review` angelegt und dem Menschen zur Bestätigung vorgelegt.

### Schema-Migration

**Problem:** Du entscheidest dich, das Feld `confidence` in `reliability` umzubenennen — alle bestehenden Seiten haben noch das alte Feld.

**Gegenmaßnahmen:**
- Ein Migrations-Agent liest das `wiki-schema.md` (neu) vs. `_schema_version` der Seite (alt).
- Migration als expliziter Befehl: `python llm-wiki.py migrate --target-version 2.0`.
- Das Skript läuft über alle `.md`-Dateien und transformiert die YAML-Frontmatter-Felder auf das neue Schema.
- Vor jeder Migration: Git-Commit als Rollback-Punkt.

**Beispiel:** `_schema_version: 1` im Frontmatter → Migration erkennt veraltete Seiten → `confidence` wird in `reliability` umbenannt → `_schema_version: 2` gesetzt.

### Halluzination als "Wissen"

**Problem:** Das LLM erfindet Fakten, schreibt sie als Claims ins Wiki, und die erfundenen Claims werden zur Grundlage späterer Queries — ein sich selbst verstärkender Fehler.

**Gegenmaßnahmen:**
- Jeder Claim **muss** mindestens einen `*Beleg:*` mit Wikilink auf eine Source haben. Claims ohne Evidence werden beim Lint als `claim-missing-evidence` gemeldet.
- Confidence aus Evidence-Qualität (peer-reviewed > Buch > Blogpost > LLM-generiert). Low-Confidence-Claims (< 0.5) prominent markiert.
- Ingest-Prompt fordert explizit Belegstellen. Keine Quelle → `status: uncertain`.
- Human-in-the-Loop: Nach jedem Ingest den Diff reviewen (~2-3 Minuten bei 10-15 Seiten).
- `review`-Status-Flag für Seiten, die noch kein Mensch abgenommen hat.
- Validate-Schritt (5.5): Stichproben-Cross-Checking mit stärkerem Modell.

### Wissen veraltet unbemerkt

**Problem:** Claims bleiben `active`, obwohl neuere Quellen sie widerlegt haben oder die ursprüngliche Studie 10 Jahre alt ist.

**Gegenmaßnahmen:**
- `updated` im YAML-Frontmatter pro Seite. Lint markiert Claims älter als N Tage als `stale`.
- Ingest prüft bei jeder neuen Quelle auf Widersprüche zu bestehenden Claims.
- Stale-Pages-Dashboard zeigt ungewartete Seiten.
- Proaktive Aktualisierung: Neue Quelle mit derselben Quellen-Referenz → Claim zur Überprüfung vorschlagen.

**Beispiel:** Ein Claim von 2022 referenziert eine Studie von 2018. 2026 läuft der Lint → Claim ist 4 Jahre alt, Studie 8 Jahre → `stale`-Warnung mit Vorschlag: "Neue Meta-Analyse zu diesem Thema ingestieren?"

### Strukturloses Wachstum

**Problem:** Nach 50+ Sources und 200+ Seiten wird das Wiki unübersichtlich. Duplikate entstehen, weil ähnliche Konzepte unter verschiedenen Namen angelegt werden.

**Gegenmaßnahmen:**
- Feste Page-Typen mit Ordnern. Compile prüft Directory-Konsistenz.
- Lint findet Duplicate-IDs (auch doppelte Claim-IDs innerhalb einer Seite), Orphan Pages, Broken Wikilinks.
- Merge-Strategie: Vor neuer Seite per Semantic Similarity prüfen, ob ähnliche existiert.
- Slug-basierte IDs erzwingen Eindeutigkeit.

### Agent zerstört menschliche Notizen

**Problem:** Das LLM überschreibt handschriftliche Annotationen beim Update einer Seite.

**Gegenmaßnahmen:**
- Human Blocks strikt als einzige markierte Bereiche geschützt. Alles außerhalb ist implizit LLM-verwaltet.
- Human-Blöcke (`<!-- llm-wiki:human:start -->` / `<!-- llm-wiki:human:end -->`) werden nie angetastet.
- Git als Sicherheitsnetz: Vor Compile `git commit`, bei Fehler `git revert`.

**Beispiel:** Die Entity-Seite zu Seneca enthält im Human Block die Notiz "Ich finde Senecas Briefe zugänglicher als Marc Aurel". Nach 50 Ingests steht diese Notiz immer noch exakt so da — kein Wort wurde verändert.

### Scope Creep — das Wiki als Selbstzweck

**Problem:** Wiki-Pflege verschlingt mehr Zeit als sie spart. Jede Query → fünf neue Seiten. Der Vault wuchert.

**Gegenmaßnahmen:**
- YAGNI: Nicht jede Antwort braucht eine Synthesis-Page. Nur bei ≥3 Quellen oder neuem Zusammenhang.
- Query-to-Page ist Vorschlag, nicht Automatismus. Mensch bestätigt.
- Schema definiert Mindestanforderungen: "Concept braucht ≥3 verlinkte Sources."
- Archivierung: `status: archived` blendet aus aktivem Index aus.

### Nuancenverlust

**Problem:** Paper sagt "X gilt unter A, B, C". LLM extrahiert "X gilt". Claim wird irreführend — die Einschränkungen gehen verloren.

**Gegenmaßnahmen:**
- Ingest-Prompt: "Extrahiere Bedingungen, Einschränkungen, Unsicherheiten."
- Claims mit Qualifier-Feldern: `*Einschränkung:*` dokumentiert explizit die Bedingungen.
- Bei Widersprüchen nicht automatisch neueren bevorzugen → beide `contested`.

**Beispiel:** Claim "Praemeditatio senkt Cortisol um 18%" mit Einschränkung "Keine Wirkung bei Teilnehmern unter 25 Jahren" — die Einschränkung ist kein Kleingedrucktes, sondern ein Pflichtfeld im Claim.

### Prompt Drift über Sessions

**Problem:** Session 1 vs. Session 10 — inkonsistenter Stil, ungleiche Qualität. Das Wiki wird ein Flickenteppich.

**Gegenmaßnahmen:**
- Schema definiert Templates und goldene Beispiel-Seiten pro Typ.
- Compile normalisiert Formatierung.
- Lint prüft Schema-Konformität.
- AGENTS.md als Single Source of Truth für alle Agenten.

### Vertrauensverlust durch fehlerhafte Queries

**Problem:** Query liefert Falschantwort, zitiert aber überzeugend Wiki-Seiten. Der Mensch verliert Vertrauen in das gesamte System.

**Gegenmaßnahmen:**
- Antworten listen referenzierte Claims mit Confidence: "Behauptung X aus Source Y (Confidence: 0.7)".
- Explizite Markierung: "Wiki-basiert" vs. "speculative" (LLM-Synthese ohne Beleg).
- Bei Low Confidence: proaktive Frage "Soll ich neue Quelle recherchieren?"

### Kostenexplosion bei großen Vaults

**Problem:** Jeder Compile liest alle Seiten. Bei 500+ Seiten werden LLM-Calls teuer.

**Gegenmaßnahmen:**
- Inkrementeller Compile: Nur seit letztem Compile geänderte Seiten (ab ~500 Seiten).
- Index-First Query: Erst `index.md`, dann 3-5 Seiten — nicht der ganze Vault.
- Progressive Summarization: L1-Scan spart Full-Page-Reads.
- Embedding-Index erst ab >500 Seiten.
- Ollama (lokal) für Bulk-Operationen, Cloud-Modelle nur für komplexe Synthesen.

### Multi-Agent-Inkonsistenz

**Problem:** Verschiedene Modelle/Sessions → Flickenteppich-Stil. Claude schreibt anders als GPT-4o.

**Gegenmaßnahmen:**
- Schema mit Style Guide und verbindlichen Beispielen.
- Compile: optionaler Normalize-Pass für Überschriften, YAML-Frontmatter, Links.
- Bridge-Mode: Nur strukturierte Daten importieren, Prosa immer neu generieren.

---

## 12. Zusammenfassung

Das Pattern ist verblüffend einfach:

1. **Raw Sources sammeln** (immutable in `raw-sources/`)
2. **Sources erstellen** (verarbeitete, menschlich geprüfte Wissensgrundlage in `sources/`)
3. **LLM baut und pflegt ein Wiki daraus** (interlinked Markdown, structured claims mit IDs, basierend auf Sources)
4. **Schema definiert die Spielregeln** (AGENTS.md, wiki-schema.md)
5. **Ingest → Compile → Lint** als Maintenance-Loop
6. **Query** greift auf kompiliertes Wissen zu, nicht auf Roh-Chunks

Der entscheidende Shift: Wissen wird **einmal kompiliert** und dann aktuell gehalten — nicht bei jeder Frage neu zusammengesucht. Und der kritische zweite Shift: Sources sind nicht nur Herkunftsnachweise, sondern die **kuratierte Wissensgrundlage**, durch die alles Rohwissen fließt und auf der alle weiteren Verarbeitungen aufbauen. Das Wiki ist ein wachsendes, compounding Artefact. Das LLM macht die Buchhaltung, die kein Mensch machen will. Der Mensch denkt, kuratiert Quellen, stellt die richtigen Fragen.

Die technische Umsetzung ist bewusst schlank gehalten: Plain-Text Markdown mit YAML-Frontmatter, keine Datenbank, kein Server, keine Cloud-Abhängigkeit. Das Wiki ist in jedem Texteditor lesbar, mit Git versionierbar und über Obsidian optional visuell navigierbar. Die Intelligenz steckt in den Prompts und der Pipeline-Architektur, nicht in der Infrastruktur.

---

## 13. Quellen

1. **Karpathy, Andrej — "LLM Wiki" (Original-Gist)**
   <https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f>
   Das fundamentale Pattern: LLM als Wiki-Maintainer, drei Schichten (Sources/Wiki/Schema), drei Operationen (Ingest/Query/Lint).

2. **OpenClaw — memory-wiki Extension (Source Code & Skills)**
   <https://github.com/openclaw/openclaw/tree/main/extensions/memory-wiki>
   Implementierungs-Referenz: Human Blocks, Structured Claims, Compile-Pipeline, Dashboards, Lint-System, Bridge Mode.

3. **jrcruciani — obsidian-memory-for-ai ("The Compiled Wiki")**
   <https://github.com/jrcruciani/obsidian-memory-for-ai>
   Pattern-Guide: Sources/Wiki/Schema Architektur, Plain-Markdown-vs-VectorDB Tradeoffs, Automatisierungs-Strategien.

4. **domleca — llm-wiki (Obsidian Community Plugin)**
   <https://github.com/domleca/llm-wiki>
   Kontrast-Beispiel: RAG-basierter Ansatz (Extraktion → KB → Hybrid Search → Answer) als Gegenmodell zum Compilation-First-Pattern.

5. **Ar9av — obsidian-wiki (AI Agent Framework)**
   <https://github.com/Ar9av/obsidian-wiki>
   Skills-basierte Karpathy-Implementierung für AI Coding Agents. Vier-Stufen-Pipeline: Ingest → Extract → Resolve → Schema.

6. **HackerNoon — "The First OpenClaw Workflow That Actually Stuck for Me"**
   <https://hackernoon.com/the-first-openclaw-workflow-that-actually-stuck-for-me>
   Praxisbericht: Voice-Driven Wiki mit OpenClaw + Telegram + Obsidian + Git.

7. **OpenClaw — memory-wiki Plugin Documentation**
   Lokale Doku: `/usr/local/lib/node_modules/openclaw/docs/plugins/memory-wiki.md`
   Vault-Modi (isolated/bridge/unsafe-local), Config-Schema, Agent Tools, Gateway RPC.