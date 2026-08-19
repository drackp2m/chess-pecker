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

# Or from here, where --project is implied
cd tools/scripts/i18n/translate
uv run translate --help
uv run translate ../../../../translations/fr-FR.xlf
```

`uv` resolves the project from the working directory, so the `--project` flag (or a `cd`) is what
makes the command work from the repo root.

Progress is saved after every segment into `<input>.translated.xlf`, and re-running the same
command resumes from that file.

## Backends

- `--backend ollama` (current default) — the prototype engine: TranslateGemma served by a local
  Ollama. Kept until T5 purely so the new engine can be compared against it, then deleted.
- `--backend mlx` — the resident in-process engine of T4. Not implemented yet; today it only runs
  the environment check and exits.

The environment check refuses to go on outside macOS/Apple Silicon, or when `mlx` cannot be
imported, with a message saying so — rather than a bare `ImportError` from inside the container.

## Model weights

Hugging Face caches weights in `~/.cache/huggingface` (or `$HF_HOME`), outside the repo and shared
across projects. A model is downloaded once and reused by every run.

Approximate on-disk sizes for 4-bit MLX conversions. **Confirm the real repository ids on Hugging
Face before pulling one** — the `mlx-community` naming changes between releases:

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
		__main__.py      CLI
		environment.py   host checks: Apple Silicon, mlx importable, Metal available
		ollama_client.py prototype backend, removed in T5
		glossary.py      model-built glossary, replaced by the catalogue glossary in T1
		placeholders.py  __PH_s1__ markers and the rescue of dropped ones
		xliff_io.py      XLIFF 2.0 read/write
```

The plan this directory follows is `ideas/Traducción asistida.md` (gitignored), phases T0–T7.
