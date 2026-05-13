# Pre-Ingest

Prepares a raw source for later ingest: validates the file, optionally discusses key takeaways with the human, summarizes the discussion, extracts structured data from the LLM, and writes a processed source page to `inbox/`. The discussion and summarization steps are skippable — sources can be written without human calibration.

## The Five Steps of Pre-Ingest

1. Read and validate the raw source file (no LLM)
2. Discuss key takeaways with the human (interactive, **skippable**)
3. Summarize the discussion feedback (LLM, **skippable** — only when discussion occurred)
4. Extract structured source page data (LLM)
5. Write the source page to `inbox/`

---

## Step 1 — Read Raw Source Completely

The first step reads and validates the raw source file without involving the LLM. The file is checked for existence, type (`.md`, `.txt`, `.textile`), size (under the configured limit), and binary content (null bytes rejected). Once validated, the full content is read into memory.

New sources land in `inbox/`. The raw content is held in memory for the subsequent discussion and source page creation.

---

## Step 2 — Interactive Discussion (Skippable)

Before the LLM creates the source page, the human may engage in an interactive discussion. The human can **skip this step entirely** — the source page will be created from the raw content alone, and no summarization or archiving takes place.

If the human chooses to discuss, the LLM reads the raw source content and summarizes it conversationally, then asks the human for opinionated judgment to calibrate the upcoming extraction step.

The human is asked to weigh in on:
- Which claims are central and which are peripheral?
- How credible is the source — should claims carry high or low confidence?
- Which entities, concepts, or relationships deserve priority extraction?
- What should be ignored or deprioritized?
- Are there nuances the source hints at but doesn't fully unpack?

The discussion is a back-and-forth: the LLM responds, the human provides feedback, and the loop continues until the human signals completion (empty input).

---

## Step 3 — Summarize Discussion (Skippable)

After the discussion ends, the LLM extracts the human's key feedback and calibration decisions into a concise summary. The summary is stored in memory and passed to the source page extraction step. The full discussion transcript is discarded; only the extracted summary is preserved.

This step only executes when the human accepted the discussion in step 2. When skipped, no summary is generated.

---

## Step 4 — Extract Source Page

The LLM analyzes the raw source content (and discussion summary, if available) to produce structured metadata: title, type, authors, date, summary, main points, and tags. This structured data is generated with a strict JSON schema and forms the foundation of the source page.

---

## Step 5 — Write Source Page

The structured source page data is formatted as a markdown file with YAML frontmatter and written to `inbox/{slug}.md`. The file includes an identifier, metadata, and interlinked sections for summary, main points, and wiki page links.

---

## See Also

* [../architecture.md](../architecture.md) — architectural overview
* [ingest.md](ingest.md) — the ingest operation (processes source pages from `sources/`)
* [../pages/source-spec.md](../pages/source-spec.md) — source page specification
