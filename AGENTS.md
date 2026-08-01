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

**NEVER run tests, linters, or the app on your own.** Unless the user explicitly asks for it in a specific instruction, do NOT execute: any test run (Vitest, `pnpm --filter … test`, `test:integration`), `pnpm lint` / `pnpm lint:fix` (nor ESLint, Prettier, or Stylelint directly or on individual files), any dev server or build (`ng serve`, `nest start`, `pnpm --filter … build`), nor install browsers (Chrome, Chromium, Playwright, etc.) or any other tooling to "see the web page" or manually verify changes. The USER is the only one who runs and verifies things. The commands below are documented for reference only.

Package manager is **pnpm** — never use npm or yarn.

The intent is to track the latest pnpm, not to stay on a pinned version. `packageManager` in package.json records whichever version is current, and three places must agree on it: that field, the `pnpm/action-setup` steps in `.github/workflows/*.yml`, and the pnpm actually installed. To move to a new one:

```sh
pnpm self-update          # updates pnpm and rewrites `packageManager`
pnpm pnpm:match --fix     # rewrites the workflow versions to match
```

`pnpm:match` (`tools/scripts/match-pnpm-version.mjs`) is the check half of that pair, and the `pre-commit` hook runs it _without_ `--fix` — so a bump that skips the second command fails the commit with a table of the mismatched jobs rather than drifting silently. Never edit the version by hand in one place only.

The root `package.json` holds **only** repo-wide scripts. There are no `pnpm start` / `pnpm test` / `pnpm api:*` wrappers — everything that belongs to a package lives in `apps/web/package.json` or `apps/api/package.json` and runs as `pnpm --filter @chesspecker/<web|api> <script>`, from anywhere in the repo. Extra flags pass straight through (`pnpm --filter @chesspecker/web build --base-href /x/`).

Root:

- `pnpm lint` — ESLint → Stylelint → Prettier, in that order
- `pnpm lint:fix` — same three tools in `--fix`/`--write` mode, plus per-file correction counts
- `pnpm update:deps`, `pnpm git:sync`, `pnpm pnpm:match` — see below

`pnpm --filter @chesspecker/web …`:

- `start` — dev server (`ng serve`)
- `build` — production build, into `apps/web/dist/chesspecker/browser`
- `test` — unit tests (Vitest)
- `typecheck` — `ng build --configuration typecheck` (compile only, no emit worth keeping)
- `preview:pwa` — serve the built app over HTTPS so the service worker is exercised

`pnpm --filter @chesspecker/api …`:

- `start` / `start:dev` — Nest, once or in watch mode; `start:debug` adds the inspector, `start:prod` runs `dist/main`
- `build` — `nest build`
- `test` — unit tests (Vitest `unit` project: `src/**/*.spec.ts`, no I/O)
- `test:watch`, `test:cov`, `test:debug` — same project, watching / with coverage / with the inspector
- `test:integration` — the `integration` project (`src/**/*.test.ts`), against real Postgres. Needs the `chesspecker-db` container up; the script sets `NODE_ENV=test`, which is what switches `database-config.ts` to `DB_NAME_TEST` (`chesspecker_test`, created alongside the dev one by `tools/container/postgresql-multiple-databases.sh`). A `globalSetup` drops the schema and replays every migration before the run, and refuses to start if `NODE_ENV` is anything but `test`. Both projects live in the single `apps/api/vitest.config.ts`; a bare `vitest` with no `--project` would run both, so always go through the scripts.
- `migration:create` / `migration:check` / `migration:execute` — MikroORM CLI, reading `MIKRO_ORM_CLI_CONFIG` from the compose environment

`pnpm --filter @chesspecker/web start:safari` and `pnpm --filter @chesspecker/api start:safari` — the same two servers over plain HTTP with TLS terminated in front of them. **Safari needs this for both**: neither server's own TLS works there, and the proxy answers HTTP/1.1 with the same mkcert pair. One generic script covers both — `sh tools/scripts/start-safari.sh --source <port> [--target <port>] [--host <name>] [--env KEY=VALUE]... -- <command…>` — where `--target` defaults to `source + 1`, `--host` only decorates the URL it prints, and everything after `--` is run through `env` with the given assignments. It delegates the TLS half to `tools/scripts/tls-proxy.sh`, which is usable on its own. The API's entry passes `--env API_PROTOCOL=http`, which is what stops `BootstrapHelper` from adding `httpsOptions`, plus `--env API_PORT=3001` so Nest listens where the proxy forwards.

