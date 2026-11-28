# Tooling, CI and hooks

## Root scripts

The root package holds no runtime dependency — only the repo-wide toolchain and scripts that delegate with `pnpm --filter`. semantic-release versions the **root** `package.json`; `@app/package` resolves there.

- `pnpm lint` / `pnpm lint:fix` — ESLint → Stylelint → Prettier, in that order, through `tools/scripts/lint/lint.mjs` (one unified stylish summary, `--max-warnings 0`).
- `pnpm update:deps` — the only supported way to bump deps: `ng update` inside `apps/web` for packages with migrations (Angular, `@ngrx/signals`), then `pnpm -r up --latest`. Refuses a dirty tree. `angular-eslint` lives at the root and its majors are migrated by hand.
- `pnpm test:tools` — `tools/scripts/test/tools-test.mjs`, a Vitest-shaped reporter that drives `node:test`'s programmatic `run()` over `tools/scripts/**/*.test.mjs`, one file at a time. No Vitest here: `tools/` is not a workspace package.
- `pnpm test:lock` — verifies the test files recorded in `tools/test-lock.json` still hash to what was locked (sha256 of the content, CRLF-normalized). Only the files in the lock are checked: the rest of the suite is free to change. `test:lock:select` (re)builds the list, `--update` re-hashes it, `--list` prints it, a positional path scopes any mode to a subtree. Only the user re-locks.
- `pnpm git:sync` opens the PR from `dev` to `main`; `pnpm pnpm:match` checks the pnpm version (below).
- `start:safari` (both packages) — plain HTTP with TLS terminated in front, because neither server's own TLS works in Safari: `sh tools/scripts/start-safari.sh --source <port> [--target <port>] [--host <name>] [--env KEY=VALUE]... -- <command…>`.

API tests: `test` is unit (`src/**/*.spec.ts`), `test:integration` is `src/**/*.test.ts` against real Postgres (needs `chesspecker-db` up; `NODE_ENV=test` switches to `DB_NAME_TEST`, and a `globalSetup` drops the schema and replays every migration, so a mismatched migration fails there first). Both Vitest projects live in one config, so always go through the scripts rather than a bare `vitest`. `migration:create` needs the `chesspecker-db` container up; `migration:check` lists pending, `migration:execute` applies.

## Branches

Work is committed directly to `dev`; `main` is only updated via PR from `dev` (`pnpm git:sync`), which triggers semantic-release. commitlint enforces the gitmoji + conventional format; the `prepare-commit-msg` hook falls back to interactive `git cz` when the message fails it.

## pnpm version

`packageManager`, the `pnpm/action-setup` steps and the installed pnpm must agree. `packageManager` is the source of truth — the Dockerfile only bootstraps a floating `pnpm@11` via npm, and pnpm's `managePackageManagerVersions` downloads and delegates to the pinned version inside the repo. Bump by editing `packageManager` (or `pnpm self-update`, which writes the same field) then `pnpm pnpm:match --fix` — never edit the workflows by hand; the `pre-commit` hook checks it.

## CI

`.github/workflows/ci.yml` on **PRs to `main`**: `lint` (definitions typecheck, `test:tools`, `i18n:check`, then ESLint/Stylelint/Prettier), `web` (production build, then Vitest), `api` (typecheck, unit, integration, `nest build`). The compile gate goes before the suites in both, and `pnpm test:lock <package>` right after it, so a tampered test file fails before the suite runs. The `api` job runs a `services: postgres` standing in for `chesspecker-db`, with the full env block declared on the integration step. `.github/workflows/deploy.yml` on **push to `main`** does no checking: semantic-release → build → Pages.

Every job writes a step summary through `tools/scripts/*/summary.mjs` (log parsers, no-ops locally, never fail a job).

## Hooks

Husky's `pre-commit` covers the same ground in order: `pnpm:match`, `lint-staged` (auto-fixes per staged file), `test:lock` (after `lint-staged`, so a formatting fix is already in the file when it is hashed, and ahead of every suite, as in CI), `test:tools` (necessarily before `i18n:check --fix`, which rewrites `params.ts` with the very code those suites cover), `i18n:check --fix`, then the two compile gates (API `typecheck`, web `typecheck`) and only then the suites — API `test` + `test:integration`, web `test`. It needs `chesspecker-db` up.

## TypeScript config

Strict baseline in the root `tsconfig.base.json`, extended by every package. A package that cannot meet the baseline relaxes the specific flag with a TODO — never by dropping the `extends`. `libs/api-definitions` is compiled with `skipLibCheck` off (the `lint` job runs that typecheck).

TypeScript 6 no longer auto-includes `@types/*`, so each tsconfig declares `types` explicitly or globals like `expect`/`it` go missing: web splits `tsconfig.app.json` (`[]`) / `tsconfig.spec.json` (`["vitest/globals"]`), api splits `tsconfig.json` (`["node", "vitest/globals"]`) / `tsconfig.build.json` (`["node"]`).

`.prettierignore`'s root-anchored `/dir` entries double as the prune list for `walk-files.mjs`, so every new package needs its `node_modules`/`dist` listed there.
