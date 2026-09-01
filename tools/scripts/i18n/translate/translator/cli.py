from __future__ import annotations

import argparse
from pathlib import Path

from .bench import DEFAULT_OUT as DEFAULT_BENCH_OUT
from .bench import REPORT_NAME as BENCH_REPORT
from .deepl import KEY_VAR
from .models import ALIASES, DEFAULT_ALIAS, PROFILES
from .ollama_client import DEFAULT_MODEL as DEFAULT_OLLAMA_MODEL
from .prompting import INJECTIONS

DEFAULT_BATCH = 10

EPILOG = """\
examples:
  # Every pending unit of every exported file, with the model loaded once
  uv run --project tools/scripts/i18n/translate translate translations/*.xlf

  # The models this tool knows by name, and the ones already on disk
  uv run translate --list-models
  uv run translate --cache

  # One language, only what the source outgrew, with another model
  uv run translate translations/fr-FR.xlf --only-stale --model qwen35-9b

  # See what is really sent: two batches of ten, no model loaded
  uv run translate translations/fr-FR.xlf --limit 20 --dry-run

  # One unit per call, which is what a translation-only model needs
  uv run translate translations/fr-FR.xlf --model mlx-community/translategemma-12b-it-4bit

  # What two models made of the same file, and where they disagree
  uv run translate fr-FR.qwen35-9b.xlf fr-FR.gemma4-e4b.xlf --compare

  # The same file through DeepL, to use as the yardstick of that comparison
  uv run translate translations/fr-FR.xlf --deepl

  # The whole bench through two models and DeepL, scored and tabulated
  uv run translate --bench --model gemma-12b-qat,gemma4-e4b,deepl

  # The same command once every pass is done: the report again, nothing retranslated
  uv run translate --bench --model gemma-12b-qat,gemma4-e4b,deepl
"""


