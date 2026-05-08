# Compile

Nach jedem Ingest läuft der Compile-Step. Er liest den gesamten Vault und aktualisiert die Querschnittsstrukturen. Im Gegensatz zum Ingest (der gezielt einzelne Seiten modifiziert) arbeitet Compile auf dem ganzen Vault — er ist der Schritt, der aus vielen Einzelseiten ein kohärentes Wiki macht.

## Die fünf Compile-Phasen

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

## Index-Generierung im Detail

Die Index-Generierung ist Phase 2 des Compile — und das Herzstück der strukturellen Integrität.

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

## Inkrementeller vs. vollständiger Index

Der Compile regeneriert den Index **immer vollständig** — nicht inkrementell. Das ist ein bewusster Trade-off: Ein vollständiger Index-Neubau ist bei <500 Seiten in Millisekunden erledigt (reiner Dateisystem-Scan + YAML/Regex-Parse) und garantiert Konsistenz. Ein inkrementeller Update wäre fehleranfällig (vergessene Löschungen, verschobene Seiten, geänderte Sources). Erst bei >1.000 Seiten würde man auf inkrementellen Index-Bau umschalten.

## Weitere Compile-Phasen

- **Backlink-Blöcke** (`## Related`) in jede Seite einfügen — listet Sources, Backlinks und Shared-Source-Nachbarn
- **Dashboard-Reports** unter `reports/` aktualisieren: Open Questions, Contradictions, Low Confidence, Claim Health, Stale Pages, Person/Agent Directory, Relationship Graph, Herkunftsabdeckung, Privacy Review. Claims werden in Dashboards über ihre `page-id#claim-id`-Referenz identifiziert.
- **Machine-Readable Digests** schreiben: `agent-digest.json` (kompakte Zusammenfassung aller Seiten inkl. Claim-IDs) und `claims.jsonl` (alle Claims mit vollständiger Referenz als JSON-Lines)
- Optional: Embedding-Index aktualisieren

Compile trennt "Daten schreiben" (Ingest) von "Struktur aktualisieren" — sauberer als beides in einem Schritt.
