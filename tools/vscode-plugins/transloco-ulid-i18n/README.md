# Transloco ULID i18n

An i18n-ally-flavoured VSCode extension for this repo's transloco setup. It resolves
`I18n.<scope>.<KEY>` (and `<Scope>I18n.KEY`) through the same chain the CLI uses:
`keys.ts` → NAME → ULID, `<lang>.json` → ULID → text.

It has no dependencies and no build step: the collectors are loaded at runtime from the
`@drackp2m/transloco-ulid-cli` installed in the workspace, so the extension and
`transloco-ulid check` can never drift. The workspace needs that package as a devDependency and its
`i18n.config.json` at the root, which is where the catalogue paths, the import alias, the XLIFF
sub-state prefix and the language of the export notes come from.

## Features

- **Inline text** — the `displayLang` translation rendered _in place of_ the key usage: the key
  itself collapses to the text and nothing else does, so a trailing `| i18n` stays where it is and
  a `.ts` and an `.html` usage line up the same way. Put the cursor inside and the real source
  comes back, so it stays editable. An ICU message shows one of its forms, `other` for a plural and
  `male` for a gender select, followed by the forms it picked: `… elementos ‹other›`. The text only
  stands in for what would really be rendered, so what gets swallowed depends on what follows the
  key:

  | Usage                              | Shown as                          |
  | ---------------------------------- | --------------------------------- |
  | `{{ I18n.a.B \| i18n }}`           | `{{ Log out \| i18n }}`           |
  | `[label]="I18n.a.B"`, any `.ts`    | `[label]="Log out"`               |
  | `{{ I18n.a.B }}`                   | `{{ I18n.a.B }}`, errored         |
  | `{{ (x ? I18n.a.B : …) \| i18n }}` | `{{ (x ? I18n.a.B «Log out» … }}` |

  A key handed to a child input or held in TypeScript is a key, not a sentence, so it collapses
  the way it always did. A key sitting bare in an interpolation is the one case that _lies_: it
  renders `a.01KZ…` at runtime, so it is left exactly as written and reported as an error — the
  error is the whole message there, and painting a translation next to it would only dress up a
  usage that does not translate anything. The last row is annotated instead: the pipe applies
  further along the interpolation, so nothing is broken and nothing lines up to be collapsed.

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
  dozen places. The usage scan reads the `sourceDirs` of `i18n.config.json` from disk and overlays the unsaved editors, so
  a key you just typed is already there.

- **Diagnostics** — one per usage, the worst thing true of it first: an undeclared key is an error
  in `.ts` and `.html`, a key interpolated without `| i18n` is an error too (the key is what
  renders, so the page is wrong), an invalid ICU message is reported with the failing language, and
  only then is a key still untranslated reported — a warning, because it is work left to do rather
  than a mistake, raised whenever any language is missing the string, the displayed one or not. The
  squiggle stays on the source characters the inline text stands in for, so under a collapsed usage
  only its tail shows past the text — the mark is deliberately quiet, and the message is in the
  Problems panel and on hover.
- **Findings** — everything `transloco-ulid check` reports, published as problems _on the i18n files
  themselves_ and refreshed whenever any of them changes, or as you type in a `<lang>.json` that is
  not saved yet: with the CLI 0.2.0 or later, an unsaved catalogue editor is read through its
  `parseTranslation()` instead of from disk. It is the same `buildFindings()` the CLI
  calls, with the finding type as the diagnostic code, so a stale `params.ts`, a param added to one
  language and not the other, an orphan ULID, a scope missing from the barrel or a key nobody uses is
  underlined where it lives, without waiting for the commit hook. It runs over the whole workspace,
  so those problems show up in the panel even with no i18n file open. Severity is the CLI's
  `severityOf`, except that a missing or empty translation is lowered to a warning: the commit hook
  is the gate, the editor is where the work is still being done.
- **Completion** — scopes after `I18n.`, keys after `I18n.dashboard.` and while the key is half
  typed, each row showing its `displayLang` text on the right. A key that takes params completes
  with them: picking `PROGRAM_CURRENT_SCANS` inside `{{ I18n.dashboard.| | i18n }}` leaves
  `{{ I18n.dashboard.PROGRAM_CURRENT_SCANS | i18n: { solved: number, total: number, percentage: string } }}`
  with a tabstop on every type — <kbd>tab</kbd> through them replacing each with the real expression,
  and a last one _after_ the `}}`, so the next key is one keystroke away. That last jump happens for
  every key, params or not, whenever the completion can see the whole `| i18n }}` on the line. Inside
  `i18nRef(I18n.dashboard.|)` it appends `, { … }` the same way. The types are the ones declared in
  the generated `<scope>/params.ts`.
