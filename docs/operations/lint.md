# Lint

Periodischer Health-Check des Wikis — als First-Class-Operation. Lint läuft nach jedem Compile (automatisch) und kann vom Menschen jederzeit manuell angestoßen werden (`lint`). Der Output ist nicht nur eine Fehlerliste, sondern generiert eine **Forschungsagenda** — Lint sagt nicht nur *was* falsch ist, sondern *was als nächstes zu tun ist*.

## Die vier Check-Kategorien mit Severity

| Kategorie    | Severity  | Checks                                                                                                                                                                       |
| ------------ | --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Struktur** | `error`   | Doppelte Page-IDs, fehlendes YAML-Frontmatter, Page-Type-Directory-Mismatch, Broken Wikilinks, Orphan Pages (keine Backlinks), doppelte Claim-IDs innerhalb einer Seite      |
| **Herkunft** | `error`   | Claims ohne Evidence (`*Beleg:*`-Feld fehlt), Evidence ohne gültigen Wikilink                                                                                                |
| **Qualität** | `warning` | Low-Confidence Claims (< 0.5), Stale Pages (>90 Tage ohne Update), Offene Questions ohne Fortschritt seit >30 Tagen, Widersprüche zwischen Claims (contested seit >14 Tagen) |
| **Wachstum** | `info`    | Konzepte ohne eigene Seite (in >2 Sources erwähnt), unterrepräsentierte Themenbereiche (<3 Seiten), veraltete Index-Einträge, ungenutzte Tags                                |

## Beispiel: Ein Lint-Lauf

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

## Forschungsagenda — was Lint über Fehler hinaus liefert

Lint ist nicht nur ein Validator, sondern ein Ideengenerator. Aus den `info`- und `warning`-Meldungen entsteht eine priorisierte To-Do-Liste:

1. 🔴 **Konzept "Dichotomie der Kontrolle"** wird in 3 Quellen erwähnt, hat aber keine eigene Seite — Ingest einer Primärquelle empfohlen
2. 🟡 **Contested Claims** (Cortisol-Senkung vs. kein Effekt) seit 16 Tagen ungelöst — Auflösung durch neue Quelle oder menschliche Entscheidung nötig
3. 🟡 **Themen-Bias** — Embedded- und Python-Bereich haben zusammen nur 3 Seiten vs. 12 für Philosophie. Bewusste Entscheidung oder Quellen-Lücke?
4. 🟢 **Low-Confidence-Claim** zu Senecas Angst-These — Gelegenheit, bei nächstem Stoa-Ingest eine empirische Quelle mitzulesen

Der Mensch kann einzelne Agenda-Punkte akzeptieren (→ Task wird getrackt), ablehnen (→ wird beim nächsten Lint nicht erneut vorgeschlagen) oder aufschieben.
