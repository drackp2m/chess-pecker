# AGENTS.md

Guidance for any coding agent working in this repository.

## Layout

pnpm workspace monorepo (`pnpm-workspace.yaml` → `apps/*`, `libs/*`):

- `apps/web` (`@chesspecker/web`) — the Angular app, everything that used to live at the root.
- `apps/api` (`@chesspecker/api`) — a NestJS API imported from another project, **not yet integrated**: it imports five packages that are not installed (`@nestjs/graphql`, `graphql`, `graphql-subscriptions`, `graphql-ws`, `@playsetonline/api-definitions`) and ten relative imports point at files left behind in the project it came from, so it does not compile yet. It _is_ covered by the root ESLint, Prettier and TypeScript config; the debt is tracked by the TODO blocks in `eslint.config.mjs` (rules) and `apps/api/tsconfig.json` (strictness flags).

The root package holds no runtime dependency — only the repo-wide toolchain (ESLint + its plugins, Stylelint, Prettier, husky, commitlint/commitizen, semantic-release) and scripts that delegate into a workspace package with `pnpm --filter`. semantic-release keeps versioning the **root** `package.json`; `@app/package` resolves there, so the version the app displays stays the released one.

## Stack

Angular 22 (standalone components, signals) with `@ngrx/signals` for state stores, RxJS, IndexedDB via `idb`. Tests run on Vitest through Angular's native builder (not Karma/Jasmine).

## Commands

**NEVER run tests, linters, or the app on your own.** Unless the user explicitly asks for it in a specific instruction, do NOT execute: `pnpm test` (or any Vitest run), `pnpm lint` / `pnpm lint:fix` (nor ESLint, Prettier, or Stylelint directly or on individual files), `pnpm start` / `ng serve` / `pnpm build`, nor install browsers (Chrome, Chromium, Playwright, etc.) or any other tooling to "see the web page" or manually verify changes. The USER is the only one who runs and verifies things. The commands below are documented for reference only.

Package manager is **pnpm** — never use npm or yarn.

The intent is to track the latest pnpm, not to stay on a pinned version. `packageManager` in package.json records whichever version is current, and three places must agree on it: that field, the `pnpm/action-setup` steps in `.github/workflows/*.yml`, and the pnpm actually installed. To move to a new one:

```sh
pnpm self-update          # updates pnpm and rewrites `packageManager`
pnpm pnpm:match --fix     # rewrites the workflow versions to match
```

`pnpm:match` (`tools/scripts/match-pnpm-version.mjs`) is the check half of that pair, and the `pre-commit` hook runs it _without_ `--fix` — so a bump that skips the second command fails the commit with a table of the mismatched jobs rather than drifting silently. Never edit the version by hand in one place only.

Every command below runs from the repo root; the Angular ones are thin `pnpm --filter @chesspecker/web run …` wrappers, so extra flags still pass through (`pnpm build --base-href /x/`).

- `pnpm start` — dev server (`ng serve`)
- `pnpm build` — production build, into `apps/web/dist/chesspecker/browser`
- `pnpm test` — run unit tests (Vitest)
- `pnpm typecheck` — `ng build --configuration typecheck` (compile only, no emit worth keeping)
- `pnpm lint` — ESLint → Stylelint → Prettier, in that order
- `pnpm lint:fix` — same three tools in `--fix`/`--write` mode, plus per-file correction counts
- `pnpm api:start` / `pnpm api:build` / `pnpm api:test` — the NestJS side

Both lint scripts go through `tools/scripts/lint/lint.mjs`, a wrapper that runs the same three tools and prints one unified, ESLint-stylish summary (clickable `file:line:col`) instead of three separate outputs. With no arguments it covers the whole repo; given paths — which is how `lint-staged` calls it — it routes each file to the right tool by extension and reports anything no tool covers. Both are invoked with `--max-warnings 0`.

`.prettierignore`'s root-anchored `/dir` entries double as the prune list for the repo walk in `walk-files.mjs`, so every new workspace package needs its `node_modules`/`dist` listed there or the whole-repo Prettier pass crawls them.

CI (`.github/workflows/deploy.yml`) runs lint+test on every push to `main`, then semantic-release, then build+deploy. `HUSKY=0` is set during the release commit to skip local hooks.

## Imports

Use the path aliases defined in `apps/web/tsconfig.json` — relative `./` and `../` imports are blocked by an ESLint rule (`no-restricted-imports`):
`@app/component`, `@app/definition`, `@app/directive`, `@app/guard`, `@app/layout`, `@app/model`, `@app/page`, `@app/pipe`, `@app/repository`, `@app/service`, `@app/store`, `@app/strategy`, `@app/use-case`, `@app/util`, `@app/package`.

The root-level singletons have their own exact aliases (no `/*`): `@app/app.config`, `@app/app.routes`, `@app/app.component` — used e.g. from `apps/web/src/main.ts`.

## Architecture

`apps/web/src/app/` follows a clean-architecture-flavored split: `repository/` (data access), `use-case/` (business logic), `store/` (`@ngrx/signals` state), `service/`, `directive/`, `component/`, `layout/`, `page/`, `pipe/`, `model/`, `definition/`, `util/`, `strategy/`.

