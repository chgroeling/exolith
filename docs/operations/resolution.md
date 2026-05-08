# Contested Claims — Auflösungs-Workflow

Wenn der Compile Widersprüche zwischen Claims erkennt, setzt er den Status auf `contested`. Der Resolve-Prozess ist eine First-Class-Operation, die diese Widersprüche formal auflöst.

## Status: `contested`

Zwei Claims widersprechen sich → beide erhalten `status: contested`. Das System legt ein Widerspruchs-Cluster an, das die Claims per `page-id#claim-id`-Referenz verlinkt:

```
Widerspruchs-Cluster:
  entity.seneca#claim-cortisol-senkung
  ↔ concept.kvt#claim-cortisol-kein-effekt
```

## Konflikt-Erkennung beim Ingest

Bevor neue Claims gemerged werden, prüft das System:

1. **Widerspricht der neue Claim einem bestehenden?** → Beide als `contested` markieren, Widerspruchs-Cluster anlegen
2. **Überschreibt der neue Claim einen älteren mit höherer Autorität?** → Confidence-Gewichtung nach Quellentyp (peer-reviewed > Buch > Blogpost)
3. **Ist der bestehende Claim veraltet?** → `stale`-Flag mit neuem Claim als Update-Kandidat

Die Konflikt-Erkennung arbeitet **zweistufig**:
1. Embedding-basierter Similarity-Vergleich
2. LLM-Validierung ("Sind die ähnlichen Claims wirklich widersprüchlich?")

## Auflösungsregeln

| Regel                | Beschreibung                                                                                     |
| -------------------- | ------------------------------------------------------------------------------------------------ |
| **Confidence-Delta** | Hat einer der Claims signifikant höhere Confidence (Δ > 0.3)? → höherer gewinnt                   |
| **Quellenalter**     | Ist einer der Belege signifikant neuer (>5 Jahre Unterschied)? → neuerer gewinnt                  |
| **Methodische Qualität** | peer-reviewed > Buch > Blogpost. Qualitativ höherwertige Quelle gewinnt                       |
| **Automatisch**      | Wenn Confidence-Delta > 0.5 UND Quellentyp-Differenz ≥ 2 Stufen → automatische Auflösung         |
| **Menschlich**       | In allen anderen Fällen: menschliche Entscheidung erforderlich                                   |

## Resolve als First-Class-Operation

Resolve steht neben Ingest, Query und Lint als eigenständige Operation:

```
python llm-wiki.py resolve --claim entity.seneca#claim-cortisol-senkung
```

Der Resolve-Workflow:

1. **Widerspruchs-Cluster laden:** Alle `contested`-Claims im Cluster anzeigen
2. **Belege vergleichen:** Sources, Confidence, Alter, Quellentyp gegenüberstellen
3. **Entscheidung:** Nach den Auflösungsregeln automatisch oder menschlich entscheiden
4. **Dokumentation:** `resolved_by`-Feld im Claim setzen, `## Resolutions`-Sektion aktualisieren
5. **Kaskadierung:** Abhängige Claims prüfen — wenn ein referenzierter Claim aufgelöst wird, könnten davon abgeleitete Claims ebenfalls betroffen sein

## Auflösungsdokumentation

- **`resolved_by`-Feld im Claim:** Wer hat entschieden? (`auto`, `human`, `source-xyz`)
- **`resolved_at`-Feld im Claim:** Wann wurde aufgelöst?
- **`## Resolutions`-Sektion** im Report `reports/contradictions.md`: Historische Übersicht aller Auflösungen

## Update-Prompt: Widersprüche markieren

Beim Ingest markiert der Update-Prompt Widersprüche, löst sie aber nicht eigenständig. Regel 5 des Update-Prompts:

> **Widersprüche markieren** — Wenn ein neuer Claim einem bestehenden widerspricht: NICHT eigenständig lösen. Beide mit `status:contested` markieren.

Das stellt sicher, dass Widersprüche erkannt und dokumentiert werden, aber die Auflösung ein kontrollierter, nachvollziehbarer Prozess bleibt.
