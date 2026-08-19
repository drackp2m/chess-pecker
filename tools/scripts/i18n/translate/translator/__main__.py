#!/usr/bin/env python3
"""Translate empty XLIFF 2.0 targets with a local model."""

from __future__ import annotations

import argparse
import sys
import time
from pathlib import Path

from .environment import HostUnsupportedError, require_mlx_runtime
from .glossary import (
    build_or_load_glossary,
    glossary_terms_for_text,
)
from .ollama_client import (
    BIG_MODEL,
    DEFAULT_GLOSSARY_MODEL,
    DEFAULT_MODEL,
    ollama_translate,
)
from .placeholders import (
    salvage_missing_markers,
    strip_hallucinated_placeholders,
)
from .xliff_io import (
    XLIFF_NS,
    build_target,
    expected_markers_for,
    find_segments,
    get_languages,
    read_xliff,
    replace_target,
    save_tree,
    source_to_prompt_text,
    target_is_empty,
)

EPILOG = """\
examples:
  # Translate translations/fr-FR.xlf, writing translations/fr-FR.translated.xlf
  uv run --project tools/scripts/i18n/translate translate translations/fr-FR.xlf

  # From inside the tool directory the --project flag is not needed
  cd tools/scripts/i18n/translate && uv run translate translations/fr-FR.xlf

  # Re-run later: automatically resumes from the existing output
  uv run translate translations/fr-FR.xlf

  # Use the bigger 12b model
  uv run translate translations/fr-FR.xlf --12b

  # Skip the glossary pass entirely
  uv run translate translations/fr-FR.xlf --no-glossary

  # Give the model domain context for every translation (not just
  # the glossary) — helps with ambiguous words like chess pieces
  uv run translate translations/fr-FR.xlf \\
      --context "aplicación de ajedrez, método Woodpecker"

  # Force the glossary to be recomputed
  uv run translate translations/fr-FR.xlf --rebuild-glossary

  # Only translate the next 20 pending segments
  uv run translate translations/fr-FR.xlf --limit 20
"""


def build_arg_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="translate",
        description=(
            "Translate empty <target> segments in an XLIFF 2.0 file "
            "using a local model. Runs on the host (macOS), never "
            "inside the devcontainer. "
            "Placeholders (<ph>) are preserved, progress is saved "
            "after every segment, and re-running the same command "
            "resumes automatically from the existing output file."
        ),
        epilog=EPILOG,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )

    parser.add_argument(
        "input",
        type=Path,
        help="Input XLIFF file",
    )

    parser.add_argument(
        "-o",
        "--output",
        type=Path,
        help="Output XLIFF file. Defaults to <input>.translated.xlf",
    )

    parser.add_argument(
        "--backend",
        choices=("mlx", "ollama"),
        default="ollama",
        help=(
            "Translation engine. 'ollama' is the prototype engine and "
            "the current default; 'mlx' is the resident in-process "
            "engine and is not wired up yet. (default: ollama)"
        ),
    )

    parser.add_argument(
        "--12b",
        dest="use_12b",
        action="store_true",
        help=f"Use {BIG_MODEL} instead of the default {DEFAULT_MODEL}.",
    )

    parser.add_argument(
        "--model",
        default=None,
        help=(
            "Ollama model used for the actual translations. Overrides "
            f"--12b. (default: {DEFAULT_MODEL})"
        ),
    )

    parser.add_argument(
        "--delay",
        type=float,
        default=0,
        help="Seconds to wait between translations (default: 0).",
    )

    parser.add_argument(
        "--limit",
        type=int,
        default=None,
        help="Translate at most N segments in this run.",
    )

    parser.add_argument(
        "--context",
        default=None,
        help=(
            "Free-text domain context applied to EVERY translation "
            "(not just the glossary), e.g. 'aplicación de ajedrez, "
            "método Woodpecker'. Helps disambiguate words with "
            "multiple meanings (e.g. chess pieces vs. their everyday "
            "sense)."
        ),
    )

    glossary_group = parser.add_argument_group(
        "glossary options",
        "Pre-pass that finds recurring words, translates them once, "
        "and reuses that glossary as context in every prompt so "
        "terminology stays consistent across the document.",
    )

    glossary_group.add_argument(
        "--no-glossary",
        dest="use_glossary",
        action="store_false",
        help="Disable the repeated-terms glossary pass.",
    )

    glossary_group.add_argument(
        "--glossary-model",
        default=DEFAULT_GLOSSARY_MODEL,
        help=(
            "Lightweight Ollama model used to pick which candidate "
            "words are real terminology. (default: "
            f"{DEFAULT_GLOSSARY_MODEL})"
        ),
    )

    glossary_group.add_argument(
        "--glossary-min-count",
        type=int,
        default=2,
        help=(
            "Minimum occurrences for a word to be a glossary "
            "candidate (default: 2)."
        ),
    )

    glossary_group.add_argument(
        "--glossary-top-n",
        type=int,
        default=80,
        help="Max number of glossary candidate words to consider (default: 80).",
    )

    glossary_group.add_argument(
        "--glossary-context",
        default=None,
        help=(
            "Free-text context for the glossary-building steps "
            "specifically (filtering and translating terms). "
            "Defaults to --context if not given separately."
        ),
    )

    glossary_group.add_argument(
        "--no-glossary-interactive",
        dest="glossary_interactive",
        action="store_false",
        help=(
            "Skip the terminal prompt to manually review/edit the "
            "glossary term list before translating it."
        ),
    )

    glossary_group.add_argument(
        "--rebuild-glossary",
        action="store_true",
        help="Recompute the glossary even if a cached one exists.",
    )

    parser.set_defaults(use_glossary=True, glossary_interactive=True)

    return parser


