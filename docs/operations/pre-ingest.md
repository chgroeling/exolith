# Pre-Ingest

Prepares a raw source for later ingest: validates the file, optionally discusses key takeaways with the human, and writes a processed source page to `sources/`. The discussion step is skippable — sources can be written without human calibration.

## The Three Steps of Pre-Ingest

1. Read and validate the raw source file (no LLM)
2. Discuss key takeaways with the human (interactive, **skippable**)
3. Write a source page in `sources/` — the processed knowledge base

---

## Step 1 — Read Raw Source Completely

The first step reads and validates the raw source file without involving the LLM. The file is checked for existence, type (`.md`, `.txt`, `.textile`), size (under the configured limit), and binary content (null bytes rejected). Once validated, the full content is read into memory.

New sources land in `inbox/`. The raw content is held in memory for the subsequent discussion and source page creation.

---

## Step 2 — Discuss Key Takeaways & Main Points (Skippable)

Before the LLM creates the source page, the human may engage in an interactive discussion. The human can **skip this step entirely** — the source page will be created from the raw content alone.

If the human chooses to discuss, the LLM reads the raw source content and summarizes it conversationally, then asks the human for opinionated judgment to calibrate the upcoming extraction step.

The human is asked to weigh in on:
- Which claims are central and which are peripheral?
- How credible is the source — should claims carry high or low confidence?
- Which entities, concepts, or relationships deserve priority extraction?
- What should be ignored or deprioritized?
- Are there nuances the source hints at but doesn't fully unpack?

The discussion is a back-and-forth: the LLM responds, the human provides feedback, and the loop continues until the human signals completion (empty input).

### Discussion Summary and Archiving

After the discussion ends, the LLM extracts the human's key feedback and calibration decisions into a concise summary. The raw source file is then copied to `raw-sources/` and the summary is appended as a `# Discussion Summary` chapter, preceded by a `---` separator.

This enriched file in `raw-sources/` becomes the canonical reference — it contains both the original content and the human's calibration signals. The full discussion transcript is discarded; only the extracted summary is preserved.

### Skipping the Discussion

When the discussion is skipped, no archive is written to `raw-sources/` and no discussion summary is generated. The source page is created from the raw content alone.

---

## Step 3 — Write Source Page

The source page in `sources/` is the **processed knowledge base** of the wiki. It is created from the raw source (read in step 1), optionally enriched by the human feedback from the discussion (step 2).

The source links to the raw source in `raw-sources/` — but exclusively for the human. For the LLM, the source is the sole working object from ingest onward. The raw source is not read again after this step.

---

## See Also

* [../architecture.md](../architecture.md) — architectural overview
* [ingest.md](ingest.md) — the ingest operation (processes source pages from `sources/`)
* [../pages/source-spec.md](../pages/source-spec.md) — source page specification
