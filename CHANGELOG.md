# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Native DeepSeek LLM provider with config-driven provider selection
- `picocolors` for terminal-colored output
- `--version` flag to CLI
- Streaming and waiting-for-input pipeline states
- File list service with content-based identifiers
- Pre-ingest `list` and `process` subcommands for batch processing
- Ingest `list` and `process` subcommands for source pages from the vault
- File-loaded Zod config schema with JSON5 schema descriptor
- `PreIngestResult` discriminated union type
- `init` command tests

### Changed

- Replace `readline` with `@clack/prompts` for interactive prompts
- Data-driven CLI presentation with display config tables
- Terminal-width-aware colored list output with filename truncation
- Switch to filename-based 6-character IDs with disambiguation suffix for collisions
- Convert `Presentation` and `Operations` enum members to PascalCase
- Replace imperative `validateConfig()` with `ExolithConfigSchema.safeParse()`
- Extract shared `loadSchemaFile` helper for JSON5 schema resolution, with SourcePage schema externalized to `schemas/`
- Rename `ingest`/`pre-ingest` implementation files to `-service-impl` suffix convention
- Extract table output to `TableFormatter` interface and implementation in `core/`
- Restructure test files to mirror `src/` directory layout
- Extract source page output formatting to `templates/source-page-output.njk`
- Rename `discussKeyTakeaways` to `runDiscussion` for clarity
- Derive template context from `source-page.schema.json` properties instead of manual enumeration

### Deprecated

### Removed

- `LogSuccess` display action — superfluous, covered by outro

### Fixed

- Stop spinner on streaming transition to avoid visual artifacts
- Defer stream messages until first chunk arrives
- Cancel and SIGINT handling during pipeline execution
- Remove duplicate error output on failure
- Fix `LogSuccess` context in pre-ingest process
- Fix DeepSeek provider test mocks to return valid stream/generate results instead of throwing

### Security

## v0.1.0

- Initial release
