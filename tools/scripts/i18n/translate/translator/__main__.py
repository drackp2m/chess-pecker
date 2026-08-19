#!/usr/bin/env python3

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from .engine import DEFAULT_MLX_MODEL, build_engine
from .environment import HostUnsupportedError
from .memory import TranslationMemory
from .ollama_client import DEFAULT_MODEL as DEFAULT_OLLAMA_MODEL
from .prompting import (
    INJECTIONS,
    PROFILES,
    REVIEW_SUB_STATE,
    blocks_of,
    build_messages,
    fenced,
    is_pending,
)
from .report import Record, Reporter, write_report
from .validate import clean, reason_of, repair, validate
from .xliff_io import (
    build_target,
    find_files,
    get_languages,
    read_xliff,
    replace_target,
    save_tree,
    set_state,
)

RETRIES = 2
MAX_TOKENS_FACTOR = 4
MAX_TOKENS_FLOOR = 48
MAX_TOKENS_CEILING = 640

EPILOG = """\
examples:
  # Every pending unit of every exported file, with the model loaded once
  uv run --project tools/scripts/i18n/translate translate translations/*.xlf

  # One language, only what the source outgrew
  uv run translate translations/fr-FR.xlf --only-stale

  # Try the prompts on three units without loading a model
  uv run translate translations/fr-FR.xlf --limit 3 --dry-run

  # Compare the new engine against the prototype on the same prompts
  uv run translate translations/fr-FR.xlf --backend ollama --report ollama.md
"""


