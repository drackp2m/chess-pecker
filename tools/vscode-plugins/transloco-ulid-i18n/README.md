# Transloco ULID i18n

An i18n-ally-flavoured VSCode extension for this repo's transloco setup. It resolves
`I18n.<scope>.<KEY>` (and `<Scope>I18n.KEY`) through the same chain the CLI uses:
`keys.ts` → NAME → ULID, `<lang>.json` → ULID → text.

It has no dependencies and no build step: the collectors are loaded straight from
`tools/scripts/i18n/` at runtime, so the extension and `pnpm i18n:check` can never drift.

## Features

- **Inline text** — the default language translation rendered _in place of_ the key usage: the whole
  `I18n.scope.KEY | i18n` collapses to the text. Put the cursor inside and the real source comes
  back, so it stays editable. The text only stands in for what would really be rendered, so what
  gets swallowed depends on what follows the key:

  | Usage                              | Shown as                           |
  | ---------------------------------- | ---------------------------------- |
  | `{{ I18n.a.B \| i18n }}`           | `{{ Log out }}`                    |
  | `[label]="I18n.a.B"`, any `.ts`    | `[label]="Log out"`                |
  | `{{ I18n.a.B }}`                   | `{{ I18n.a.B «Log out» }}`, warned |
  | `{{ (x ? I18n.a.B : …) \| i18n }}` | `{{ (x ? I18n.a.B «Log out» … }}`  |

  A key handed to a child input or held in TypeScript is a key, not a sentence, so it collapses
  the way it always did. A key sitting bare in an interpolation is the one case that _lies_: it
  renders `a.01KZ…` at runtime, so it is annotated instead of hidden, and warned about. The last
  row is the same annotation without the warning — the pipe applies further along the
  interpolation, so nothing is broken and nothing lines up to be collapsed either.

- **Hover** — every language at once, the params the key takes with the types declared in the
  generated `<scope>/params.ts`, and the raw `scope.ULID` value.
- **Go to definition** — `ctrl+click` a key to jump to its line in each `<lang>.json`. The jump to
  `keys.ts` is not listed: TypeScript and the Angular language service already resolve the property
  themselves, and listing it again only put the same line in the peek twice.
- **Navigation inside the i18n files** — the same `ctrl+click` keeps working once you are there, so
  every file of a scope is one hop from the others:

  | File          | Clicking on…                   | Goes to                              |
  | ------------- | ------------------------------ | ------------------------------------ |
  | `keys.ts`     | the name (`LOG_OUT`)           | every `.ts` / `.html` that uses it   |
  | `keys.ts`     | the value (`'scope.ULID'`)     | that ULID in each `<lang>.json`      |
  | `params.ts`   | the entry key (`'scope.ULID'`) | that ULID in each `<lang>.json`      |
  | `<lang>.json` | the ULID                       | its line in `keys.ts`                |
  | `<lang>.json` | the text                       | the same text in the other languages |

  A single target opens straight away; several open the peek list. The key name also answers
  **Find all references** (`shift+alt+F12`), which is the better view when a key is used in a
  dozen places. The usage scan reads `apps/web/src` from disk and overlays the unsaved editors, so
  a key you just typed is already there.

- **Diagnostics** — undeclared keys, missing/empty translations and keys interpolated without
  `| i18n` underlined in `.ts` and `.html`.
- **Findings** — everything `pnpm i18n:check` reports, published as problems _on the i18n files
  themselves_ and refreshed whenever any of them changes. It is the same `buildFindings()` the CLI
  calls, with the same `severityOf` and the finding type as the diagnostic code, so a stale
  `params.ts`, a param added to one language and not the other, an orphan ULID, a scope missing from
  the barrel or a key nobody uses is underlined where it lives, without waiting for the commit hook.
  It runs over the whole workspace, so those problems show up in the panel even with no i18n file
  open.
- **Completion** — scopes after `I18n.`, keys after `I18n.dashboard.` and while the key is half
  typed, each row showing its default language text on the right. A key that takes params completes
  with them: picking `PROGRAM_CURRENT_SCANS` inside `{{ I18n.dashboard.| | i18n }}` leaves
  `{{ I18n.dashboard.PROGRAM_CURRENT_SCANS | i18n: { solved: number, total: number, percentage: string } }}`
  with a tabstop on every type — <kbd>tab</kbd> through them replacing each with the real expression,
  and a last one _after_ the `}}`, so the next key is one keystroke away. That last jump happens for
  every key, params or not, whenever the completion can see the whole `| i18n }}` on the line. Inside
  `i18nRef(I18n.dashboard.|)` it appends `, { … }` the same way. The types are the ones declared in
  the generated `<scope>/params.ts`.