Both lint scripts go through `tools/scripts/lint/lint.mjs`, a wrapper that runs the same three tools and prints one unified, ESLint-stylish summary (clickable `file:line:col`) instead of three separate outputs. With no arguments it covers the whole repo; given paths — which is how `lint-staged` calls it — it routes each file to the right tool by extension and reports anything no tool covers. Both are invoked with `--max-warnings 0`.

`.prettierignore`'s root-anchored `/dir` entries double as the prune list for the repo walk in `walk-files.mjs`, so every new workspace package needs its `node_modules`/`dist` listed there or the whole-repo Prettier pass crawls them.

CI (`.github/workflows/deploy.yml`) runs lint+test on every push to `main`, then semantic-release, then build+deploy. `HUSKY=0` is set during the release commit to skip local hooks. The `test` job runs `pnpm --filter @chesspecker/web test` only, and Husky's `pre-commit` also covers web alone (`typecheck` + `test`) — **nothing runs the API suite automatically yet**. Adding it needs an env file in the job first: seven specs reach `shared/module/config/register/*`, which call `validate(process.env)` at import time and throw on a missing variable, and CI has no `.env`.

## Imports

Use the path aliases defined in `apps/web/tsconfig.json` — relative `./` and `../` imports are blocked by an ESLint rule (`no-restricted-imports`):
`@app/component`, `@app/definition`, `@app/directive`, `@app/guard`, `@app/interceptor`, `@app/layout`, `@app/model`, `@app/page`, `@app/pipe`, `@app/repository`, `@app/service`, `@app/store`, `@app/strategy`, `@app/use-case`, `@app/util`, `@app/package`.

The root-level singletons have their own exact aliases (no `/*`): `@app/app.config`, `@app/app.routes`, `@app/app.component` — used e.g. from `apps/web/src/main.ts`.

## Architecture

`apps/web/src/app/` follows a clean-architecture-flavored split: `repository/` (data access), `use-case/` (business logic), `store/` (`@ngrx/signals` state), `service/`, `directive/`, `component/`, `layout/`, `page/`, `pipe/`, `model/`, `definition/`, `util/`, `strategy/`.

## Database

The entities under `apps/api/src/module/**/*.entity.ts` are the single source of truth for the schema — **never write or edit a migration by hand**. Change the entity first, then let the MikroORM CLI diff it against the database and emit the file: `pnpm --filter @chesspecker/api migration:create`. A hand-written migration drifts from what the ORM believes the schema is, and the next generated diff tries to "fix" the difference.

`migration:create` needs the `chesspecker-db` container up, since it diffs against a live database. `migration:check` lists what is pending, `migration:execute` applies it. The integration suite replays every migration from scratch, so a migration that does not match its entity fails there first.

Migrations are generated artifacts, so no linter touches them: `/apps/api/migrations` is in `.prettierignore` and `apps/api/migrations/**` in the `eslint.config.mjs` ignores. The CLI writes them and its formatting is not ours to reflow. That also retired the folder's own `tsconfig.json`, which existed only to give the type-aware ESLint pass a project — the MikroORM CLI runs the migrations through ts-node with `apps/api/tsconfig.json` and needs nothing extra.

## Code style

TypeScript is strict beyond Angular CLI defaults. The baseline lives in the root `tsconfig.base.json`, which every package extends: `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`, `noImplicitReturns`, `noPropertyAccessFromIndexSignature`, `noFallthroughCasesInSwitch`. `apps/web` adds Angular's `strictTemplates`, `strictInjectionParameters`, `strictInputAccessModifiers`, `strictStandalone`; `apps/api` still relaxes five of the base flags under a TODO. A package that cannot meet the baseline relaxes the specific flag with a TODO — never by dropping the `extends`.

- **TypeScript 6 no longer auto-includes every `@types/*` package**, so each tsconfig must declare `types` explicitly or globals like `expect`/`it` go missing. `apps/web` splits it across `tsconfig.app.json` (`[]`) and `tsconfig.spec.json` (`["vitest/globals"]`); `apps/api` across `tsconfig.json` (`["node", "vitest/globals"]`) and `tsconfig.build.json` (`["node"]`, which also excludes `src/shared/test/**` so the integration helpers stay out of `dist`). A new package that skips this compiles until the first test file.
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

**Never add a `Co-Authored-By` trailer for yourself.** Some agents append one by default; here it makes the commit show up as "drackp2m and <agent> committed" on GitHub, and the commits of this repository are the user's alone. Commit messages carry no authorship attribution beyond the git identity already configured.

