# LLM Wiki — Architektur

## 1. Das Problem: Warum RAG nicht reicht

Retrieval-Augmented Generation (RAG) ist der Status Quo für "LLM trifft Dokumente": Chunks in eine Vektordatenbank, bei Query die ähnlichsten Chunks rausziehen, ins Prompt packen, Antwort generieren. Das funktioniert für einfache Faktenfragen — scheitert aber systematisch an drei Punkten:

1. **Kein Wissensaufbau.** Jede Query startet bei Null. Das LLM muss aus fragmentierten Chunks jedes Mal neu synthetisieren. Cross-References zwischen Dokumenten existieren nicht — sie werden zur Laufzeit durch Cosine-Similarity approximiert, was fehleranfällig und kontextblind ist.

2. **Keine Akkumulation.** Wenn du heute Paper A liest und morgen Paper B, das Paper A widerspricht, merkt das niemand. Der Widerspruch wird nur dann "entdeckt", wenn zufällig beide Chunks in derselben Query landen.

3. **Keine Kuratierung.** RAG liefert Roh-Chunks. Es gibt keine Abstraktionsebene — keine Synthese, keine Einordnung, keine Bewertung der Qualität oder Aktualität einer Information.

**Karpathys Gegenentwurf:** Nicht bei jeder Query neu zusammensuchen, sondern **einmal kompilieren und dann aktuell halten**. Das Wiki ist ein persistentes, wachsendes Artefakt — eine kuratierte, verlinkte Wissensschicht zwischen dir und den Rohquellen. Karpathys prägnanteste Formulierung:

> *"Obsidian is the IDE; the LLM is the programmer; the wiki is the codebase."*

---

## 2. Grundlagen — Die zentralen Konzepte

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

Der **zentrale Wissensbaustein** des Wikis — eine einzelne, überprüfbare Behauptung mit eindeutiger ID, Confidence, Status und Beleg. Claims sind strukturierte Einträge im `## Claims`-Kapitel jeder Content-Page. Sie machen aus vagen Aussagen ein trackbares Belief-System: Jeder Claim trägt seinen eigenen Herkunftsnachweis direkt im `*Beleg:*`-Feld. Die detaillierte Claim-Spezifikation (Felder, Status-Werte, ID-Konventionen) steht in [data-schema/claim-spec.md](data-schema/claim-spec.md).

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

## 4. Design-Prinzipien

### 4.1 Human Blocks — Mensch und Agent in derselben Datei

Jede Wiki-Seite kann Human-Blöcke enthalten — die einzigen HTML-Kommentare im gesamten System. Alles außerhalb dieser Marker ist implizit LLM-verwaltet:

```markdown
[Implizit LLM-verwaltet: Prosa, Claims, Verknüpfungen, Offene Fragen —
 alles außerhalb der Human-Marker darf der Agent lesen und schreiben.]

<!-- llm-wiki:human:start -->
[Meine handschriftlichen Notizen — werden NIE angetastet]
<!-- llm-wiki:human:end -->
```

Das schafft Vertrauen: Der Agent kann Seiten beliebig regenerieren, ohne menschliche Annotationen zu zerstören. Die Marker brauchen keinen Parser — reines Regex/String-Matching. Es gibt keine Managed-Block-Marker; nur Human Blocks werden explizit ausgezeichnet. Alles außerhalb ist implizit LLM-Managed.

### 4.2 Structured Claims statt nur Prosa

Claims sind strukturierte Daten im `## Claims`-Kapitel, nicht nur Fließtext. Jeder Claim hat eine eindeutige ID:

```markdown
## Claims
- `id:claim-stoizismus-stress` `conf:0.7` `status:active`
  Stoizismus reduziert nachweislich Stress
  *Beleg:* [[sources/meta-analyse-2024]] (Zeilen 45-62, n=1.200)
  *Beleg:* [[sources/persoenliche-erfahrung]] (Zeilen 12-18)
```

Damit wird aus "ich glaube X" ein trackbares Belief-System: Claims können über ihre ID direkt referenziert, bewertet, gewichtet, hinterfragt und aktualisiert werden — ohne den umgebenden Prosatext zu zerstören. Die Confidence wird vom LLM initial geschätzt und vom Compile anhand der vier Kalibrierungsfaktoren (Quellentyp, Belegqualität, Anzahl Belege, Aktualität) nachjustiert.

### 4.3 Konflikt-Erkennung beim Ingest

Bevor neue Claims gemerged werden, prüft das System:

- Widerspricht der neue Claim einem bestehenden? → Beide als `contested` markieren, Widerspruchs-Cluster anlegen (Claims per ID referenzieren: `entity.seneca#claim-cortisol-senkung ↔ concept.praemeditatio-malorum#claim-cortisol-signifikant`)
- Überschreibt der neue Claim einen älteren mit höherer Autorität? → Confidence-Gewichtung nach Quellentyp (peer-reviewed > Buch > Blogpost)
- Ist der bestehende Claim veraltet? → `stale`-Flag mit neuem Claim als Update-Kandidat

Die Konflikt-Erkennung arbeitet zweistufig: Erst Embedding-basierter Similarity-Vergleich, dann LLM-Validierung ("Sind die ähnlichen Claims wirklich widersprüchlich?").

### 4.4 Quellen-Nachweis über Claims

