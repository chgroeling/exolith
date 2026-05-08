# Validate — Herkunftsprüfung

Während der **Lint** die Struktur prüft (Syntax), stellt der **Validate**-Schritt die inhaltliche Integrität sicher. Er bekämpft Halluzinationen, indem er stichprobenartig Claims gegen ihre Sources prüft.

## Die Lösung: Cross-Checking

Ein zweiter LLM-Lauf (idealerweise mit einem stärkeren Modell wie GPT-4o oder Claude 3.5 Sonnet) erhält nur den extrahierten Claim und den zugehörigen Source-Abschnitt.

## Beispiel-Workflow

1. System wählt zufällig 5% aller neuen Claims aus.
2. Prompt: *"Prüfe, ob der Claim 'Cortisol-Senkung um 18%' (ID: claim-cortisol-senkung) durch die folgende Source gedeckt ist: [Source-Snippet]. Antworte mit VALID, PARTIAL oder FAIL."*
3. Bei FAIL: Markierung der Seite mit einem `⚠️ halluzinations-verdacht` Flag im YAML-Frontmatter (als zusätzlicher Tag: `_halluzination-verdacht`) und Blockieren des automatischen Commits.
