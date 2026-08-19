# translate

Translates the empty `<target>`s of an exported XLIFF 2.0 file with a local model, preserving
every placeholder. It is the middle step of the i18n cycle, and the only one that does **not** run
inside the devcontainer.

## Where each step runs

- `pnpm i18n:export --lang fr-FR` — **devcontainer**, because `node_modules` lives in a Docker
  volume.
- `uv run translate translations/fr-FR.xlf` — **host**, because MLX is Apple Silicon and Metal
  only.
- `pnpm i18n:import translations/fr-FR.translated.xlf` and `pnpm i18n:check --fix` —
  **devcontainer**, same reason as the export.

The repo is bind-mounted into the container, so `translations/` is the meeting point: the
container writes the export there, the host reads it and writes the translation back, the
container imports it. `translations/` is gitignored.

## Running it

The tool is a [uv](https://docs.astral.sh/uv/) project. `uv run` creates and syncs `.venv/` on its
own — there is no `source .venv/bin/activate` to remember.

```sh
# From the repo root
uv run --project tools/scripts/i18n/translate translate --help

# Every exported language, with the model loaded once for all of them
uv run --project tools/scripts/i18n/translate translate translations/*.xlf

# Or from here, where --project is implied
cd tools/scripts/i18n/translate
uv run translate --help
uv run translate ../../../../translations/fr-FR.xlf
```

`uv` resolves the project from the working directory, so the `--project` flag (or a `cd`) is what
makes the command work from the repo root.

Progress is saved after every unit into `<input>.translated.xlf`, and re-running the same command
resumes from that file. Several inputs load the model once and go through them in series, which is
the whole point of the resident engine.

### What gets translated

A unit is pending when its `<target>` is empty, or when the export marked it
`subState="chesspecker:outdated"` — the source changed after it was last translated. `--only-stale`
narrows the run to the second kind, `--scope <name>` to one scope, `--limit N` to the next N units
across every file.

Everything the prompt needs travels inside the XLIFF: the `<file>` notes (`app`, `language`,
`scope`, `glossary`) become the system prompt, shared by every unit of that scope, and the unit's
own notes (`context`, `term`, `param`) become the user turn. Nothing is read from the repo, so a
file exported today translates the same way tomorrow.

### Flags worth knowing

- `--dry-run` prints the prompts and writes nothing — the system prompt of the scope and the user
  turn of every unit, exactly as the model gets them. With `--limit 3` it is the fastest way to see
  what is actually being sent, and the first thing to run against a new model.
- `--no-tm` turns off the run translation memory, which reuses a translation already resolved in
  this run (and is seeded with the targets the file already carries). Turn it off when comparing
  models, so every unit is really translated.
- `--json` prints NDJSON progress on stdout instead of the human log; `--report <file>` writes a
  markdown summary with the speed and the units left for review.

### Validation and review

A translation is accepted only if it keeps every placeholder exactly once, invents none, is not a
copy of the source, leaves no word in the source language when the target language writes in a
script of its own (Devanagari, Cyrillic, …, minus the untranslatable names of the glossary), stays
inside a length band and honours the glossary terms the unit's `term` note lists. A final full stop
the source did not have is stripped in the cleanup, without spending another call. A rejected answer
is retried with the reason attached, then with an example. What still fails is salvaged — dropped
markers are re-attached — and the segment is written with `subState="chesspecker:review"` and
listed at the end of the run. Nothing dubious is ever passed off as good.

## Backends

`--profile` decides the shape of the prompt and defaults to `auto`: a model whose name says
`translategemma` gets the structured turn above, anything else gets the layered context prompt of
T1/T2 (system: app, language, scope, glossary; user: the key's own notes plus the fenced source).
So `--model mlx-community/gemma-3-12b-it-4bit` and `--model mlx-community/translategemma-4b-it-4bit`
both just work, and `--profile` is only there to force the other one.

- `--backend mlx` (default) — the resident engine: the model is loaded once, and the prompt cache
  is reused across every unit of a scope, so the shared context is processed once instead of once
  per unit. Sampling is deterministic (temperature 0) and `max_tokens` is capped at about four
  times the length of the source, because a runaway answer is always rubbish.
- `--backend ollama` — the prototype engine, kept until T5 only so the new one can be compared
  against it, then deleted. It gets exactly the same layered prompt, which is what makes the
  comparison fair.

The environment check refuses to go on outside macOS/Apple Silicon, or when `mlx` cannot be
imported, with a message saying so — rather than a bare `ImportError` from inside the container.

The `mlx-lm` API is used through `mlx_lm.load`, `mlx_lm.stream_generate` and
`mlx_lm.models.cache`'s `make_prompt_cache` / `can_trim_prompt_cache` / `trim_prompt_cache`. The
sampler is picked by inspecting the signature of `stream_generate` (`sampler=` on current
versions, `temp=` on older ones), and the prompt cache is reused only when its own offset says how
long it is and it can be trimmed — otherwise it is rebuilt, which costs speed and never
correctness. **None of this could be run from the devcontainer**: the first host run is what
confirms the names against the installed version.

## Model weights

Hugging Face caches weights in `~/.cache/huggingface` (or `$HF_HOME`), outside the repo and shared
across projects. A model is downloaded once and reused by every run.

Approximate on-disk sizes for 4-bit MLX conversions. **Confirm the real repository ids on Hugging
Face before pulling one** — the `mlx-community` naming changes between releases:

The first run of a model downloads it with no progress line of its own, so a long silence right
after `Loading mlx model …` is the weights coming down, not a hang.

**TranslateGemma is a special case**, and `--profile translate` is what it needs. The MLX
conversions exist (`mlx-community/translategemma-4b-it-4bit`, `-12b-it-8bit`, `-27b-it-4bit`,
`-27b-it-bf16`), but its chat template reads exactly three fields — `source_lang_code`,
`target_lang_code`, `text` — and wraps them in a fixed English instruction. There is no system
message, no context slot and no lexical-constraint mechanism; Google's own answer is to inject the
terminology at application level, which means inside `text` and nowhere else.

That is what `--inject` does. `terms` puts the glossary pairs that this string actually touches on
their own lines, already bilingual (`ciclo = चक्र`) — a translation-only model does not need to be
told what that means — and fences the string to translate in `⟦ ⟧`. `full` adds the key's context
note. `none` sends the bare source, the way the prototype did.

The catch is that a translate-only model translates whatever it is given, notes included, so the
answer comes back with the injected lines translated too. The fence is read back out of the reply,
and the last line is taken when there is no fence; whatever slips through still has to pass the
same validation as everything else. Which of the three settings wins is a measurement, not an
opinion — that is the comparison T5 is for.

| Model family     | Size | On disk |
| ---------------- | ---- | ------- |
| Gemma 3 instruct | 4B   | ~2.5 GB |
| Gemma 3 instruct | 12B  | ~7 GB   |
| Gemma 3 instruct | 27B  | ~16 GB  |
| Qwen 3 instruct  | 8B   | ~4.5 GB |
| Qwen 3 instruct  | 14B  | ~8 GB   |

Budget roughly the same amount of unified memory as the file takes on disk, plus the context. If a
candidate has no MLX conversion published, `mlx_lm.convert --hf-path <repo> -q` makes one locally.

## Layout

```
translate/
	pyproject.toml       uv project: lxml, huggingface-hub, mlx-lm (darwin/arm64 only)
	translator/
		__main__.py      CLI and the run loop
		engine.py        model loading, prompt cache, generation, token accounting
		prompting.py     the layered prompt built from the XLIFF notes
		memory.py        translation memory of the run
		validate.py      placeholders, glossary, parasitic prose, length
		report.py        human log, NDJSON progress and the markdown summary
		environment.py   host checks: Apple Silicon, mlx importable, Metal available
		ollama_client.py prototype backend, removed in T5
		placeholders.py  __PH_s1__ markers and the rescue of dropped ones
		xliff_io.py      XLIFF 2.0 read/write, notes and subState
```

The plan this directory follows is `ideas/Traducción asistida.md` (gitignored), phases T0–T7.
