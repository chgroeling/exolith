# AGENTS.md

An LLM-maintained wiki — compile knowledge once, query it forever.

> [Technical design →](docs/architecture.md)

## Running the project

| Command          | Description                        |
|------------------|------------------------------------|
| `pnpm dev`       | Run TypeScript directly via tsx (hot-reload) |
| `pnpm build`     | Bundle to `dist/` with tsup        |
| `pnpm start`     | Run the compiled CLI               |
| `pnpm test`      | Run Vitest test suite              |
| `pnpm lint`      | Run Biome linter                   |
| `pnpm format`    | Run Biome formatter (in-place fix) |

## Project Structure

```
exolith/
├── src/
├── tests/
├── docs/
├── dist/
├── package.json
├── tsconfig.json
├── biome.json
└── AGENTS.md
```

## Biome

Linting and formatting are handled by [Biome](https://biomejs.dev). Configuration lives in `biome.json`.

- `pnpm lint` — check for lint errors (CI-safe)
- `pnpm format` — auto-format all source files

Biome also provides IDE integrations for VS Code and JetBrains — install the official extension for real-time feedback.

## Logging

Pino — default to `pino({ name: '<module>' })`.

## Code Style

- Spaces for indentation (2 spaces)
- Single quotes, semicolons, trailing commas
- Use descriptive variable/function names

## Design Principles

Document architecture and principles — not specific files or implementations.

### Module-Spec Alignment

One source file per specification document. Reference the spec(s) in the top comment. Never mix concerns across module boundaries.

### Dependency Inversion

The consumer owns the interface. The implementation module conforms structurally — no imports between them.

**Logging is the sole exception:** import and use `pino` directly. Do not abstract logging behind an interface.

### Test Strategy

One test file per source module. Mock dependencies at module boundaries. Assert only the module's own logic, never the behavior of its dependencies.

### Constructor Options, Not Per-Call

Set configuration once at construction. No options arguments on methods.

## Git Workflow

- ALWAYS remove temporary and debug files before committing
- ALWAYS run `pnpm test` before committing
- NEVER use `git push --force` on the main branch
- Use `git push --force-with-lease` for feature branches if needed
- Use conventional commits style for git commit messages
- Use conventional commits style to describe GitHub PR titles
