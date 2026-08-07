# Transloco ULID i18n

An i18n-ally-flavoured VSCode extension for this repo's transloco setup. It resolves
`I18n.<scope>.<KEY>` (and `<Scope>I18n.KEY`) through the same chain the CLI uses:
`keys.ts` → NAME → ULID, `<lang>.json` → ULID → text.

It has no dependencies and no build step: the collectors are loaded straight from
`tools/scripts/i18n/` at runtime, so the extension and `pnpm i18n:check` can never drift.

## Features

- **Inline text** — the default language translation rendered _in place of_ the key usage: the whole
  `I18n.scope.KEY | transloco` collapses to the text. Put the cursor inside and the real source comes
  back, so it stays editable.
- **Hover** — every language at once, plus the raw `scope.ULID` value.
- **Go to definition** — `ctrl+click` a key to jump to its line in each `<lang>.json` and in `keys.ts`.
- **Diagnostics** — undeclared keys and missing/empty translations underlined in `.ts` and `.html`.
- **Completion** — scopes after `I18n.`, keys (with their text) after `I18n.dashboard.`.
- **Create key** — `i18n: Create translation key` picks a scope, asks for the name and one text per
  language, generates the ULID and writes `keys.ts` plus every `<lang>.json`. With text selected it
  works as an extract: the selection seeds the default language and is replaced by
  `{{ I18n.scope.KEY | transloco }}` in HTML, or `I18n.scope.KEY` in TypeScript.

## Running it

Press <kbd>F5</kbd> on the repo and pick the **i18n extension** launch configuration — it opens a
second window with the extension loaded.

To keep it always on, link it into the extensions folder and reload the window
(**Developer: Reload Window**). The repo is normally opened through the devcontainer, where the
extension host runs **inside the container** and reads `~/.vscode-server/extensions`, not the Mac's
`~/.vscode/extensions` — run this from a container terminal:

```sh
ln -sfn "$PWD/tools/vscode-plugins/transloco-ulid-i18n" ~/.vscode-server/extensions/drackp2m.transloco-ulid-i18n-0.1.1
```

The folder name has to be `<publisher>.<name>-<version>` or the scanner skips it. `.vscode-server`
lives in the container's writable layer, so the link survives a restart but not a rebuild — redo it
after `docker compose down -v`.

Opening the repo natively instead (no container) is the same command against `~/.vscode/extensions`.

## Settings

| Setting                                 | Default | Meaning                                                           |
| --------------------------------------- | ------- | ----------------------------------------------------------------- |
| `translocoUlidI18n.langs`               | `[]`    | Languages to resolve; empty uses `tools/scripts/i18n/config.mjs`. |
| `translocoUlidI18n.inlineText`          | `true`  | Show the inline translation.                                      |
| `translocoUlidI18n.inlineTextMaxLength` | `60`    | Where the inline text is ellipsised.                              |

The index rebuilds itself whenever anything under the i18n directory changes;
`i18n: Reload translation index` forces it.
