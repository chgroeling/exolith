# Report — Dashboards

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