def resolve_model(args) -> str:
    if args.model:
        return args.model
    if args.use_12b:
        return BIG_MODEL
    return DEFAULT_MODEL


def translate_segment(
    segment,
    source,
    source_lang: str,
    target_lang: str,
    model: str,
    glossary: dict[str, str],
    context: str | None = None,
):
    """
    Translate one segment, retrying with progressively stronger
    prompts, and finally salvaging dropped placeholders as a last
    resort. Returns the new <target> element.
    """
    source_text, _ = source_to_prompt_text(source)
    expected_markers = expected_markers_for(source)
    relevant_glossary = glossary_terms_for_text(glossary, source_text)

    print(f"    Translating: {source_text!r}")

    translated = ollama_translate(
        source_text,
        source_lang,
        target_lang,
        model,
        expected_markers,
        glossary_terms=relevant_glossary,
        context=context,
    )
    translated = strip_hallucinated_placeholders(translated, expected_markers)
    print(f"    → {translated!r}")

    try:
        return build_target(source, translated)
    except RuntimeError:
        pass

    # Retry 1: stricter prompt (temperature is 0, so the retry must
    # change the prompt to be useful).
    print("    Retrying with stricter prompt...")
    translated = ollama_translate(
        source_text,
        source_lang,
        target_lang,
        model,
        expected_markers,
        strict=True,
        glossary_terms=relevant_glossary,
        context=context,
    )
    translated = strip_hallucinated_placeholders(translated, expected_markers)
    print(f"    → {translated!r}")

    try:
        return build_target(source, translated)
    except RuntimeError:
        pass

    # Retry 2: example-based prompt. Useful for placeholders in the
    # middle of the sentence, which small models tend to drop.
    print("    Retrying with example-based prompt...")
    translated = ollama_translate(
        source_text,
        source_lang,
        target_lang,
        model,
        expected_markers,
        strict=True,
        with_example=True,
        glossary_terms=relevant_glossary,
        context=context,
    )
    translated = strip_hallucinated_placeholders(translated, expected_markers)
    print(f"    → {translated!r}")

    try:
        return build_target(source, translated)
    except RuntimeError:
        pass

    # Last resort: re-attach dropped markers. Start/end markers go
    # back exactly where they were; mid-sentence markers are placed
    # with a best-effort heuristic (prints its own WARNING) since
    # there's no way to know the correct grammatical spot for
    # certain.
    salvaged = salvage_missing_markers(source_text, translated, expected_markers)
    return build_target(source, salvaged)


def main():
    parser = build_arg_parser()
    args = parser.parse_args()

    if args.backend == "mlx":
        try:
            require_mlx_runtime()
        except HostUnsupportedError as exc:
            print(f"ERROR: {exc}", file=sys.stderr)
            sys.exit(1)

        print(
            "ERROR: the MLX backend is not implemented yet. "
            "Use --backend ollama until then.",
            file=sys.stderr,
        )
        sys.exit(1)

    model = resolve_model(args)
    glossary_context = args.glossary_context or args.context

    if not args.input.exists():
        print(f"ERROR: File does not exist: {args.input}", file=sys.stderr)
        sys.exit(1)

    output_path = args.output or args.input.with_name(
        f"{args.input.stem}.translated{args.input.suffix}"
    )

    if output_path.exists():
        print(f"Resuming from existing output: {output_path}")
        tree = read_xliff(output_path)
    else:
        tree = read_xliff(args.input)

    root = tree.getroot()
    source_lang, target_lang = get_languages(root)

    print(f"Source language: {source_lang}")
    print(f"Target language: {target_lang}")
    print(f"Backend:        {args.backend}")
    print(f"Model:          {model}")
    print(f"Input:          {args.input}")
    print(f"Output:         {output_path}")
    if args.context:
        print(f"Context:        {args.context}")
    print()

    segments = find_segments(root)
    pending = [s for s in segments if target_is_empty(s)]

    print(f"Total segments: {len(segments)}")
    print(f"Pending:        {len(pending)}")
    print()

    glossary: dict[str, str] = {}

    if args.use_glossary:
        glossary_path = output_path.with_name(
            f"{args.input.stem}.glossary.json"
        )
        glossary = build_or_load_glossary(
            segments,
            source_lang,
            target_lang,
            model,
            args.glossary_model,
            glossary_path,
            min_count=args.glossary_min_count,
            top_n=args.glossary_top_n,
            rebuild=args.rebuild_glossary,
            context=glossary_context,
            interactive=args.glossary_interactive,
        )
        print()

    translated_count = 0

    for index, segment in enumerate(pending, start=1):
        source = segment.find(f"{{{XLIFF_NS}}}source")

        if source is None:
            print(
                f"[{index}/{len(pending)}] WARNING: "
                "segment without <source>, skipping."
            )
            continue

        print(f"[{index}/{len(pending)}]")

        try:
            new_target = translate_segment(
                segment, source, source_lang, target_lang, model, glossary,
                context=args.context,
            )

            replace_target(segment, new_target)

            # VERY IMPORTANT: save after every translation.
            save_tree(tree, output_path)

            translated_count += 1
            print("    Saved.")

        except Exception as exc:
            print(f"    ERROR: {exc}", file=sys.stderr)
            print(
                f"\nStopped after {translated_count} translations.\n"
                f"The already translated segments are saved in:\n"
                f"{output_path}\n",
                file=sys.stderr,
            )
            sys.exit(1)

        if args.limit is not None and translated_count >= args.limit:
            print(f"\nReached --limit {args.limit}.")
            break

        if args.delay:
            time.sleep(args.delay)

    print()
    print(f"Done. Translated: {translated_count}")
    print(f"Output: {output_path}")


if __name__ == "__main__":
    main()
