# Validate — Provenance Check

While **lint** checks the structure (syntax), the **validate** step ensures content integrity. It combats hallucinations by spot-checking claims against their sources.

## The Solution: Cross-Checking

A second LLM run (ideally with a stronger model such as GPT-4o or Claude 3.5 Sonnet) receives only the extracted claim and the corresponding source excerpt.

## Example Workflow

1. System randomly selects 5% of all new claims.
2. Prompt: *"Check whether the claim 'Cortisol reduction of 18%' (ID: claim.cortisol-senkung) is supported by the following source: [source-snippet]. Answer with VALID, PARTIAL, or FAIL."*
3. On FAIL: Mark the page with a `⚠️ halluzinations-verdacht` flag in the YAML frontmatter (as an additional tag: `_halluzination-verdacht`) and block the automatic commit.

## See Also

* [../architecture.md](../architecture.md) — architectural overview (sections on hallucination countermeasures)
* [../cross-cutting/claim-spec.md](../cross-cutting/claim-spec.md) — claim structure validated here
* [lint.md](lint.md) — structural health checks (validate complements lint with content checks)
