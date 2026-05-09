# Concept — Abstract Ideas

The page type `concept` describes an **abstract idea, theory, pattern, method, or framework**. Concepts are the "verbs and adjectives" of the wiki — they describe *how* things relate and *which* properties they have.

**When is a Concept created?** During extraction, when the LLM recognizes a new pattern, method, or theory. Concepts also arise from queries ("What connects X and Y?") and are then proposed as synthesis candidates.

**Structure of a Concept (example):**

```markdown
---
id: concept.praemeditatio-malorum
title: Praemeditatio Malorum
confidence: 0.7
status: active
tags:
  - stoicism
  - psychology
  - anxiety-management
created: 2026-05-02
updated: 2026-05-02
---

# Praemeditatio Malorum

Praemeditatio malorum (Latin: "premeditation of evils") is a Stoic
exercise: the deliberate, detailed imagination of the worst that could
happen. It serves as anxiety management — not through suppression,
but through confrontation. Seneca described it in the 13th Letter to
Lucilius. In 2024 it was empirically confirmed by Dr. Maria Schneider
(cortisol reduction of 18%, n=1,200, Nature Human Behaviour).

## Claims

- `id:claim.cortisol-significant` `conf:0.85` `status:active`
  Daily praemeditatio significantly reduces cortisol (p < 0.001)
  *Evidence:* [[sources/schneider-meta-study-2024]] (paragraph 3, n=1,200)
  *Limitation:* No effect in participants under 25 years

- `id:claim.age-threshold` `conf:0.8` `status:active`
  The effect only occurs in participants over 25 years
  *Evidence:* [[sources/schneider-meta-study-2024]] (paragraph 4)
  *Limitation:* Age threshold not granularly examined (only </≥25)

## Links

- `defined_by` → [[entities/seneca]]
- `empirically_confirmed_by` → [[entities/maria-schneider]]
- `belongs_to` → [[concepts/stoicism]]
- `related_to` → [[concepts/dichotomy-of-control]]

## Open Questions

- Does the cortisol reduction persist after discontinuing the exercises?
  *Context:* Study only measures acute effects
- Why does praemeditatio not work for people under 25?
  *Context:* Possible explanation: prefrontal cortex not yet fully developed

<!-- exolith:human:start -->
## Personal Notes

Been practicing this since January — subjectively noticeable effect before
presentations. The empirical confirmation makes it more credible for me.
<!-- exolith:human:end -->
```

**Special Characteristics:**

- Concepts collect claims just like entities — every pattern, every method can be supported by empirical or theoretical claims.
- Concepts are the core of knowledge interconnection — they link entities and other concepts.
- A concept without empirical evidence is valid but receives lower confidence.
- Concepts grow with each new source — they are Evergreen Notes in the classic sense.
- Everything outside the human block markers is implicitly LLM-managed.

## See Also

* [vault-layout.md](vault-layout.md) — where concepts live in the vault
* [format-spec.md](format-spec.md) — YAML frontmatter and format conventions
* [claim-spec.md](claim-spec.md) — claim structure used in concepts
