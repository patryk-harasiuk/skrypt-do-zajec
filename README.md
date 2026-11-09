# skrypt-do-zajec

Biblioteka (TypeScript, Web Components) wyświetlająca skrypty do zajęć zapisane w Markdown
w interaktywnej formie. Plan prac: [docs/PLAN.md](docs/PLAN.md).

## Struktura

- `packages/core`: parser Markdown → `ScriptDocument` (bez DOM i bez Lit)
- `apps/playground`: podgląd wyniku parsera na plikach z `fixtures/`
- `fixtures/`: przykładowe skrypty i przypadki brzegowe

## Polecenia

```sh
pnpm install
pnpm dev          # playground (Vite)
pnpm test         # Vitest
pnpm lint
pnpm typecheck
pnpm format:check
```

Wymagania: Node.js 22+, pnpm.
