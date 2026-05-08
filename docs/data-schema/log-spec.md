# log.md — Die Chronik

## Aufbau eines Log-Eintrags

- **Überschrift:** `## YYYY-MM-DD • aktion | Kurztitel` — maschinenlesbar und grep-freundlich. Kein `[ ]` ums Datum (das wäre ein Wikilink).
- **Quelle:** Nur bei `ingest`, als Wikilink: `[[pfad/zur/quelle]]`
- **Aktion:** Was wurde erstellt, geändert, gelöscht. Zahlen zu Entities/Concepts/Claims/Relationships
- **Kontext:** Bei `lint` oder `compile`: Warum wurde der Schritt ausgelöst, was war das Ergebnis

## Struktur und Beispiel

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
