# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Native DeepSeek LLM provider with config-driven provider selection
- `--version` flag to CLI
- Streaming and waiting-for-input pipeline states
- File list service with content-based identifiers
- Pre-ingest `list` and `process` subcommands for batch processing

### Changed

- Replace `readline` with `@clack/prompts` for interactive prompts
- Data-driven CLI presentation with display config tables
- Switch to filename-based 6-character IDs with disambiguation suffix for collisions

### Deprecated

### Removed

### Fixed

- Stop spinner on streaming transition to avoid visual artifacts
- Defer stream messages until first chunk arrives

### Security

## v0.1.0

- Initial release
