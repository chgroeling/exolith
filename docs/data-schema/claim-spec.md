# Der Claim im Detail

Claims sind die atomaren Wissensbausteine des Wikis — eine einzelne, überprüfbare Behauptung mit eindeutiger ID, Confidence, Status und Beleg. Sie machen aus vagen Aussagen ein trackbares Belief-System. Jeder Claim trägt seinen eigenen Herkunftsnachweis direkt im `*Beleg:*`-Feld.

## Claim-Felder

Jeder Claim im `## Claims`-Kapitel hat:

| Feld               | Typ      | Pflicht | Beschreibung                                                                        |
| ------------------ | -------- | ------- | ----------------------------------------------------------------------------------- |
| `id:claim-xxx`     | string   | ✅       | Eindeutige Claim-ID, Slug-Pattern, page-scoped (z.B. `id:claim-cortisol-senkung`)   |
| `conf:0.X`         | float    | ✅       | Confidence (0.0–1.0), vom LLM gesetzt, vom Compile kalibriert                       |
| `status:...`       | enum     | ✅       | `active`, `contested`, `superseded`, `deprecated`, `uncertain`                      |
| `*Beleg:*`         | wikilink | ✅       | Wikilink auf Source + optionale Stellenangabe                                       |
| `*Einschränkung:*` | text     | ❌       | Methodische oder inhaltliche Limitationen                                           |
| `*aktualisiert:*`  | datum    | ❌       | Wann der Claim zuletzt überprüft wurde                                              |
| `*Kontext:*`       | text     | ❌       | Zusätzlicher Hintergrund                                                            |

## Claim-Status im Detail

| Status       | Bedeutung                                                | Auslöser                                       |
| ------------ | -------------------------------------------------------- | ---------------------------------------------- |
| `active`     | Claim ist gültig und aktuell                             | Default bei Neuanlage                          |
| `contested`  | Zwei Claims widersprechen sich                           | Konflikt-Erkennung beim Ingest                 |
| `superseded` | Neuerer Claim mit höherer Confidence hat diesen abgelöst | Update-Schritt: SUPERSEDE                      |
| `deprecated` | Claim ist nicht mehr relevant                            | Manuell oder durch Lint                        |
| `uncertain`  | Claim ist spekulativ, keine harte Evidenz                | Extraktion: philosophische Behauptung, Meinung |

## Claim-ID-Konvention

- Pattern: `claim-<kurzbeschreibung>` — slugifiziert, kleingeschrieben, Bindestriche
- Scope: eindeutig innerhalb einer Seite (nicht Vault-weit)
- Vollständige Referenz: `page-id#claim-id`, z.B. `entity.seneca#claim-cortisol-senkung`
- Die ID wird vom LLM beim Anlegen vergeben und ändert sich nie
- Dashboards und der Index referenzieren Claims über diese vollständige Referenz

## Format und Beispiele

Claims im `## Claims`-Kapitel haben eine eindeutige ID. Der Beleg ist immer ein Wikilink auf eine Source:

```markdown
## Claims

- `id:claim-cortisol-senkung` `conf:0.85` `status:active`
  Praemeditatio malorum senkt Cortisol um durchschnittlich 18%
  *Beleg:* [[sources/schneider-metastudie-2024]] (Absatz 3, n=1.200)
  *Einschränkung:* Keine Wirkung bei Teilnehmern unter 25 Jahren

- `id:claim-seneca-angst-these` `conf:0.3` `status:uncertain`
  Senecas These: „Die meisten Ängste entstehen aus antizipiertem Leiden,
  nicht aus realem"
  *Beleg:* [[sources/briefe-an-lucilius]] (13. Brief)
  *Einschränkung:* Philosophische Behauptung, 2.000 Jahre alt, kein empirischer Beleg
  *aktualisiert:* 2026-05-02
```
