# translate

Fills the empty `<target>`s of an exported XLIFF 2.0 file with a local model, preserving every
placeholder. It is the middle step of the i18n cycle, and the only one that does **not** run inside
the devcontainer.

## Where each step runs

- `pnpm i18n:export --lang fr-FR` — **devcontainer**, because `node_modules` lives in a Docker
  volume.
- `uv run translate translations/fr-FR.xlf` — **host**, because MLX is Apple Silicon and Metal only.
- `pnpm i18n:import translations/fr-FR.translated.xlf` and `pnpm i18n:check --fix` —
  **devcontainer**, same reason as the export.

The repo is bind-mounted into the container, so `translations/` is the meeting point: the container
writes the export there, the host reads it and writes the translation back, the container imports
it. `translations/` is gitignored.

## Running it

The tool is a [uv](https://docs.astral.sh/uv/) project. `uv run` creates and syncs `.venv/` on its
own — there is no `source .venv/bin/activate` to remember. `uv` resolves the project from the
working directory, not from the path you pass it, so from the repo root you need `--project`:

```sh
# From the repo root
uv run --project tools/scripts/i18n/translate translate --help

# Or from here, where --project is implied
cd tools/scripts/i18n/translate
uv run translate --help
```

The three commands that matter:

```sh
# See the models it knows by name
uv run translate --list-models

# See exactly what would be sent, without loading anything
uv run translate ../../../../translations/fr-FR.xlf --limit 20 --dry-run

# Translate, with a model chosen by alias
uv run translate ../../../../translations/fr-FR.xlf --model qwen-8b
```

Several inputs load the model once and go through them in series, which is the whole point of the
resident engine:

```sh
uv run --project tools/scripts/i18n/translate translate translations/*.xlf
```

Progress is saved after every batch into `<input>.translated.xlf`, and re-running the same command
resumes from that file. Ctrl-C is safe: what is already translated is on disk.

### What counts as pending

A unit is pending when its `<target>` is empty, or when the export marked it
`subState="chesspecker:outdated"` — the source changed after it was last translated. `--only-stale`
narrows the run to the second kind, `--scope <name>` to one scope, `--limit N` to the next N units
across every file.

Everything the model needs travels inside the XLIFF: the `<file>` notes (`app`, `language`, `scope`,
`glossary`) and the unit's own notes (`context`, `term`, `param`). Nothing is read from the repo, so
a file exported today translates the same way tomorrow.

## Choosing a model

`--model` takes an alias from the table below or any Hugging Face repository id. The default is
`gemma-12b`.

| Alias                         | Repository                                       | On disk |
| ----------------------------- | ------------------------------------------------ | ------- |
| `gemma-4b` / `gemma-4b-qat`   | `mlx-community/gemma-3-4b-it[-qat]-4bit`         | ~3 GB   |
| `gemma-12b` / `gemma-12b-qat` | `mlx-community/gemma-3-12b-it[-qat]-4bit`        | 8 GB    |
| `gemma-27b` / `gemma-27b-qat` | `mlx-community/gemma-3-27b-it[-qat]-4bit`        | 16.8 GB |
| `gemma4-e2b`                  | `mlx-community/gemma-4-e2b-it-4bit`              | 3.6 GB  |
| `gemma4-e4b`                  | `mlx-community/gemma-4-e4b-it-4bit`              | 5.1 GB  |
| `gemma4-26b`                  | `mlx-community/gemma-4-26b-a4b-it-4bit`          | 15.3 GB |
| `gemma4-31b`                  | `mlx-community/gemma-4-31b-it-4bit`              | 18.4 GB |
| `qwen-4b`                     | `mlx-community/Qwen3-4B-Instruct-2507-4bit`      | 2.3 GB  |
| `qwen-8b`                     | `mlx-community/Qwen3-8B-4bit`                    | 4.6 GB  |
| `qwen-14b`                    | `mlx-community/Qwen3-14B-4bit`                   | 8.3 GB  |
| `qwen-30b`                    | `mlx-community/Qwen3-30B-A3B-Instruct-2507-4bit` | 17.2 GB |
| `qwen35-2b`                   | `mlx-community/Qwen3.5-2B-4bit`                  | 1.7 GB  |
| `qwen35-4b`                   | `mlx-community/Qwen3.5-4B-4bit`                  | 3.0 GB  |
| `qwen35-9b`                   | `mlx-community/Qwen3.5-9B-4bit`                  | 6.0 GB  |
| `qwen36-35b`                  | `mlx-community/Qwen3.6-35B-A3B-4bit`             | 20.4 GB |
| `qwen38-27b`                  | `mlx-community/Qwen3.8-27B-4bit`                 | 16.1 GB |
| `translate-4b`                | `mlx-community/translategemma-4b-it-4bit`        | 2.2 GB  |
| `translate-4b-8bit`           | `mlx-community/translategemma-4b-it-8bit`        | 4.1 GB  |
| `translate-12b`               | `mlx-community/translategemma-12b-it-4bit`       | 6.6 GB  |
| `translate-27b`               | `mlx-community/translategemma-27b-it-4bit`       | 15.2 GB |

`--list-models` prints the same table with a line on what each one is for. Every entry is a real MLX
conversion published by `mlx-community`; nothing here needs converting by hand.

Three things separate them:

- **QAT or not.** The `-qat-` conversions are quantisation-aware: same size on disk, less damage
  from the 4-bit squeeze. Prefer them when both exist. They are a different download, so switching
  costs a fresh pull.
- **Thinking.** Qwen3 `8B` and `14B` are hybrid reasoning models. Left alone they would spend the
  whole token budget thinking and return nothing, so the engine turns it off twice over: through the
  chat template (`enable_thinking=False`) and with the `/no_think` switch appended to the user turn.
  The `2507` lines (`qwen-4b`, `qwen-30b`) never reason and need neither.
- **Specialist or generalist.** See below.
- **Whether the prompt cache survives.** The `qwen35-*` / `qwen36-*` / `qwen38-*` families are
  `Qwen3_5ForConditionalGeneration`: part attention, part linear-attention layers whose state is a
  recurrent `ArraysCache`. `mlx_lm` cannot trim that, so the cache is rebuilt on every call and the
  shared head is re-read every time instead of once per scope. The run says so on stderr the first
  time it happens, and `prompt tokens/call` in the summary shows the cost. They are still worth
  measuring — just read that number before comparing them to a Gemma or a Qwen 3.
  These repositories are multimodal upstream; `mlx_lm` drops the vision tower and loads the text
  half, so nothing extra needs installing.

Budget roughly the same amount of unified memory as the file takes on disk, plus the context. If a
candidate has no MLX conversion published, `mlx_lm.convert --hf-path <repo> -q` makes one locally.

Two Gemma 4 conversions are deliberately **not** in the table: `gemma-4-12b-it-4bit` and its QAT
twin declare `model_type: gemma4_unified`, and `mlx_lm` resolves an architecture by importing
`mlx_lm.models.<model_type>`. There is no `gemma4_unified.py` in mlx-lm 0.31.3, which is the newest
release, so they cannot be loaded at all yet. Worth re-checking after an `update:deps`.

### The specialist: TranslateGemma

TranslateGemma is a translation-only model, and `--profile translate` is what it needs — `auto`
picks it from the model name. Its chat template reads exactly three fields (`source_lang_code`,
`target_lang_code`, `text`) wrapped in a fixed English instruction. **There is no system message, no
context slot and no lexical-constraint mechanism**, so none of the catalogue context reaches it, and
it cannot be batched.

`--inject` is the workaround Google itself recommends: terminology goes inside `text` or nowhere.
`terms` puts the glossary pairs this string actually touches on their own lines, already bilingual
(`ciclo = cycle`), and fences the string to translate in `⟦ ⟧`. `full` adds the key's context note.
`none` sends the bare source.

The catch is that a translate-only model translates whatever it is given, notes included, so the
answer comes back with the injected lines translated too. The fence is read back out of the reply,
and the last line is taken when there is no fence; whatever slips through still has to pass the same
validation as everything else.

## What actually gets sent

Under `--profile instruct` the prompt is split in two, and the split is what makes it cheap:

**The system turn is the same for every call of a scope** — the role line, four rules that always
hold, and the `app` / `language` / `scope` notes. Being byte-identical from one call to the next is
what lets the prompt cache process it once instead of once per unit.

**The user turn carries only what this text needs.** Three things are pruned against the sources in
the call:

- **The glossary.** Only the entries whose Spanish term appears in one of these strings, with their
  full gloss. `Cancelar` gets no glossary at all; `Ciclo {{ index }}` gets the two lines about
  `ciclo` and `ajuste`. The `No traducir nunca:` names are filtered the same way. The section sits
  last, right above the texts, because the closer an obligation is to what it applies to the more
  often it is honoured.
- **The global rules.** The bullet list under _«Reglas que valen para todos los idiomas»_ in
  `app.md` is pulled out of the prose and filtered per call: a rule that talks about `{{ param }}`
  is only sent when the text has a placeholder, one that talks about `·` only when the text has a
  separator, one about `…` only when the text has an ellipsis. The rest always go. Adding a probe is
  one tuple in `context.py`.
- **The placeholder rules.** The whole `## Marcadores` block is dropped when nothing in the call has
  a placeholder, which is most of the catalogue.
- **The repeated context.** The export hangs a group's note on every key of that group, so ten keys
  of one group would carry the same paragraph ten times. It is written once and the rest point at
  it (`- Qué es: lo mismo que en el 8.`).

For the `common` scope that is 121 calls and ~760 000 characters before, 13 calls and ~72 000 after.
`--dry-run` prints the two turns exactly as the model gets them, and is the first thing to run
against a new model.

### Making the glossary stick

A term listed once at the top of a batch of ten is easy for a small model to lose — it was `ronda →
manche` that came back as `Rondas` in the first real runs. So the obligation is said three times, in
three places:

- The `## Vocabulario obligado` section, with the gloss that explains what the word means.
- A line under each numbered text naming only the pairs **that text** has to honour:
  `- Usa sí o sí estas palabras: «manche» para «ronda»`.
- On a retry after a glossary failure, one sentence per missed pair, quoting the word wanted:
  `El original dice «intento»: tu traducción tiene que llevar la palabra «tentative»…`

The check that decides all this matches on a **stem**, not on the exact form: a glossary lists
`попытка` and the sentence declines it to `попытку`, French turns `manche` into `manches`. Requiring
the dictionary form would fail every inflected language on every line, burn two retries doing it and
mark good translations for review.

## Batching

`--batch N` (default 10) translates up to N units of the same scope in one call, numbered:

```
Traduce al fr-FR los 10 textos numerados. Responde con 10 líneas, cada una con su número…

1 ⟦Cancelar⟧
2 ⟦Cancelado⟧
3 ⟦Ciclo __PH_s1__⟧
  - Qué es: `{{ index }}` es el número del ciclo, desde 1.
  - __PH_s1__ cierra el texto; tu traducción también debe cerrar con él.
```

Units arrive in the order the export wrote them, which is the order of `keys.ts` — so neighbours in
a batch are neighbours in the catalogue, and the shared context is genuinely shared. A batch also
closes early once its sources add up to ~700 characters, so a screenful of prose never rides with
nine labels.

The answer is read back line by line, and **each line is validated on its own**. A line that fails —
a lost placeholder, a broken glossary term, a length that makes no sense — is simply not used: that
unit goes back through the one-at-a-time path with its retries, and only what came back clean is
kept. Numbering only has to climb: a model that skips a number loses that one unit, not the whole
tail of the batch. Nothing is accepted just because it arrived in a batch.

What a batch saves is **not** the shared head — the prompt cache already processes that once per
scope either way. It saves the per-call sections: one `## Vocabulario obligado`, one set of rules and
one `## Marcadores` for twenty texts instead of twenty of each. Measured on this catalogue that is
around 130 prompt tokens per unit batched against around 210 alone. Worth having, but smaller than
the drop in call count suggests, and worth nothing at all if the model cannot hold the format —
every unit it drops costs a call of its own plus retries.

So `--batch` is a **ceiling, not a promise**: when a call comes back with less than three quarters of
the lines it was given, the size drops to however many the model did manage, and the run carries on
from there. A model that can only hold five numbered lines is found out on its first call and costs
one bad batch, not one bad batch per scope. The drop is announced on stderr and counted in the
summary. `--profile translate` forces `--batch 1`.

## Validation and review

A translation is accepted only if it keeps every placeholder exactly once, invents none, is not a
copy of the source, leaves no word in the source language when the target language writes in a
script of its own (Devanagari, Cyrillic, …, minus the untranslatable names of the glossary), stays
inside a length band and honours the glossary terms the unit's `term` note lists.

Before any of that, the answer is cleaned: code fences, `«…»` quotes, `Here is the translation:`
lead-ins, a final full stop the source did not have, `<think>…</think>` blocks, and everything from
the first end-of-turn token onwards.

A rejected answer is retried with the reason attached, then with an example. What still fails is
salvaged — dropped markers are re-attached — and the segment is written with
`subState="chesspecker:review"` and listed at the end of the run. Nothing dubious is ever passed off
as good.

## Reading the run summary

Every run ends with a panel that says how the session actually went, not just how many units came
out of it:

```
Translated 85 units (72 in a batch, 10 from memory) in 253s
20.2 units/min · 5.2 tokens/s · 10 model calls · 1051 prompt tokens/call

Batches: 4 calls, 75 units offered, 72 answered and kept
  3 rejected (checks failed: glossary 3)
  0 never answered (the model lost the numbering)
  1 of 4 calls stopped answering around line 18

One at a time: 3 units, 6 calls
  second 2 · gave up 1
  checks failed: glossary 4, too-long 1
  1 rescued by re-attaching placeholders

1 unit(s) marked for review:
  training/TrainingI18n.CALIBRATION_SUMMARY: glossary: sin usar ronda → manche
```

What each number is for:

- **`prompt tokens/call`** — the tokens actually fed to the model after the prompt cache was
  trimmed. A few hundred means the shared head is being processed once per scope, as intended. A
  figure near the size of a whole prompt means the cache is being rebuilt every call and prefill is
  eating the run.
- **`rejected`** vs **`never answered`** — the two ways a batch loses a unit, and they call for
  opposite fixes. _Rejected_ is a translation that came back and failed a check: the model is
  translating badly, so a better model or a smaller `--batch` will help. _Never answered_ is
  numbering the model dropped: it is not following the format, and `--batch` is too big for it.
- **`stopped answering around line N`** — where in the list the model gave out. Well short of the
  batch size means it cannot hold a list that long; at the batch size with units still missing means
  it skipped lines in the middle. The first is what the automatic backoff reacts to.
- **`second 2 · gave up 1`** — where the retry ladder ended for each unit that went alone. A run
  full of `first try` is a model that just needed the batch broken up; a run full of `gave up` is a
  model that cannot do this catalogue.
- **`checks failed`** — the same codes the `[review]` lines use, counted. `glossary` dominating
  means the vocabulary is not sticking; `placeholder-missing` dominating means the markers are.

`--report <file>` writes the same panel into the markdown summary, and `--json` carries it as a
`tally` object on the final `done` event.

## Flags worth knowing

- `--dry-run` prints the prompts and writes nothing. With `--limit 20` it is the fastest way to see
  what is really being sent.
- `--list-models` prints the table above and exits.
- `--batch N` units per call (default 10). `--batch 1` disables batching.
- `--no-tm` turns off the run translation memory, which reuses a translation already resolved in
  this run (and is seeded with the targets the file already carries). Turn it off when comparing
  models, so every unit is really translated.
- `--deepl` translates with the DeepL API instead of a local model, writing `<input>.deepl.xlf`
  for use as a `--reference`. `--no-glossary` sends the catalogue vocabulary along with it or not.
- `--compare` scores the given translated files against each other instead of translating, and
  `--reference <file>` makes one of them the yardstick. `--worst N` sets how many disagreeing units
  are printed in full (default 10). `--scope` narrows all of it.
- `--json` prints NDJSON progress on stdout instead of the human log; `--report <file>` writes a
  markdown summary with the speed, the batch share and the units left for review.
- `--temperature` defaults to 0 — deterministic, which is what makes two models comparable.

## Backends

- `--backend mlx` (default) — the resident engine: the model is loaded once, and the prompt cache is
  reused across every call of a scope. `max_tokens` is capped at about four times the length of the
  sources, because a runaway answer is always rubbish.
- `--backend ollama` — the prototype engine, kept until T5 only so the new one can be compared
  against it, then deleted. It gets exactly the same prompt, which is what makes the comparison
  fair.

The environment check refuses to go on outside macOS/Apple Silicon, or when `mlx` cannot be
imported, with a message saying so — rather than a bare `ImportError` from inside the container.

The `mlx-lm` API is used through `mlx_lm.load`, `mlx_lm.stream_generate` and `mlx_lm.models.cache`'s
`make_prompt_cache` / `can_trim_prompt_cache` / `trim_prompt_cache`. The sampler is picked by
inspecting the signature of `stream_generate` (`sampler=` on current versions, `temp=` on older
ones), and the prompt cache is reused only when its own offset says how long it is and it can be
trimmed — otherwise it is rebuilt, which costs speed and never correctness.

## When it misbehaves

| What you see                                        | What it is                                                                                                                               |
| --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| A long silence after `Loading mlx model …`          | The weights coming down. The first run of a model downloads it with no progress line of its own.                                         |
| `<end_of_turn>` repeated thirty times               | A model that kept talking past its own stop token. Generation now stops at the first one and the tail is cut; nothing reaches the XLIFF. |
| Empty answers from `qwen-8b` / `qwen-14b`           | Thinking was not switched off — an old chat template in the conversion. Try a `2507` alias, which never reasons.                         |
| Most units say `(model, …)` instead of `(batch, …)` | The model is not honouring the numbered format. Use `--batch 1`, or a bigger model.                                                      |
| `… rejected the prompt`                             | A translation-only model got the layered prompt. Add `--profile translate` (or use a `translate-*` alias, where `auto` does it for you). |
| Lots of `[review]`                                  | Read the list at the end of the run: it names the check that failed for each one. `--report` writes the same thing as a table.           |

## Comparing two runs

The summary says what the checks caught, and the checks only see placeholders, glossary terms and
length. Whether the French reads like French is not in there. `--compare` scores several translated
files of the same language against each other and points at the units worth reading by hand:

```sh
uv run translate fr-FR.qwen35-9b.xlf fr-FR.qwen35-4b.xlf fr-FR.gemma4-e4b.xlf --compare
uv run translate fr-FR.*.xlf --compare --reference fr-FR.deepl.xlf --worst 20
```

The score is **chrF**, the character n-gram F-score: no tokenizer, and no penalty for a language
that glues its morphemes together, which is what makes it survive Russian and Catalan where a
word-level score would not. Placeholders are collapsed to one character each before scoring, so a
long `{{ param }}` name cannot inflate the agreement between two otherwise different sentences.

With no `--reference`, each file is scored against **all the others**: the number is agreement, not
correctness. That is still the useful half, because the unit where every file disagrees is almost
always a unit somebody got wrong, and the file that agrees with nobody is usually the worst model in
the room. With a `--reference` — a file written by a professional, another engine, or simply the
model you trust most — every other file is scored against it instead, and the disagreement list is
ranked by distance from it.

```
fr-FR · 4 file(s) · 85 unit(s) in common
  no reference: the score is how much each one agrees with the rest

file            units  chrF  worst  under 50
--------------  -----  ----  -----  --------
qwen35-9b.xlf   85     73.3  59.5   0
gemma4-e2b.xlf  85     40.6  2.5    4
```

`under 50` is the column to read first: it counts the units where that file went its own way, and
those are the ones the `worst` list prints in full, source and every translation underneath.

A unit missing from any of the files is left out of the comparison entirely, and the header says how
many were dropped — an unfinished run can be compared, it just compares less.

## A reference translation from DeepL

`--compare` is more useful with something to compare against. `--deepl` fills the same file with the
DeepL API instead of a local model, and writes it as `<input>.deepl.xlf`:

```sh
uv run translate translations/fr-FR.xlf --deepl
uv run translate translations/fr-FR.*.xlf --compare --reference translations/fr-FR.deepl.xlf
```

It needs `DEEPL_API_KEY` in the root `.env` (see the section on the HF token — the same file, read
the same way). A key ending in `:fx` is a free one and is sent to `api-free.deepl.com`; anything
else goes to `api.deepl.com`. The whole catalogue is about 9.300 characters of source per language,
so a reference run costs a rounding error of any quota.

Three things make the comparison fair rather than decorative:

- **Placeholders are tags, not text.** Every `__PH_s1__` goes over the wire as `<ph id="s1"/>` with
  `tag_handling=xml` and `ignore_tags=ph`, and comes back the same. DeepL therefore cannot lose a
  placeholder, which is exactly why `placeholder-missing` is not a fair axis to compare on — read
  the prose, not that counter.
- **The glossary goes with it.** The terms in the file's `glossary` note are uploaded as a DeepL
  glossary for the run and deleted afterwards, so the reference is held to the same vocabulary the
  models are told to use. DeepL only supports glossaries between its main languages: `ca-ES` and
  `hi-IN` translate fine but get no glossary, and the run says so. `--no-glossary` turns it off.
- **The same checks run on the answer.** The output goes through the same validator, so a unit
  where DeepL broke a rule is marked `chesspecker:review` and listed at the end, just like a model
  run. A reference is not a ground truth, and this is what keeps that visible.

Units are sent 50 at a time, progress is saved after every request, and the summary ends with the
characters the run spent, which is the number the quota is counted in.

## Model weights

Hugging Face caches weights in `~/.cache/huggingface` (or `$HF_HOME`), outside the repo and shared
across projects. A model is downloaded once and reused by every run — switching back and forth
between two aliases costs nothing after the first pull.

### What is on disk, and getting it back

```sh
uv run translate --cache          # what is downloaded, biggest first
uv run translate --cache-remove   # the same list, then pick what to delete
```

`--cache` reads the Hugging Face cache directly, so it lists **everything** in it, not only what
this tool put there: the `alias` column says `—` for a repository the registry does not know, which
is usually another project's model. Sizes are what the blobs really occupy, and `last used` is how
long ago something read them.

`--cache-remove` shows the same list as a picker: `↑`/`↓` (or `k`/`j`) move, `space` marks a model,
`a` marks or unmarks every one, `enter` confirms and `esc`, `q` or `ctrl-c` walks away without
deleting anything. Then it shows the repositories it is about to remove and how much that frees, and
waits for you to type `yes`. Nothing is deleted before that, and weights are always re-downloadable
— the cost of a mistake is a download, not a loss.

Outside a terminal that can go raw the same question is asked by typing instead, and takes `3`,
`1 4 5`, `2-5`, `all`, or an empty line to cancel.

### The unauthenticated-requests warning

> You are sending unauthenticated requests to the HF Hub. Please set a HUGGINGFACE_TOKEN…

A **free** account is enough to silence it and lifts the anonymous rate limit, which is what
throttles a run that pulls several models in a row. Either log in once:

```sh
uv run --project tools/scripts/i18n/translate hf auth login
```

or put `HUGGINGFACE_TOKEN` in the `.env` at the repo root, next to `DEEPL_API_KEY`. The translator reads that
file itself on startup — the same walk up to `pnpm-workspace.yaml` the API does — and only fills in
what the shell has not already exported, so `HUGGINGFACE_TOKEN=… uv run translate …` still wins over the
file for a single command. Exporting it from your shell profile works exactly as before;
`huggingface_hub` picks the variable up on its own either way.

Raw download speed is a separate matter and is already handled: `hf_xet` ships with
`huggingface-hub` 1.x, so the big blobs come down over Xet rather than plain HTTP. The old
`HF_HUB_ENABLE_HF_TRANSFER=1` trick is not needed.

## Layout

```
translate/
	pyproject.toml       uv project: lxml, huggingface-hub, mlx-lm (darwin/arm64 only)
	translator/
		__main__.py      batching, the run loop and the fallbacks
		cli.py           the argument parser
		models.py        the known models, their aliases and prompt shapes
		downloads.py     what the Hugging Face cache holds, and deleting from it
		compare.py       chrF agreement between several translated files
		deepl.py         the reference translation, and the glossary it is held to
		dotenv.py        the root .env, read the way the API reads it
		tables.py        the aligned columns every listing is printed with
		picker.py        the arrow-key multi-select the cache deletion asks with
		engine.py        model loading, prompt cache, generation, token accounting
		prompting.py     the system turn, the batched user turn, reading the answer back
		context.py       slicing the app note and the glossary down to what a call needs
		memory.py        translation memory of the run
		validate.py      cleanup, placeholders, glossary, parasitic prose, length
		report.py        human log, NDJSON progress and the markdown summary
		environment.py   host checks: Apple Silicon, mlx importable, Metal available
		ollama_client.py prototype backend, removed in T5
		placeholders.py  __PH_s1__ markers and the rescue of dropped ones
		xliff_io.py      XLIFF 2.0 read/write, notes and subState
```

The plan this directory follows is `ideas/Traducción asistida.md` (gitignored), phases T0–T7.
