# Environment

## Devcontainer and Docker

- **A "Rebuild Container Without Cache" does not refresh `node_modules`** — they are named volumes, only seeded when created empty. After anything touching the dependency tree, `docker compose down -v` first. Postgres data survives (`.pgdata` is a bind mount).
- **Only what `.devcontainer/docker-compose.yml` mounts under `/home/node` survives a rebuild.** Claude Code's state is bind-mounted from `.docker/.claude` (gitignored) onto `~/.claude`, and `CLAUDE_CONFIG_DIR` points there so `.claude.json` lives inside it too: sessions, memory, login and settings survive a rebuild and a `down -v`.
- The Dockerfile holds two paths: the devcontainer (`base` → `deps` → `dev-attached`, ends in `tail -f /dev/null`, processes started by hand) and the API's Render image (`deps-api-prod`, `build-api`, `serve-api`). The Angular app deploys to Pages from CI, not Docker.

## Configuration

- One `.env` at the repo root, never committed (`.env.example` is the template). Read by Docker Compose and by the API — `env.validation.ts` calls dotenv itself, walking up for `pnpm-workspace.yaml`, because the config registers run at import time.
- The Angular app reads none of it: it uses the build-time `API_URL` constant in `apps/web/angular.json`'s `define` (typed in `src/typings.d.ts`), kept in step with `API_PROTOCOL`/`API_DOMAIN`/`API_PORT`/`API_PREFIX` by hand.
- `API_BASE_URL` (`definition/api.constant.ts`) rewrites `API_URL`'s hostname to the one serving the page in debug builds, keeping scheme/port/prefix — otherwise Safari drops the session cookie as third-party. `API_CORS_ALLOWED_DOMAINS` and `API_COOKIE_DOMAIN` have to match the origin actually used.
- CORS (`main.ts`) accepts **any** origin outside production, since the app is browsed from `localhost`, `MarcBook-Air.local` and whatever LAN IP the Mac has. The mkcert certificate only carries those two names — browsing by IP needs it reissued with that IP as a SAN.

## Routing and Pages

Routes live in the path, not the hash (`SingleEntryLocationStrategy` extends `PathLocationStrategy` and turns every `pushState` into `replaceState`), under the `<base href="/">` of `index.html`. GitHub Pages has no rewrites, so `deploy.yml` copies `index.html` to `404.html` and `preview:pwa` symlinks it — `ng serve` falls back to `index.html` on its own, so only `preview:pwa` reproduces a deep-link reload as Pages serves it. `util/legacy-hash-url.ts`, called in `main.ts` before bootstrap, turns an old `#/route` link into `/route`.

## HTTP details

The three session calls opt out of cancellation, or the router's first navigation would cut off the boot-time session probe. In-flight reads and writes are counted separately on the SDK and painted by `SyncIndicatorComponent`, the header cloud whose chevrons go down while reading and up while writing.
