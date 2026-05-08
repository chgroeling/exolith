# Format-Konventionen

Das gesamte Wiki verwendet Obsidian-Wikilinks (`[[pfad/zur/seite]]`) statt Markdown-Links. Metadaten, die maschinell geparst werden müssen, stehen im **YAML-Frontmatter** — Tags, ID, Page-Typ, Status, Confidence, Zeitstempel. Alles andere (Claims, Verknüpfungen) steht als normales Markdown im Body.

**Human Blocks** (`<!-- llm-wiki:human:start -->` / `<!-- llm-wiki:human:end -->`) sind die einzigen HTML-Kommentare im System und schützen handschriftliche Notizen vor Überschreiben. Alles außerhalb dieser Marker ist implizit LLM-verwaltet — es gibt keine Managed-Block-Marker. Zur Kapitelstrukturierung werden ausschließlich normale Markdown-Überschriften (`##`, `###`) verwendet.

## YAML-Frontmatter: Felder im Detail

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

## Confidence — wie sie sich ergibt

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