- **Snippet** — typing `i18n` expands to `{{ I18n.| | i18n }}` in HTML (to `I18n.|` when the cursor
  already is inside an interpolation) and to `I18n.|` in TypeScript. The TypeScript one adds
  `import { I18n } from '@app/i18n';`; the HTML one patches the sibling component instead, adding the
  same import, `protected readonly I18n = I18n;` and `I18nPipe` in `imports`. It leaves that file
  dirty on purpose, and it never touches `provideI18nScope` — a scoped key still needs it by hand.
- **Create key** — `i18n: Create translation key` picks a scope, asks for the name and one text per
  language, generates the ULID and writes `keys.ts` plus every `<lang>.json`. Languages left empty are
  not written at all, so only the default one is required. With text selected it works as an extract:
  the selection seeds the default language and is replaced by `{{ I18n.scope.KEY | i18n }}` in
  HTML — wiring the sibling component up like the snippet does — or `I18n.scope.KEY` in TypeScript.
- **Create scope** — the scope picker ends in `New scope…`: it writes `<name>/keys.ts`, an empty
  `<name>/params.ts` and an empty `<name>/<lang>.json` per language, and registers the scope in
  `i18n/index.ts` twice — the import plus the camelCased property in the `I18n` barrel, which is what
  feeds completion back, and the import plus the member in the `I18nParams` union, which is what
  types the pipe. The component still needs its
  `provideI18nScope('<name>')` by hand, which will only accept the scope once it has its first key.
- **Export / import** — `i18n: Export translations to XLIFF` picks the target languages and whether
  to send everything or only what has no target yet, and writes one bilingual **XLIFF 2.0** file per
  language into `translations/`. Each unit carries the ULID as its `id`, the constant
  (`AuthI18n.USERNAME`), where it is used and the declared param types as notes, and every
  `{{ param }}` as an `<originalData>`/`<ph>` pair, so a translator gets an atomic placeholder chip
  instead of braces they can typo. `i18n: Import translations from XLIFF` reads them back: existing
  keys are merged into the `<lang>.json` files in `keys.ts` order, and units whose ULID is not
  declared yet are offered in a multi-select — the ones you tick are appended to `keys.ts` (named
  from the exported note, or slugged from the source text) with their source written to the default
  language. Placeholders that changed shape in the target are reported without blocking the rest.
  Both commands run the same code as `pnpm i18n:export` / `pnpm i18n:import`.

## Running it

Press <kbd>F5</kbd> on the repo and pick the **i18n extension** launch configuration — it opens a
second window with the extension loaded.

To keep it always on, link it into the extensions folder and reload the window
(**Developer: Reload Window**). The repo is normally opened through the devcontainer, where the
extension host runs **inside the container** and reads `~/.vscode-server/extensions`, not the Mac's
`~/.vscode/extensions` — run this from a container terminal:

```sh
ln -sfn "$PWD/tools/vscode-plugins/transloco-ulid-i18n" ~/.vscode-server/extensions/drackp2m.transloco-ulid-i18n-0.2.0
```

The folder name has to be `<publisher>.<name>-<version>` or the scanner skips it. `.vscode-server`
lives in the container's writable layer, so the link survives a restart but not a rebuild — redo it
after `docker compose down -v`.

Opening the repo natively instead (no container) is the same command against `~/.vscode/extensions`.

## Settings

| Setting                                 | Default        | Meaning                                                           |
| --------------------------------------- | -------------- | ----------------------------------------------------------------- |
| `translocoUlidI18n.langs`               | `[]`           | Languages to resolve; empty uses `tools/scripts/i18n/config.mjs`. |
| `translocoUlidI18n.inlineText`          | `true`         | Show the inline translation.                                      |
| `translocoUlidI18n.inlineTextMaxLength` | `60`           | Where the inline text is ellipsised.                              |
| `translocoUlidI18n.transferDir`         | `translations` | Where the XLIFF export lands and the import dialog opens.         |

It also ships a `configurationDefaults` block turning `editor.suggest.showWords` off for `html` and
`typescript`, so VSCode's word-based guesses (the ones that offered `solved` or `percentage`, scraped
from the transloco params of other open files) stop competing with the real keys. Override it in
`.vscode/settings.json` to get them back.

The index rebuilds itself whenever anything under the i18n directory changes;
`i18n: Reload translation index` forces it.
