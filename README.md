# exolith

An LLM-maintained wiki. Compile knowledge once, query it forever — instead of re-assembling fragmented chunks for every question.

> *"Obsidian is the IDE; the LLM is the programmer; the wiki is the codebase."* — Andrej Karpathy

**How it works:** Dump raw sources into `inbox/`. The LLM ingests them into structured, interlinked wiki pages (sources, entities, concepts, syntheses). Every claim carries evidence and confidence. The core loop is **Ingest → Compile → Lint**. No database, no server — just plain Markdown with YAML frontmatter, versioned with Git.

> **Status:** Early-stage, under active development. Not finished yet.

[Architecture & Design](docs/architecture.md)