def build_arg_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="translate",
        description=(
            "Translate the pending units of exported XLIFF 2.0 files with a "
            "local model. Runs on the host (macOS, Apple Silicon), never "
            "inside the devcontainer. The model is loaded once for every file "
            "given, placeholders are preserved, progress is saved after every "
            "batch, and re-running the same command resumes from the existing "
            "output."
        ),
        epilog=EPILOG,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )

    parser.add_argument("inputs", type=Path, nargs="*", help="Input XLIFF files")

    parser.add_argument(
        "-o",
        "--output",
        type=Path,
        help=(
            "Output file, only with a single input. Defaults to "
            "<input>.translated.xlf. Under --bench, the directory every pass "
            f"is written into. (default under --bench: {DEFAULT_BENCH_OUT}/)"
        ),
    )

    parser.add_argument(
        "--backend",
        choices=("mlx", "ollama"),
        default="mlx",
        help=(
            "Translation engine: 'mlx' is the resident in-process engine, "
            "'ollama' the prototype kept for comparison. (default: mlx)"
        ),
    )

    parser.add_argument(
        "--model",
        default=None,
        help=(
            "Model to translate with: one of the aliases from --list-models "
            f"({', '.join(ALIASES)}) or any Hugging Face repository id. Under "
            "--bench, a comma-separated list of them, where 'deepl' counts as "
            f"one more candidate. (default: {DEFAULT_ALIAS} for mlx, "
            f"{DEFAULT_OLLAMA_MODEL} for ollama)"
        ),
    )

    parser.add_argument(
        "--list-models",
        action="store_true",
        help=(
            "Print the known models with their size, their expected and actual "
            "disk footprint and the date their conversion was published, then exit."
        ),
    )

    parser.add_argument(
        "--cache",
        action="store_true",
        help="List the models downloaded on this machine and what they take up, then exit.",
    )

    parser.add_argument(
        "--cache-remove",
        dest="cache_remove",
        action="store_true",
        help="List the downloaded models, ask which ones to delete, free the space and exit.",
    )

    parser.add_argument(
        "--deepl",
        action="store_true",
        help=(
            "Translate the given files with the DeepL API instead of a local "
            "model, writing <input>.deepl.xlf. Meant as the --reference of a "
            f"later --compare. Needs {KEY_VAR} in the .env at the repo root."
        ),
    )

    parser.add_argument(
        "--no-glossary",
        dest="no_glossary",
        action="store_true",
        help=(
            "Do not upload the catalogue glossary to DeepL under --deepl. The "
            "comparison is then between a model that was told the vocabulary "
            "and one that was not, which is only fair if that is the question."
        ),
    )

    parser.add_argument(
        "--compare",
        action="store_true",
        help=(
            "Score the given translated XLIFF files against each other with "
            "chrF and print where they disagree most, then exit. With no "
            "--reference the score is how much each file agrees with the rest, "
            "which is enough to find the units worth reading by hand."
        ),
    )

    parser.add_argument(
        "--reference",
        type=Path,
        default=None,
        help=(
            "Translated XLIFF to treat as the yardstick under --compare, such "
            "as one written by a professional or another engine. Every other "
            "file is scored against it instead of against the others. Under "
            "--bench it defaults to the file next to each input with the "
            "'.blank' dropped, which is the translation written by hand."
        ),
    )

    parser.add_argument(
        "--worst",
        type=int,
        default=10,
        help="How many disagreeing units --compare prints in full. (default: 10)",
    )

    parser.add_argument(
        "--bench",
        action="store_true",
        help=(
            "Translate the given blank bench files with every model in "
            "--model, score each pass against its reference and write one "
            "markdown with the tables side by side. With no input file it "
            "takes every *.blank.xlf of tools/scripts/i18n/bench. Each pass is "
            "kept as its own XLIFF, so --compare can be re-run on it by hand, "
            "and what it cost goes in a .json beside it. A pass whose file is "
            "already complete is not translated again: re-running the command "
            "rebuilds the report, speed included, without loading a model."
        ),
    )

    parser.add_argument(
        "--profile",
        choices=("auto", *PROFILES),
        default="auto",
        help=(
            "How the prompt is shaped. 'instruct' layers the catalogue context "
            "into a system prompt and can translate in batches; 'translate' uses "
            "the fixed structured turn a translation-only model expects, one "
            "unit per call. 'auto' takes it from the model, and no alias needs "
            "it any more: a TranslateGemma repository id still selects it by "
            "name. (default: auto)"
        ),
    )

    parser.add_argument(
        "--batch",
        type=int,
        default=DEFAULT_BATCH,
        help=(
            "Translate up to N units of the same scope in a single call, which "
            "is where most of the speed comes from. Anything the batch answers "
            "badly is retranslated on its own. Forced to 1 under --profile "
            f"translate. (default: {DEFAULT_BATCH})"
        ),
    )

    parser.add_argument(
        "--inject",
        choices=INJECTIONS,
        default="terms",
        help=(
            "How much context to smuggle into the text itself under --profile "
            "translate, whose template has room for nothing else: 'terms' the "
            "glossary terms of that string, 'full' those plus its context note, "
            "'none' the bare source. (default: terms)"
        ),
    )

    parser.add_argument(
        "--scope",
        action="append",
        default=[],
        help="Only translate this scope (the <file> id). Repeatable.",
    )

    parser.add_argument(
        "--limit",
        type=int,
        default=None,
        help="Translate at most N units in this run, across every file.",
    )

    parser.add_argument(
        "--only-stale",
        action="store_true",
        help=(
            "Only retranslate units whose source changed after they were "
            "translated, leaving the untranslated ones alone."
        ),
    )

    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print the prompts that would be sent and write nothing.",
    )

    parser.add_argument(
        "--no-tm",
        dest="memory",
        action="store_false",
        help=(
            "Disable the run translation memory, which reuses the translation "
            "of a source string already resolved in this run."
        ),
    )

    parser.add_argument(
        "--json",
        dest="as_json",
        action="store_true",
        help="Print NDJSON progress on stdout instead of the human log.",
    )

    parser.add_argument(
        "--report",
        type=Path,
        default=None,
        help=(
            "Write a markdown summary of the run to this file. Under --bench, "
            f"the side-by-side comparison. (default under --bench: "
            f"<output>/{BENCH_REPORT})"
        ),
    )

    parser.add_argument(
        "--temperature",
        type=float,
        default=0.0,
        help="Sampling temperature (default: 0, deterministic).",
    )

    parser.set_defaults(memory=True)

    return parser
