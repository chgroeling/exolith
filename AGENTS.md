# AGENTS.md

## Running the project

| Command          | Description                        |
|------------------|------------------------------------|
| `pnpm dev`       | Run TypeScript directly via tsx (hot-reload) |
| `pnpm build`     | Bundle to `dist/` with tsup        |
| `pnpm start`     | Run the compiled CLI               |
| `pnpm test`      | Run Vitest test suite              |
| `pnpm lint`      | Run Biome linter                   |
| `pnpm format`    | Run Biome formatter (in-place fix) |

## Biome

Linting and formatting are handled by [Biome](https://biomejs.dev). Configuration lives in `biome.json`.

- `pnpm lint` — check for lint errors (CI-safe)
- `pnpm format` — auto-format all source files

Biome also provides IDE integrations for VS Code and JetBrains — install the official extension for real-time feedback.

## Code Style

- Spaces for indentation (2 spaces)
- Single quotes, semicolons, trailing commas
- Use descriptive variable/function names

## Git Workflow

- ALWAYS remove temporary and debug files before committing
- ALWAYS run `pnpm test` before committing
- NEVER use `git push --force` on the main branch
- Use `git push --force-with-lease` for feature branches if needed
- Use conventional commits style for git commit messages
- Use conventional commits style to describe GitHub PR titles