Work is committed directly to `dev`; `main` is only updated via PR from `dev` (see `pnpm git:sync` / `tools/scripts/sync-git-main.sh`), which triggers semantic-release.

`CHANGELOG.md` is auto-generated by semantic-release on release — never hand-edit it.

## Misc

- **A "Rebuild Container Without Cache" does not refresh `node_modules`.** The three `node_modules` paths are named volumes (`docker-compose.yml`), and Docker only seeds a named volume from the image when the volume is created empty — an existing one keeps its old contents no matter how the image was rebuilt. After anything that changes the dependency tree, the rebuild has to be `docker compose down -v` first. `-v` only drops the named volumes; the Postgres data survives because `.pgdata` is a bind mount, not a volume.
- The Dockerfile holds exactly two paths: the devcontainer (`base` → `deps` → `dev-attached`, which ends in `tail -f /dev/null` and runs no process — you start them by hand) and the API's Render image (`deps-api-prod`, `build-api`, `serve-api`). The Angular app is not built by Docker; it deploys to GitHub Pages from CI.
- A single `.env` at the repo root, **never committed** (`.env.example` is the tracked template — `cp .env.example .env` on a fresh clone, or `docker compose up` fails with an empty `${APP_PORT}`). Two consumers read it: Docker Compose, which only ever looks next to `docker-compose.yml`, and the NestJS API. The API cannot use `ConfigModule`'s `envFilePath` for this — `shared/module/config/register/*.ts` call `validate(process.env)` at import time, before Nest instantiates anything — so `env.validation.ts` calls dotenv itself, resolving the root by walking up for `pnpm-workspace.yaml` so it works whatever the cwd. The Angular app reads none of it: the API origin it calls (`AuthRepository`) is the build-time `API_URL` constant in `apps/web/angular.json`'s `define`, declared in `apps/web/src/typings.d.ts` — it mirrors `API_PROTOCOL`/`API_DOMAIN`/`API_PORT`/`API_PREFIX` and has to be kept in step with them by hand. **A `define` block inside a configuration replaces the one in `options` outright — it is not merged**, so every new constant has to be repeated in `configurations.development` or it is missing under `ng serve` only, and the app dies with `ReferenceError: Can't find variable: …` where nothing looks wrong in the code.
- `API_BASE_URL` (`definition/api.constant.ts`) is what the repository actually calls: in a debug build it rewrites `API_URL`'s hostname to the one the page is served from, keeping the scheme, port and prefix. Serving the app on `MarcBook-Air.local` (which `start:safari` does, and Safari needs) while the API stayed on `localhost` would make the two cross-site, and Safari drops the session cookie as third-party — the login returns 204 and no session ever sticks. Both hosts are on the mkcert certificate, so the API answers on either. The `.env` side has to follow: `API_CORS_ALLOWED_DOMAINS` needs the origin actually used, and `API_COOKIE_DOMAIN` has to match the host serving the API or the browser rejects the cookie.
- The session cookies are `httpOnly`, so the web app cannot read them: `SessionStore` probes `GET /auth/refresh-session` on startup and treats a 401 as "logged out".
- CORS (`main.ts`) accepts **any** origin outside `production`: the app is browsed from `localhost`, from `MarcBook-Air.local` and from whatever LAN IP the Mac has that day, and a static `API_CORS_ALLOWED_DOMAINS` turns every one of those into a silent `WARN Origin … not allowed by CORS policy` with no clue on the browser side. The allowlist is still what production uses. Note the certificate only carries `DNS:MarcBook-Air.local, DNS:localhost` — browsing by IP needs it reissued with that IP as a SAN.
- Husky's `pre-commit` hook runs, in order: `pnpm:match`, `lint-staged` (which auto-fixes ESLint/Prettier/Stylelint per staged file — most style issues never need manual fixing), `pnpm typecheck`, and the test suite.
- `pnpm update:deps` (`tools/scripts/update-deps.sh`) is the only supported way to bump dependencies: packages carrying `ng-update` migrations (Angular, `@ngrx/signals`) go through a single `ng update` call inside `apps/web` so their schematics run, and only then does `pnpm -r up --latest` handle the rest. It refuses to run on a dirty tree. `angular-eslint` is the exception — it lives at the root because the shared `eslint.config.mjs` imports it, so pnpm bumps it and its migrations must be applied by hand on a major.
