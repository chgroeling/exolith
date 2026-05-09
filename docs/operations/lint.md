# Lint

Periodic health check of the wiki — as a first-class operation. Lint runs after every compile (automatically) and can be triggered manually by the human at any time (`lint`). The output is not just a list of errors, but generates a **research agenda** — lint tells you not only *what* is wrong, but *what to do next*.

## The Four Check Categories with Severity

| Category     | Severity  | Checks                                                                                                                                                                       |
| ------------ | --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Struktur** | `error`   | Duplicate page IDs, missing YAML frontmatter, page-type-directory mismatch, broken wikilinks, orphan pages (no backlinks), duplicate claim IDs within a page                 |
| **Herkunft** | `error`   | Claims without evidence (`*Beleg:*` field missing), evidence without a valid wikilink                                                                                        |
| **Qualität** | `warning` | Low-confidence claims (< 0.5), stale pages (>90 days without update), open questions without progress for >30 days, contradictions between claims (contested for >14 days)   |
| **Wachstum** | `info`    | Concepts without their own page (mentioned in >2 sources), underrepresented topic areas (<3 pages), outdated index entries, unused tags                                      |

## Example: A Lint Run

**Input:** `lint` (after an ingest that produced 3 new claims and 1 new entity)

**Output:**

```
🔍 Wiki Lint — 2026-05-06T10:45:00Z
   Vault: 15 pages, 4 Sources, 9 Claims

━━━ Struktur (errors) ━━━
❌ ERROR [E001] Duplicate page-id
   entities/seneca.md ↔ entities/seneca-briefe.md
   Both have id: entity.seneca
   → Fix: change id in one of the two pages

❌ ERROR [E003] Broken wikilink
   concepts/praemeditatio-malorum.md → [[entities/maria-schneider]]
   Target does not exist (typo? `maria-schneider` vs `maria-schneiderr`)
   → Fix: correct link or create target page

━━━ Herkunft (errors) ━━━
❌ ERROR [E010] Claim without evidence
   entities/neurologie.md → claim-dopamin-ausschuettung
   No *Beleg:* field present
   → Fix: add evidence from source or delete claim

━━━ Qualität (warnings) ━━━
⚠️  WARNING [W020] Low confidence claim (< 0.5)
   entity.seneca → claim-seneca-angst-these (conf: 0.3)
   Status: uncertain | Age: 5 days
   → Action: ingest a new empirical source for this claim?

⚠️  WARNING [W022] Contested claims unresolved (> 14 days)
   entity.seneca#claim-cortisol-senkung ↔ concept.kvt#claim-cortisol-kein-effekt
   Contradiction unresolved for 16 days
   → Action: research a new source for resolution or request human
     decision

━━━ Wachstum (info) ━━━
ℹ️  INFO [I030] Concept without its own page
   "Dichotomy of Control" — mentioned in 3 sources, no concept page
   → Action: ingest a source on this concept or manual CREATE

ℹ️  INFO [I032] Topic bias
   #philosophie: 12 pages | #embedded: 2 pages | #python: 1 page
   → Note: Embedded and Python areas are underrepresented

━━━ Summary ━━━
   3 errors (must be fixed)
   2 warnings (should be addressed promptly)
   2 info (research agenda, no urgency)

   Next step: fix errors, then run compile again.
   Research agenda: 4 new actions identified.
```

## Research Agenda — What Lint Delivers Beyond Errors

Lint is not just a validator, but an idea generator. The `info` and `warning` messages produce a prioritized to-do list:

1. 🔴 **Concept "Dichotomy of Control"** is mentioned in 3 sources but has no own page — ingest of a primary source recommended
2. 🟡 **Contested Claims** (cortisol reduction vs. no effect) unresolved for 16 days — resolution by new source or human decision needed
3. 🟡 **Topic bias** — Embedded and Python areas together have only 3 pages vs. 12 for philosophy. Conscious decision or source gap?
4. 🟢 **Low-confidence claim** on Seneca's anxiety thesis — opportunity to read an empirical source alongside the next Stoicism ingest

The human can accept individual agenda items (→ task is tracked), reject them (→ not suggested again on next lint run), or defer them.

## See Also

* [../architecture.md](../architecture.md) — architectural overview
* [../cross-cutting/claim-spec.md](../cross-cutting/claim-spec.md) — claim structure checked by lint
* [../cross-cutting/format-spec.md](../cross-cutting/format-spec.md) — format conventions validated by lint
* [resolution.md](resolution.md) — resolving contested claims detected by lint