def build_arg_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="translate",
        description=(
            "Translate the pending units of exported XLIFF 2.0 files with a "
            "local model. Runs on the host (macOS, Apple Silicon), never "
            "inside the devcontainer. The model is loaded once for every file "
            "given, placeholders are preserved, progress is saved after every "
            "unit, and re-running the same command resumes from the existing "
            "output."
        ),
        epilog=EPILOG,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )

    parser.add_argument("inputs", type=Path, nargs="+", help="Input XLIFF files")

    parser.add_argument(
        "-o",
        "--output",
        type=Path,
        help=(
            "Output file, only with a single input. Defaults to "
            "<input>.translated.xlf"
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
            f"Model to translate with. (default: {DEFAULT_MLX_MODEL} for mlx, "
            f"{DEFAULT_OLLAMA_MODEL} for ollama)"
        ),
    )

    parser.add_argument(
        "--profile",
        choices=("auto", *PROFILES),
        default="auto",
        help=(
            "How the prompt is shaped. 'instruct' layers the catalogue context "
            "into a system prompt; 'translate' uses the fixed structured turn a "
            "translation-only model such as TranslateGemma expects. 'auto' picks "
            "'translate' for a model whose name says so. (default: auto)"
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
        help="Write a markdown summary of the run to this file.",
    )

    parser.add_argument(
        "--temperature",
        type=float,
        default=0.0,
        help="Sampling temperature (default: 0, deterministic).",
    )

    parser.set_defaults(memory=True)

    return parser


def output_for(path: Path, requested: Path | None) -> Path:
    if requested is not None:
        return requested

    return path.with_name(f"{path.stem}.translated{path.suffix}")


def max_tokens_for(engine, source: str) -> int:
    estimate = engine.count_tokens(source) * MAX_TOKENS_FACTOR

    return max(MAX_TOKENS_FLOOR, min(MAX_TOKENS_CEILING, estimate))


def attempt(engine, block, unit, index: int, reason: str) -> tuple[str, list]:
    text = engine.generate(
        build_messages(block, unit, index, reason),
        max_tokens_for(engine, unit.source),
    )
    candidate = clean(text, unit.source, "last" if fenced(block, unit) else "first")
    issues = validate(
        candidate,
        unit.source,
        unit.markers,
        unit.terms,
        lang=block.target_lang,
        keep=block.keep,
    )

    return candidate, issues


def translate_unit(engine, block, unit) -> tuple[str, list[str], bool]:
    candidate, issues = attempt(engine, block, unit, 0, "")

    for index in range(1, RETRIES + 1):
        if not issues:
            return candidate, [], False

        candidate, issues = attempt(engine, block, unit, index, reason_of(issues))

    if not issues:
        return candidate, [], False

    if any(issue.hard for issue in issues):
        candidate = repair(candidate, unit.source, unit.markers)

    return candidate, [f"{issue.code}: {issue.detail}" for issue in issues], True


def resolve(engine, block, unit, memory) -> tuple[str, str, list[str], bool]:
    remembered = memory.get(block.target_lang, unit.source)

    if remembered is not None:
        return remembered, "memory", [], False

    text, issues, review = translate_unit(engine, block, unit)

    if not review:
        memory.remember(block.target_lang, unit.source, text)

    return text, "model", issues, review


def wanted(unit, args) -> bool:
    if args.scope and unit.scope not in args.scope:
        return False

    if args.only_stale:
        return unit.outdated

    return is_pending(unit)


def profile_for(args, model: str) -> str:
    if args.profile != "auto":
        return args.profile

    return "translate" if "translategemma" in model.lower() else "instruct"


def plan_file(root, args, shape) -> tuple[list, int]:
    jobs = []
    total = 0

    for element in find_files(root):
        block, units = blocks_of(element, *get_languages(root), **shape)
        total += len(units)

        for unit in units:
            if wanted(unit, args):
                jobs.append((block, unit))

    return jobs, total


def seed_memory(root, memory, source_lang, target_lang) -> None:
    for element in find_files(root):
        block, units = blocks_of(element, source_lang, target_lang)

        for unit in units:
            if not unit.outdated and unit.previous.strip():
                memory.seed(target_lang, unit.source, unit.previous)


def apply_unit(unit, text: str, review: bool) -> None:
    replace_target(unit.segment, build_target(unit.source_element, text))
    set_state(unit.segment, "translated", REVIEW_SUB_STATE if review else None)


def show_prompts(block, unit, reporter) -> None:
    reporter.say(f"\n----- {unit.scope}/{unit.key}")

    for message in build_messages(block, unit):
        reporter.say(f"[{message['role']}]")
        reporter.say(str(message["content"]))


def run_file(path: Path, engine, args, memory, reporter, budget: int | None, shape=None) -> int:
    shape = shape or {}
    output = output_for(path, args.output)
    tree = read_xliff(output if output.exists() else path)
    root = tree.getroot()
    source_lang, target_lang = get_languages(root)

    seed_memory(root, memory, source_lang, target_lang)

    jobs, total = plan_file(root, args, shape)
    pending = len(jobs) if budget is None else min(len(jobs), budget)

    reporter.file_started(path, output, pending, total)

    done = 0
    current = None

    for block, unit in jobs[:pending]:
        if (block.target_lang, block.scope) != current:
            engine.start_block()
            current = (block.target_lang, block.scope)

        if args.dry_run:
            show_prompts(block, unit, reporter)
            done += 1
            continue

        started = reporter.elapsed
        text, origin, issues, review = resolve(engine, block, unit, memory)

        if not text.strip():
            reporter.warn(f"  {unit.scope}/{unit.key}: no translation, left pending.")
            continue

        try:
            apply_unit(unit, text, review)
        except RuntimeError as exc:
            reporter.warn(f"  {unit.scope}/{unit.key}: {exc}")
            reporter.warn("  Left pending.")
            continue

        save_tree(tree, output)

        done += 1
        reporter.unit_done(
            Record(
                scope=unit.scope,
                key=unit.key,
                unit=unit.id,
                source=unit.source,
                target=text,
                origin=origin,
                issues=issues,
                review=review,
                seconds=reporter.elapsed - started,
            ),
            done,
            pending,
        )

    return done


def run(args, reporter) -> int:
    engine = build_engine(args.backend, args.model, args.temperature)
    memory = TranslationMemory(enabled=args.memory)

    if not args.dry_run:
        reporter.say(f"Loading {engine.name} model {engine.model}…")
        engine.load()

        if engine.load_seconds:
            reporter.say(f"Loaded in {engine.load_seconds:.1f}s")

        reporter.reset()

    shape = {"profile": profile_for(args, engine.model), "injection": args.inject}
    reporter.say(f"Prompt profile: {shape['profile']} (inject: {shape['injection']})")

    budget = args.limit

    for path in args.inputs:
        if budget is not None and budget <= 0:
            break

        done = run_file(path, engine, args, memory, reporter, budget, shape)

        if budget is not None:
            budget -= done

    if args.dry_run:
        return 0

    summary = reporter.finish(engine, memory)

    if args.report is not None:
        write_report(args.report, summary, reporter)
        reporter.say(f"\nReport: {args.report}")

    return 0


def main() -> None:
    args = build_arg_parser().parse_args()
    reporter = Reporter(as_json=args.as_json)

    missing = [path for path in args.inputs if not path.exists()]

    if missing:
        reporter.warn(f"ERROR: file does not exist: {', '.join(str(p) for p in missing)}")
        sys.exit(1)

    if args.output is not None and len(args.inputs) > 1:
        reporter.warn("ERROR: --output only makes sense with a single input file.")
        sys.exit(1)

    try:
        sys.exit(run(args, reporter))
    except HostUnsupportedError as exc:
        reporter.warn(f"ERROR: {exc}")
        sys.exit(1)
    except KeyboardInterrupt:
        reporter.warn("\nInterrupted. Everything translated so far is saved.")
        sys.exit(130)
    except RuntimeError as exc:
        reporter.warn(f"ERROR: {exc}")
        reporter.warn("Everything translated so far is saved in the output file.")
        sys.exit(1)


if __name__ == "__main__":
    main()