Kein Claim ohne Beleg. Das `*Beleg:*`-Feld jedes Claims enthält immer einen Wikilink auf eine Source — das ist der Pflicht-Herkunftsnachweis. Entities, Concepts und Syntheses verlinken ausschließlich auf Sources in `sources/`, nicht auf Raw Sources. Der Herkunftsnachweis ist damit in jedem Claim verankert: Jede Behauptung trägt ihren eigenen Beleg bei sich. Das zwingt zur Nachvollziehbarkeit — und verhindert Halluzination als „Wissen".

### 4.5 Dashboards als Health-Monitoring

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

## 5. Erweiterungen gegenüber dem Original-Pattern

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

## 6. Risiken, Fehlerquellen und Gegenmaßnahmen

### Kalter Start (Bootstrap-Modus)

**Problem:** Beim Start des Wikis hat der Semantic Match kaum Anhaltspunkte. Der Index ist dünn, Summaries sind wenige — das LLM kann Konzepte schlecht zuordnen.

**Gegenmaßnahmen:**
- Manuelle Führung: Das System fragt bei den ersten 20 Ingests häufiger nach — *"Ich habe 'Stoische Ethik' gefunden. Soll ich dafür ein neues Concept anlegen oder passt das zu 'Philosophie'?"*
- Ein `is_bootstrapping: true` Flag im `agent-digest.json` unterdrückt automatische Synthesen und forciert menschliche Bestätigung für neue Entities/Concepts.
- Erst ab ~50 Seiten wird der automatische Modus voll aktiviert.

### Schema-Migration

**Problem:** Du entscheidest dich, das Feld `confidence` in `reliability` umzubenennen — alle bestehenden Seiten haben noch das alte Feld.

**Gegenmaßnahmen:**
- Ein Migrations-Agent liest das `wiki-schema.md` (neu) vs. `_schema_version` der Seite (alt).
- Migration als expliziter Befehl: `python llm-wiki.py migrate --target-version 2.0`.
- Das Skript läuft über alle `.md`-Dateien und transformiert die YAML-Frontmatter-Felder auf das neue Schema.
- Vor jeder Migration: Git-Commit als Rollback-Punkt.

### Halluzination als "Wissen"

**Problem:** Das LLM erfindet Fakten, schreibt sie als Claims ins Wiki, und die erfundenen Claims werden zur Grundlage späterer Queries — ein sich selbst verstärkender Fehler.

**Gegenmaßnahmen:**
- Jeder Claim **muss** mindestens einen `*Beleg:*` mit Wikilink auf eine Source haben. Claims ohne Evidence werden beim Lint als `claim-missing-evidence` gemeldet.
- Confidence aus Evidence-Qualität (peer-reviewed > Buch > Blogpost > LLM-generiert). Low-Confidence-Claims (< 0.5) prominent markiert.
- Ingest-Prompt fordert explizit Belegstellen. Keine Quelle → `status: uncertain`.
- Human-in-the-Loop: Nach jedem Ingest den Diff reviewen (~2-3 Minuten bei 10-15 Seiten).
- `review`-Status-Flag für Seiten, die noch kein Mensch abgenommen hat.
- Validate-Schritt: Stichproben-Cross-Checking mit stärkerem Modell.

### Wissen veraltet unbemerkt

**Problem:** Claims bleiben `active`, obwohl neuere Quellen sie widerlegt haben oder die ursprüngliche Studie 10 Jahre alt ist.

**Gegenmaßnahmen:**
- `updated` im YAML-Frontmatter pro Seite. Lint markiert Claims älter als N Tage als `stale`.
- Ingest prüft bei jeder neuen Quelle auf Widersprüche zu bestehenden Claims.
- Stale-Pages-Dashboard zeigt ungewartete Seiten.
- Proaktive Aktualisierung: Neue Quelle mit derselben Quellen-Referenz → Claim zur Überprüfung vorschlagen.

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

## 7. Zusammenfassung

Das Pattern ist verblüffend einfach:

1. **Raw Sources sammeln** (immutable in `raw-sources/`)
2. **Sources erstellen** (verarbeitete, menschlich geprüfte Wissensgrundlage in `sources/`)
3. **LLM baut und pflegt ein Wiki daraus** (interlinked Markdown, structured claims mit IDs, basierend auf Sources)
4. **Schema definiert die Spielregeln** (AGENTS.md, wiki-schema.md)
5. **Ingest → Compile → Lint** als Maintenance-Loop
6. **Query** greift auf kompiliertes Wissen zu, nicht auf Roh-Chunks

Der entscheidende Shift: Wissen wird **einmal kompiliert** und dann aktuell gehalten — nicht bei jeder Frage neu zusammengesucht. Und der kritische zweite Shift: Sources sind nicht nur Herkunftsnachweise, sondern die **kuratierte Wissensgrundlage**, durch die alles Rohwissen fließt und auf der alle weiteren Verarbeitungen aufbauen. Das Wiki ist ein wachsendes, compounding Artefact. Das LLM macht die Buchhaltung, die kein Mensch machen will. Der Mensch denkt, kuratiert Quellen, stellt die richtigen Fragen.

Die technische Umsetzung ist bewusst schlank gehalten: Plain-Text Markdown mit YAML-Frontmatter, keine Datenbank, kein Server, keine Cloud-Abhängigkeit. Das Wiki ist in jedem Texteditor lesbar, mit Git versionierbar und über Obsidian optional visuell navigierbar. Die Intelligenz steckt in den Prompts und der Pipeline-Architektur, nicht in der Infrastruktur.
