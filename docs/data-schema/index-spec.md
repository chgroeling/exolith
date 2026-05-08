# index.md — Der Content-Katalog

Der Index ist die zentrale Navigationsstruktur des Wikis. Er wird bei jedem Compile automatisch neu generiert und listet **jede Wiki-Seite** mit den Feldern, die das LLM für Lookup und Query-Scoping braucht — nicht den Seiteninhalt selbst.

## Felder pro Index-Eintrag

(extrahiert aus YAML-Frontmatter und Body):

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

## Konkretes Beispiel

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

## Wie die Index-Felder genutzt werden

- **`page:xxx`** → Page-Typ. Das LLM nutzt es zum Scoping (beim Update nur Entities durchsuchen, nicht alle Kategorien). Der Mensch erkennt auf einen Blick, ob ein Eintrag Person, Idee oder Analyse ist.
- **`X claims`** → Umfang. Hohe Claim-Zahlen signalisieren dem LLM: diese Seite ist dicht, beim Ingest lohnt ein Reload. Der Mensch sieht, welche Seiten viel Substanz haben.
- **`❓`** → `hasOpenQuestions`. Fehlt das Flag, gibt es keine offenen Punkte. Das Dashboard `report.open-questions` wird per Grep über den Index gebaut — kein LLM-Aufruf nötig.
- **`conf:0.X`** → Durchschnitts-Confidence aller Claims der Seite (aus dem YAML-Frontmatter). Das LLM nutzt es zur Gewichtung bei Syntheses (niedrige Confidence → vorsichtig zitieren, Disclaimer setzen). Der Mensch sieht sofort: „diese Seite hat harte Belege" oder „hier ist viel Spekulation".
- **`active` / `review` / `archived`** → Lebenszyklus. Archivierte Seiten werden bei neuen Ingests ignoriert, Review-Seiten erhalten einen Lint-nudge.
- **`#tag1 #tag2`** → Tags aus dem YAML-Frontmatter, für thematische Filterung.
- Datumsstempel (`2026-05-01`) → `updatedAt`, kompakt notiert. Das LLM prüft daran: ist diese Seite aktuell? Bei Quellen älter als 6 Monate löst der Lint einen Refresh-Vorschlag aus.

## Zwei-Phasen-Lookup

Das LLM nutzt den Index für eine Lookup-Strategie in **zwei Phasen**, die immer beide durchlaufen werden:

1. **Phase 1 — Exakter Slug-Match** (Python-Script, String-Vergleich): Der extrahierte Name wird gegen alle Slugs im Index geprüft. Liefert einen Kandidaten oder „keiner".

2. **Phase 2 — Semantischer Summary-Match** (LLM-basiert): Parallel dazu bekommt das LLM alle Summaries der passenden Kategorie und sucht die semantisch ähnlichste Seite. Liefert ebenfalls einen Kandidaten oder „keiner".

**Ergebnis-Reconciliation:**

- **Beide liefern denselben Treffer** → sicherer Match, Seite laden
- **Nur Phase 1 trifft** → Slug-Match gewinnt
- **Nur Phase 2 trifft** → Semantic-Match gewinnt
- **Keine trifft** → neue Seite anlegen

### Wie eine neue Seite angelegt wird

1. **Slug generieren:** Aus dem extrahierten Namen wird ein Slug gebildet (`slugify("Dr. Maria Schneider")` → `maria-schneider`).
2. **Template laden:** Pro Page-Typ existiert ein Template in `wiki-schema.md`.
3. **Seite schreiben:** Das LLM füllt das Template. Die neue Seite erhält `status: review`.
4. **Index-Nachtrag:** Die neue Seite wird sofort in den Index eingetragen.

## Warum der Index so effizient ist

- **Eine Datei, ein Read.** Kein Directory-Scan, kein Glob-Pattern.
- **Summaries als Mini-Embeddings.** Die One-Liner erlauben dem LLM einen semantischen Vergleich, ohne echte Embeddings berechnen zu müssen.
- **Metadaten-Flags vermeiden unnötige Page-Loads.** Das `❓`-Flag zeigt sofort: offene Fragen — relevant fürs Dashboard, aber kein Grund, die Seite beim Ingest zu laden.
- **Claim-IDs ermöglichen präzise Referenzierung.** Dashboards und Cross-References können direkt auf einzelne Claims verweisen (`entity.seneca#claim-cortisol-senkung`).
- **Linear skalierend.** 500 Seiten = ~25 KB Index — passt locker in ein einzelnes LLM-Read.

Optional kann für Vaults >500 Seiten ein Embedding-Index (via `sentence-transformers` oder `ollama`) dazugeschaltet werden. Der kuratierte Index bleibt aber der primäre Navigationsmechanismus.
