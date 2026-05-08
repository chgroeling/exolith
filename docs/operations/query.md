# Query

Fragen gegen das Wiki stellen. Anders als bei RAG wird nicht gegen Roh-Chunks gesucht, sondern gegen das kompilierte Wissen. Der Query-Workflow läuft in vier Phasen:

**Phase 1 — Index-Scan (L1):** Das LLM liest `index.md` und identifiziert relevante Seiten anhand der One-Liner-Summaries und Tags. Kein Volltext-Scan — der Index liefert in einem Read den Überblick über den gesamten Vault.

**Phase 2 — Progressive Deep-Dive:** Relevante Seiten werden nach Bedarf eskaliert: erst L1 (One-Liner), dann L2 (TL;DR = erster Absatz), dann L3 (Full Page) nur bei hoher Relevanz. Das spart Tokens: Bei breiten Fragen werden viele Seiten auf L1/L2 gescannt, nur die Top-Treffer auf L3 geladen.

**Phase 3 — Synthese:** Das LLM synthetisiert eine Antwort aus den geladenen Seiten. Jede Behauptung wird mit zitierfähigen Quellen belegt — nicht Roh-Chunks, sondern Source-Pages mit Kontext. Die Confidence der referenzierten Claims fließt in die Antwort ein: Low-Confidence-Aussagen werden explizit als unsicher markiert.

**Phase 4 — Query Filing:** Substanzielle Antworten werden als Kandidaten für neue Wiki-Seiten vorgeschlagen. Kriterien: ≥3 Quellen verknüpft? Neuer Zusammenhang entdeckt? Widerspruch aufgelöst? Der Mensch bestätigt oder verwirft — das LLM macht den Rest.

## Beispiel: Eine Query von Anfang bis Ende

**Eingabe (Mensch):** *„Was sagt die aktuelle Forschung zur Wirksamkeit stoischer Praktiken — und wie schneiden sie im Vergleich zur KVT ab?"*

### Schritt 1 — Index-Scan

Das LLM liest `index.md` und scannt Summaries und Tags nach `#stoizismus`, `#psychologie`, `#empirisch`, `#kvt`:

```
Index-Scan (L1, gefiltert nach Tags #stoizismus OR #psychologie):
  ✓ concept.praemeditatio-malorum — "Stoische Übung zur Angstbewältigung" (2 claims, conf:0.7)
  ✓ concept.stoizismus — "Philosophische Schule der Stoa" (1 claim, conf:0.8)
  ✓ synthesis.stoizismus-und-empirie — "Was die Forschung sagt" (2 claims, conf:0.75)
  ✓ concept.kognitive-verhaltenstherapie — "Therapieform mit stoischen Wurzeln" (3 claims, conf:0.9)
  → 4 Kandidaten, 2 davon hochrelevant (praemeditatio, stoizismus-und-empirie)
```

### Schritt 2 — Progressive Deep-Dive

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

### Schritt 3 — Synthese (LLM-Antwort)

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

### Schritt 4 — Query Filing

```
> Diese Query hat 3 Quellen verknüpft und einen neuen Zusammenhang
> hergestellt (Stoa vs. KVT-Evidenzlage). Soll ich eine Synthesis-Seite
> `synthesis.stoa-vs-kvt-evidenz` daraus machen?
```

Der Mensch kann bestätigen (→ neue Seite wird erstellt), verwerfen oder modifizieren.

## Progressive Summarization — die vier Verdichtungsebenen

| Level | Name         | Quelle                     | Nutzung                         |
| ----- | ------------ | -------------------------- | ------------------------------- |
| L1    | One-Liner    | Erster Satz nach `# Titel` | Index-Scan, erstes Scoping      |
| L2    | TL;DR        | Erster Absatz der Seite    | Schnelles inhaltliches Erfassen |
| L3    | Full Page    | Komplette Seite            | Tiefe Analyse, Synthese         |
| L4    | Source Links | Claims mit `*Beleg:*`      | Herkunftsprüfung, Nachlesen     |
