# AGENTS.md

An LLM-maintained wiki — compile knowledge once, query it forever.

> [Technical design →](docs/architecture.md)

## Running the project

| Command            | Description                           |
|--------------------|---------------------------------------|
| `pnpm dev`         | Run TypeScript directly via tsx (hot-reload) |
| `pnpm build`       | Bundle to `dist/` with tsup           |
| `pnpm start`       | Run the compiled CLI                  |
| `pnpm test`        | Run Vitest test suite                 |
| `pnpm typecheck`   | Run TypeScript type checker           |
| `pnpm lint`        | Run Biome linter                      |
| `pnpm format`      | Run Biome formatter (in-place fix)    |

## Project Structure

```
exolith/
├── src/
│   ├── index.ts                  Entry point — delegates to cli/
│   ├── core/                     Domain model, cross-cutting primitives
│   ├── infrastructure/           External dependency adapters (LLM, templates)
│   ├── operations/               Business operations (enqueue, ingest, compile, lint, …)
│   ├── composition/              DI composition root — wires the object graph
│   ├── cli/                      CLI parsing and bootstrap
│   └── tui/                      Terminal UI (Ink / React)
├── tests/                        Test files mirror src/ directory structure
├── docs/                         Specifications (tech-free)
├── templates/                    Nunjucks prompt templates
├── dist/
├── package.json
├── tsconfig.json
├── biome.json
└── AGENTS.md
```

## Quality Gate

Before committing, run all three checks sequentially:

```
pnpm typecheck && pnpm lint && pnpm test
```

All three must pass with zero errors. Fix any failures before staging.

## Biome

Linting and formatting are handled by [Biome](https://biomejs.dev). Configuration lives in `biome.json`.

- `pnpm lint` — check for lint errors (CI-safe)
- `pnpm format` — auto-format all source files

Biome also provides IDE integrations for VS Code and JetBrains — install the official extension for real-time feedback.

## TSDoc

Every file, class, interface, public method, and property must carry a TSDoc (`/** ... */`) comment. Describe the purpose, the contract, and any non-obvious behavior. No inline comments (`//`). Private methods may omit TSDoc when their purpose is self-evident from the name.

## Logging

Pino — default to `pino({ name: '<module>' })`.

- Methods that need a logger must create a child logger with the method name as the `method_name` key: `const log = this.logger.child({ method_name: '<methodName>' });`. Use the actual JavaScript method name — never an alias or abbreviated form.

## Code Style

- Spaces for indentation (2 spaces)
- Single quotes, semicolons, trailing commas
- Use descriptive variable/function names
- Enum (union type) members must use PascalCase — `'ExtractingSourcePage'`, never `'extracting-source-page'` or `'extracting_source_page'`

## Design Principles

Document architecture and principles — not specific files or implementations.

### Module-Spec Alignment

One source file per specification document. Reference the spec(s) in the top comment. Never mix concerns across module boundaries.

### Dependency Inversion

The consumer owns the interface. The implementation module conforms structurally — no imports between them.

**Logging is the sole exception:** import and use `pino` directly. Do not abstract logging behind an interface.

### Test Strategy

One test file per source module. Tests mirror the `src/` directory structure. Mock dependencies at module boundaries. Assert only the module's own logic, never the behavior of its dependencies.

Example: `tests/core/slugger.test.ts` tests `src/core/slugger-service-impl.ts`.

### Constructor Options, Not Per-Call

Set configuration once at construction. No options arguments on methods.

**Presentation callbacks are NOT configuration.** Separate pure configuration (limits, paths) from presentation adapters (streaming output, user input) into distinct interfaces injected at construction time. This keeps business logic free of UI concerns.

### Module Layout — Vertical by Domain

Source modules are organized vertically by domain concept, not horizontally by technical layer. Each module directory contains its interface, implementation(s), and all related files co-located:

| Directory | Purpose |
|-----------|---------|
| `src/core/` | Domain model, cross-cutting primitives (types, identifier, slug) |
| `src/infrastructure/` | External dependency adapters — one sub-directory per dependency (currently `llm/`, `prompt/`) |
| `src/operations/` | Business operations — one sub-directory per operation (currently `enqueue/`, `ingest/`, future `compile/`, `lint/`, …) |
| `src/composition/` | DI composition root — wires the full object graph |
| `src/cli/` | CLI parsing and entry point |
| `src/tui/` | Terminal UI presentation layer |

**Rationale:** Co-location makes the module self-contained — all code for one concept lives together. New operations add directories without bloating a flat root.

### Interface Contracts

Every implementation class must use the `implements` keyword to formally declare the interface it satisfies. This documents the contract, produces precise compiler errors when the interface changes, and makes the architecture visible in code.

```typescript
// Correct
export class IdentifierServiceImpl implements IdentifierService { … }

// Incorrect — structural conformance only, invisible contract
export class IdentifierServiceImpl { … }
```

### Return Types

Public methods of implementation classes must declare their return type as the **interface**, never the concrete class. This prevents consumers from depending on implementation details.

```typescript
// Correct
createSession(systemPrompt: string): LlmSession { … }

// Incorrect — leaks concrete type
createSession(systemPrompt: string): LlmSessionImpl { … }
```

### Provider Naming

Provider implementations go in `src/infrastructure/<domain>/`. They implement `*Provider` interfaces and are named `*Provider` (not `*Service`). The directory name matches the infrastructure domain, not the vendor.

```
src/infrastructure/llm/
├── llm-provider.ts              # LlmProvider interface
├── openrouter-llm-provider.ts   # OpenRouterLlmProvider
├── llm-service.ts               # LlmService interface (consumer-facing)
├── llm-service-impl.ts          # LlmServiceImpl (adapter)
└── llm-session-impl.ts          # LlmSessionImpl
```

### Service Layer

Services are abstracted behind interfaces. The interface lives in the same module directory as its implementation — not scattered across a flat `src/` root. Implementations are suffixed `*Impl`.

When a service wraps an external dependency (e.g., an AI SDK), introduce a provider interface (`*-provider.ts`) and use an adapter `*ServiceImpl` to translate between the two interfaces. This keeps the consumer decoupled from any specific provider implementation.

## Git Workflow

- ALWAYS remove temporary and debug files before committing
- ALWAYS run the quality gate (`pnpm typecheck && pnpm lint && pnpm test`) before committing
- NEVER use `git push --force` on the main branch
- Use `git push --force-with-lease` for feature branches if needed
- Use conventional commits style for git commit messages
- Use conventional commits style to describe GitHub PR titles
