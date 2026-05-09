# Confidence — Calibration Model

Trustworthiness of a claim, expressed as a value between 0.0 and 1.0. Confidence is the currency of quality control — every assertion is weighted, every page has an aggregate score, and low-confidence claims are flagged for review.

## Page-Level Confidence

The `confidence` field in the YAML frontmatter is the **arithmetic mean** of all claim confidence values on the page:

```
page.confidence = sum(claim.confidence for claim in claims) / len(claims)
```

Pages without claims have `confidence: null`.

## Claim Confidence

The claim confidence (`conf:0.X` in the `## Claims` section) is initially estimated by the LLM during extraction and later calibrated by the compiler using a four-factor model:

| Factor                | Weight | Description                                                                                                     |
| --------------------- | ------ | --------------------------------------------------------------------------------------------------------------- |
| **Source type**       | 30%    | peer-reviewed (1.0) > book (0.8) > conference (0.7) > blog post (0.5) > social media (0.2) > LLM-generated (0.1) |
| **Evidence quality**  | 30%    | Direct quote with page number (1.0) > paraphrase with paragraph (0.7) > general reference (0.4) > no reference (0.0) |
| **Number of sources** | 20%    | 1 source = 0.5, 2 sources = 0.7, 3+ sources = 1.0 (logarithmic scale)                                           |
| **Recency**           | 20%    | < 1 year (1.0) > < 3 years (0.8) > < 5 years (0.6) > < 10 years (0.4) > older (0.2)                              |

### Example Calculation

```
Claim: "praemeditatio senkt Cortisol um 18%"
- Source type: peer-reviewed (Nature Human Behaviour) → 1.0 × 0.30 = 0.30
- Evidence quality: Direct quote with paragraph reference → 1.0 × 0.30 = 0.30
- Number of sources: 1 source → 0.5 × 0.20 = 0.10
- Recency: 2024, < 1 year → 1.0 × 0.20 = 0.20
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Calibrated Confidence = 0.90 → rounded to 0.9
```

## Workflow

1. During extraction, the LLM sets an initial confidence estimate.
2. The compiler recalibrates it using the four factors above.
3. The calibrated confidence is written back into the claim and the page-level average into the frontmatter.
4. Lint flags claims below 0.5 as low-confidence warnings.

## See Also

* [claim-spec.md](claim-spec.md) — claim structure including the `conf` field
* [format-spec.md](format-spec.md) — YAML frontmatter where `confidence` lives
* [../operations/lint.md](../operations/lint.md) — low-confidence claim detection