- **Snippet** — typing `i18n` expands to `{{ I18n.| | i18n }}` in HTML (to `I18n.|` when the cursor
  already is inside an interpolation) and to `I18n.|` in TypeScript. The TypeScript one adds
  `import { I18n } from '<importAlias>';`; the HTML one patches the sibling component instead, adding the
  same import, `protected readonly I18n = I18n;` and `I18nPipe`, imported from `pipeImport`, in
  `imports`. It leaves that file
  dirty on purpose, and it never touches `provideI18nScope` — a scoped key still needs it by hand.
- **Create key** — `i18n: Create translation key` is `transloco-ulid add` with a picker in front,
  so it needs the CLI 0.2.0 or later and says so otherwise: the rules and the writing both come
  from the CLI's `add/` modules. It picks a scope, asks for the name and whether the key is plain
  text or a plural. A plural asks for its parameter and for every form the source language needs
  (`one` and `other` in Spanish, four in Russian, `other` alone in Japanese), each one starting from
  the selection, or from the previous form when nothing is selected, then writes the ICU. A text
  that does not pass the rules `check` applies to the source language cannot be accepted, and a
  plural form that never counts with `#` (or `{count}`) but names another parameter gets a warning
  while you type, since `{total} retos` under `count` is usually a typo for `# retos`; Enter still
  accepts it, because `Un reto de {name}` is legitimate. Only the source language is asked for: it
  generates the ULID and writes `keys.ts` plus every `<lang>.json`, the target languages with an
  empty slot that stays a warning until the translator fills it. The scope's `params.ts` takes the
  new key's entry only when it was up to date before; one that already had pending changes is left
  untouched, and the closing message says so, along with any warning above. In an `.html` or `.ts`
  editor the reference lands at the cursor, or replaces the selection, which then seeds the default
  language (without its quotes in TypeScript): `{{ I18n.scope.KEY | i18n }}` in HTML, wiring the
  sibling component up like the snippet does, or `I18n.scope.KEY` in TypeScript, with its `I18n`
  import. In HTML a key that takes parameters comes as `{{ I18n.scope.KEY | i18n: { count: | } }}`,
  with a tab stop on each value; `gender` is left out, since the pipe adds it. The closing message
  offers to open the default language file on the new text.
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
  Both commands run the same code as `transloco-ulid export` / `transloco-ulid import`.

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

| Setting                                 | Default               | Meaning                                                                                                     |
| --------------------------------------- | --------------------- | ----------------------------------------------------------------------------------------------------------- |
| `translocoUlidI18n.cliDir`              | `''`                  | Folder with the CLI modules; empty uses the `@drackp2m/transloco-ulid-cli` installed in the workspace.      |
| `translocoUlidI18n.pipeImport`          | `@app/pipe/i18n.pipe` | Module `I18nPipe` is imported from when a template starts using a key.                                      |
| `translocoUlidI18n.languageFile`        | `''`                  | Where `LANGUAGES` and `DEFAULT_LANGUAGE` are declared; empty uses the `languageFile` of `i18n.config.json`. |
| `translocoUlidI18n.langs`               | `[]`                  | Languages to resolve; empty uses every language of `LANGUAGES`.                                             |
| `translocoUlidI18n.displayLang`         | `''`                  | Language shown over the keys; empty uses `DEFAULT_LANGUAGE`.                                                |
| `translocoUlidI18n.inlineText`          | `true`                | Show the inline translation.                                                                                |
| `translocoUlidI18n.inlineTextMaxLength` | `60`                  | Where the inline text is ellipsised.                                                                        |
| `translocoUlidI18n.transferDir`         | `translations`        | Where the XLIFF export lands and the import dialog opens.                                                   |

The language file is the single source of both lists — the same one `transloco-ulid check` reads through
`@drackp2m/transloco-ulid-cli/src/catalogue/config.mjs`. It is parsed on every reload and nothing is guessed: a
file that is not there, a `LANGUAGES` that is empty or holds something that is not a language tag, a
`DEFAULT_LANGUAGE` missing or absent from `LANGUAGES`, a `langs` naming a language the file does not
declare or leaving the source language out, a `displayLang` outside the resolved set — each one stops
the index and says so in the **Transloco ULID i18n** output channel.

VSCode builds the label of each row in its settings UI from the setting id, so they read
`Transloco Ulid I18n: Langs` there however the extension is titled. Only the section header uses
the real name.

It also ships a `configurationDefaults` block turning `editor.suggest.showWords` off for `html` and
`typescript`, so VSCode's word-based guesses (the ones that offered `solved` or `percentage`, scraped
from the transloco params of other open files) stop competing with the real keys. Override it in
`.vscode/settings.json` to get them back.

The index rebuilds itself whenever anything under the i18n directory changes;
`i18n: Reload translation index` forces it.