## Code style

TypeScript is strict beyond Angular CLI defaults. The baseline lives in the root `tsconfig.base.json`, which every package extends: `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`, `noImplicitReturns`, `noPropertyAccessFromIndexSignature`, `noFallthroughCasesInSwitch`. `apps/web` adds Angular's `strictTemplates`, `strictInjectionParameters`, `strictInputAccessModifiers`, `strictStandalone`; `apps/api` still relaxes five of the base flags under a TODO. A package that cannot meet the baseline relaxes the specific flag with a TODO — never by dropping the `extends`.

- **TypeScript 6 no longer auto-includes every `@types/*` package**, so each tsconfig must declare `types` explicitly or globals like `expect`/`it` go missing. `apps/web` splits it across `tsconfig.app.json` (`[]`) and `tsconfig.spec.json` (`["vitest/globals"]`); `apps/api` across `tsconfig.json` (`["node", "jest"]`) and `tsconfig.build.json` (`["node"]`). A new package that skips this compiles until the first test file.
- Component selector prefix is `app`; directives are camelCase, components are kebab-case.
- Component class names must end in `Layout`, `Page`, `Modal`, or `Component`.
- Keep files under 250 lines and functions under 75 lines. Both rules are `warn`, but `pnpm lint` runs with `--max-warnings 0`, so a warning fails the lint run, the `pre-commit` hook and CI exactly like an error. Both count with `skipComments: true`, so comments are free.
- Prettier: printWidth 100, single quotes, trailing commas everywhere, Angular parser for `*.html`.
- SCSS: `stylelint-config-standard-scss` + `stylelint-config-clean-order`; short hex colors, no named colors.
- **Do NOT add comments (or docstrings/JSDoc) to the code you generate.** No exceptions unless the user explicitly asks for a comment.

## Communication

**Explain things ONCE — never repeat yourself.** Do not narrate an explanation while thinking/editing files and then restate the same explanation again in the closing summary. Decide where and when to explain each thing and say it a single time.

## Commits and branches

Commit messages are enforced by commitlint with a strict gitmoji + conventional-commit format: `<emoji> <type>: <subject>` (10–75 char subject, ≤100 char header). Fixed emoji↔type pairs (from `.commitlintrc.mjs`): ✨ feat, 🐛 fix, ♻️ refactor, 🎨 style, 🧪 test, 📚 docs, 🚀 perf, 🏗️ build, 💻 ci, 🎒 chore, ⏪ revert. Husky's `prepare-commit-msg` hook runs commitlint and falls back to interactive `git cz` on failure — write commits in this format directly to avoid the interactive fallback.

Work is committed directly to `dev`; `main` is only updated via PR from `dev` (see `pnpm git:sync` / `tools/scripts/sync-git-main.sh`), which triggers semantic-release.

`CHANGELOG.md` is auto-generated by semantic-release on release — never hand-edit it.

## Misc

- **A "Rebuild Container Without Cache" does not refresh `node_modules`.** The three `node_modules` paths are named volumes (`docker-compose.yml`), and Docker only seeds a named volume from the image when the volume is created empty — an existing one keeps its old contents no matter how the image was rebuilt. After anything that changes the dependency tree, the rebuild has to be `docker compose down -v` first. `-v` only drops the named volumes; the Postgres data survives because `.pgdata` is a bind mount, not a volume.
- The Dockerfile holds exactly two paths: the devcontainer (`base` → `deps` → `dev-attached`, which ends in `tail -f /dev/null` and runs no process — you start them by hand) and the API's Render image (`deps-api-prod`, `build-api`, `serve-api`). The Angular app is not built by Docker; it deploys to GitHub Pages from CI.
- A single `.env` at the repo root, **never committed** (`.env.example` is the tracked template — `cp .env.example .env` on a fresh clone, or `docker compose up` fails with an empty `${APP_PORT}`). Two consumers read it: Docker Compose, which only ever looks next to `docker-compose.yml`, and the NestJS API. The API cannot use `ConfigModule`'s `envFilePath` for this — `shared/module/config/register/*.ts` call `validate(process.env)` at import time, before Nest instantiates anything — so `env.validation.ts` calls dotenv itself, resolving the root by walking up for `pnpm-workspace.yaml` so it works whatever the cwd. The Angular app reads none of it.
- Husky's `pre-commit` hook runs, in order: `pnpm:match`, `lint-staged` (which auto-fixes ESLint/Prettier/Stylelint per staged file — most style issues never need manual fixing), `pnpm typecheck`, and the test suite.
- `pnpm update:deps` (`tools/scripts/update-deps.sh`) is the only supported way to bump dependencies: packages carrying `ng-update` migrations (Angular, `@ngrx/signals`) go through a single `ng update` call inside `apps/web` so their schematics run, and only then does `pnpm -r up --latest` handle the rest. It refuses to run on a dirty tree. `angular-eslint` is the exception — it lives at the root because the shared `eslint.config.mjs` imports it, so pnpm bumps it and its migrations must be applied by hand on a major.
