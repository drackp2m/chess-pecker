"""The bench harness: the same blank file through one model after another, each
pass scored against the translation written by hand, all of it side by side in
one markdown. The metrics are the ones validate.py and compare.py already
compute; what lives here is the loop, the clock and the table."""

from __future__ import annotations

import json
import time
from argparse import Namespace
from collections import Counter
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path

from .compare import Sheet, between, mean, per_unit, sheet_of, shared_ids, worst_lines
from .environment import HostUnsupportedError
from .models import DEFAULT_ALIAS, TRANSLATE, profile_for
from .prompting import blocks_of, is_pending
from .report import Reporter
from .tables import ruled
from .xliff_io import find_files, get_languages, read_xliff

DEEPL = "deepl"
BENCH_DIR = Path(__file__).resolve().parents[2] / "bench"
BLANK = ".blank"
DEFAULT_OUT = Path("bench-runs")
REPORT_NAME = "comparison.md"
WEAK = 50
NONE = "—"
QUALITY = (
    "model",
    "profile",
    "inject",
    "units",
    "missing",
    "chrF",
    "worst",
    f"under {WEAK}",
    "review",
    "checks failed",
)
COST = ("model", "units/min", "s/unit", "tokens/s", "calls", "prompt tokens/call", "seconds")


@dataclass
class Pass:
    alias: str
    lang: str
    source: Path
    reference: Path
    output: Path
    profile: str
    inject: str
    summary: dict = field(default_factory=dict)
    reused: bool = False
    error: str = ""


def aliases_of(args) -> list[str]:
    names = [name.strip() for name in (args.model or DEFAULT_ALIAS).split(",")]

    return [name for name in names if name]


def inputs_of(args) -> list[Path]:
    return list(args.inputs) or sorted(BENCH_DIR.glob(f"*{BLANK}.xlf"))


def bare_stem(path: Path) -> str:
    stem = path.stem

    return stem[: -len(BLANK)] if stem.endswith(BLANK) else stem


# The file handed to the model is the blank one; the one with the good
# translation inside is its neighbour, and it is the yardstick of every pass.
def reference_for(path: Path, args) -> Path:
    if args.reference is not None:
        return args.reference

    return path.with_name(f"{bare_stem(path)}{path.suffix}")


# An alias can also be a bare repository id, and its slashes would name
# directories nobody created.
def output_of(out: Path, path: Path, alias: str) -> Path:
    return out / f"{bare_stem(path)}.{alias.replace('/', '_')}{path.suffix}"


# The XLIFF says what a pass answered, never what it cost: the clock stops with
# the process. Saved beside it, the cost survives, so re-running a finished
# bench rebuilds the whole report — speed included — without loading a model.
def stats_of(output: Path) -> Path:
    return output.with_suffix(".json")


def shape_note(args, current: "Pass") -> dict:
    return {
        "profile": current.profile,
        "inject": current.inject,
        "batch": args.batch,
        "temperature": args.temperature,
    }


def save_stats(args, current: "Pass") -> None:
    payload = {**current.summary, "shape": shape_note(args, current)}

    try:
        stats_of(current.output).write_text(
            json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8"
        )
    except OSError:
        pass


def load_stats(current: "Pass") -> dict:
    path = stats_of(current.output)

    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {}


def lang_of(path: Path) -> str:
    return get_languages(read_xliff(path).getroot())[1]


def pending_of(path: Path, scopes: list[str]) -> int:
    root = read_xliff(path).getroot()
    langs = get_languages(root)
    left = 0

    for element in find_files(root):
        block, units = blocks_of(element, *langs)

        if scopes and block.scope not in scopes:
            continue

        left += len([unit for unit in units if is_pending(unit)])

    return left


def shape_of(args, alias: str) -> tuple[str, str]:
    if alias == DEEPL:
        return DEEPL, NONE

    profile = args.profile if args.profile != "auto" else profile_for(alias)

    return profile, args.inject if profile == TRANSLATE else NONE


def pass_args(args, alias: str) -> Namespace:
    settings = Namespace(**vars(args))
    settings.model = None if alias == DEEPL else alias
    settings.memory = False
    settings.report = None
    settings.output = None
    settings.bench = False

    return settings


def codes_of(reporter: Reporter) -> dict[str, int]:
    counts: Counter = Counter()

    for record in reporter.records:
        counts.update(issue.split(":")[0] for issue in record.issues)

    return dict(counts)


# DeepL keeps no token accounting of its own, so its row says what it can and
# nothing more — but the checks did run on its answers, and counting them off
# the records is what keeps that column comparable with the models'.
def summary_of(reporter: Reporter, elapsed: float) -> dict:
    if reporter.finished:
        return reporter.finished

    minutes = elapsed / 60

    return {
        "translated": reporter.translated,
        "review": len(reporter.reviewed),
        "forms_flagged": len(reporter.groups),
        "seconds": elapsed,
        "units_per_minute": reporter.translated / minutes if minutes else 0.0,
        "tally": {"single_issues": codes_of(reporter)},
    }


def checked(args, reporter) -> list[tuple[Path, Path]] | None:
    paths = inputs_of(args)
    pairs = []

    if args.deepl:
        reporter.warn("ERROR: under --bench, DeepL is one more name in --model.")

        return None

    if args.reference is not None and len(paths) > 1:
        reporter.warn("ERROR: --reference is one file, so it needs a single bench file.")

        return None

    for path in paths:
        reference = reference_for(path, args)

        for target in (path, reference):
            if not target.exists():
                reporter.warn(f"ERROR: file does not exist: {target}")

                return None

        if reference == path:
            reporter.warn(f"ERROR: {path} is its own reference. Give --reference.")

            return None

        pairs.append((path, reference))

    return pairs


# Model by model rather than file by file: the weights are loaded once per pass
# either way, and this order lets an interrupted bench end on a whole model.
def planned(args, pairs: list[tuple[Path, Path]], out: Path) -> list[Pass]:
    plan = []

    for alias in aliases_of(args):
        profile, inject = shape_of(args, alias)

        for path, reference in pairs:
            plan.append(
                Pass(
                    alias=alias,
                    lang=lang_of(path),
                    source=path,
                    reference=reference,
                    output=output_of(out, path, alias),
                    profile=profile,
                    inject=inject,
                )
            )

    return plan


# One model failing to load must not cost the ten hours the passes after it
# would have taken; it loses its row and the bench goes on. A host that cannot
# run MLX at all is the exception: every pass after it would fail the same way.
def run_pass(current: Pass, args, reporter, translate, deepl) -> None:
    inner = Reporter(as_json=args.as_json)
    started = time.perf_counter()
    runner = deepl if current.alias == DEEPL else translate

    try:
        runner(pass_args(args, current.alias), inner, [(current.source, current.output)])
    except HostUnsupportedError:
        raise
    except (RuntimeError, OSError) as exc:
        current.error = str(exc)
        reporter.warn(f"  {current.alias} · {current.lang} failed: {exc}")

        return

    current.summary = summary_of(inner, time.perf_counter() - started)

    save_stats(args, current)


# A finished pass is kept whatever was asked for this time, so the row has to
# describe the file on disk and not the flags of this command — otherwise a
# second experiment in the same directory silently reports the first one's
# answers under its own prompt shape.
def adopt_shape(current: Pass, args, reporter) -> None:
    kept = current.summary.get("shape")

    if not kept:
        return

    asked = shape_note(args, current)
    current.profile = kept.get("profile", current.profile)
    current.inject = kept.get("inject", current.inject)

    if kept == asked:
        return

    reporter.warn(
        f"  {current.alias} · {current.lang} was translated with {kept}, not "
        f"{asked}. Kept as it is; --output a different directory to run it again."
    )


def translate_all(plan: list[Pass], args, reporter, translate, deepl) -> None:
    for index, current in enumerate(plan, start=1):
        head = f"[{index}/{len(plan)}] {current.alias} · {current.lang}"

        if current.output.exists() and not pending_of(current.output, args.scope):
            current.reused = True
            current.summary = load_stats(current)
            kept = "with what it cost" if current.summary else "cost unknown"
            reporter.say(f"\n===== {head}: kept {current.output}, {kept}")
            adopt_shape(current, args, reporter)
            continue

        reporter.say(f"\n===== {head}  →  {current.output}")
        run_pass(current, args, reporter, translate, deepl)


def sheets_of(group: list[Pass], scopes: list[str]) -> dict[str, Sheet]:
    sheets = {}

    for current in group:
        if current.error or not current.output.exists():
            continue

        sheet = sheet_of(current.output, scopes)

        if sheet.answers:
            sheets[current.alias] = sheet

    return sheets


def blank_row(current: Pass, headings: tuple[str, ...], why: str) -> tuple[str, ...]:
    return (current.alias, why, *(NONE for _ in headings[2:]))


def failed_checks(summary: dict) -> str:
    tally = summary.get("tally") or {}
    counts = Counter(tally.get("batch_issues") or {})
    counts.update(tally.get("single_issues") or {})

    return ", ".join(f"{code} {count}" for code, count in counts.most_common()) or NONE


def quality_row(current: Pass, scores: list[float], missing: int) -> tuple[str, ...]:
    review = current.summary.get("review")

    return (
        current.alias,
        current.profile,
        current.inject,
        str(len(scores)),
        str(missing),
        f"{mean(scores):.1f}",
        f"{min(scores):.1f}",
        str(len([score for score in scores if score < WEAK])),
        NONE if review is None else str(review),
        failed_checks(current.summary),
    )


def quality_rows(group: list[Pass], gold: Sheet, sheets: dict[str, Sheet]) -> list[tuple]:
    rows = [QUALITY]

    for current in group:
        sheet = sheets.get(current.alias)

        if sheet is None:
            rows.append(blank_row(current, QUALITY, "failed" if current.error else "no answers"))
            continue

        ids = shared_ids([sheet, gold])

        if not ids:
            rows.append(blank_row(current, QUALITY, "no unit in common"))
            continue

        rows.append(quality_row(current, between(sheet, gold, ids), len(gold.answers) - len(ids)))

    return rows


def number(summary: dict, key: str, digits: int = 1) -> str:
    value = summary.get(key)

    return NONE if value is None else f"{value:.{digits}f}"


def cost_row(current: Pass) -> tuple[str, ...]:
    summary = current.summary
    units, seconds = summary.get("translated", 0), summary.get("seconds", 0.0)

    return (
        current.alias,
        number(summary, "units_per_minute"),
        f"{seconds / units:.1f}" if units else NONE,
        number(summary, "tokens_per_second"),
        str(summary.get("calls", NONE)),
        number(summary, "prompt_tokens_per_call", 0),
        f"{seconds:.0f}",
    )


def cost_rows(group: list[Pass]) -> list[tuple]:
    rows = [COST]

    for current in group:
        if current.reused and current.summary:
            rows.append(cost_row(current))
        elif current.reused:
            rows.append(blank_row(current, COST, "kept"))
        elif current.error or not current.summary:
            rows.append(blank_row(current, COST, "failed"))
        else:
            rows.append(cost_row(current))

    return rows


def by_scope(sheet: Sheet, ids: list[str]) -> dict[str, list[str]]:
    grouped: dict[str, list[str]] = {}

    for unit in ids:
        grouped.setdefault(sheet.answers[unit].scope, []).append(unit)

    return grouped


def scope_rows(group: list[Pass], gold: Sheet, sheets: dict[str, Sheet]) -> list[tuple]:
    grouped = by_scope(gold, list(gold.answers))
    scopes = sorted(grouped)
    rows = [("model", *scopes)]

    for current in group:
        sheet = sheets.get(current.alias)

        if sheet is None:
            continue

        scored = []

        for scope in scopes:
            ids = [unit for unit in grouped[scope] if unit in sheet.answers]
            scored.append(f"{mean(between(sheet, gold, ids)):.1f}" if ids else NONE)

        rows.append((current.alias, *scored))

    return rows


def cells(row: tuple[str, ...]) -> str:
    return " | ".join(cell.replace("|", "\\|") for cell in row)


def table(rows: list[tuple]) -> list[str]:
    head, *body = rows
    lines = [f"| {cells(head)} |", f"| {' | '.join('---' for _ in head)} |"]

    return lines + [f"| {cells(row)} |" for row in body]


def worst_block(group: list[Pass], gold: Sheet, sheets: dict[str, Sheet], worst: int) -> list[str]:
    rated = [sheets[current.alias] for current in group if current.alias in sheets]

    if not rated:
        return []

    ids = shared_ids([gold, *rated])

    if not ids:
        return ["", "No unit is answered by every pass, so there is nothing to line up."]

    scores = per_unit(rated, ids, gold)
    shown = min(worst, len(ids))

    return [
        "",
        f"Where they disagree most, worst {shown} of {len(ids)} "
        "(mean chrF against the reference):",
        "",
        "```",
        *worst_lines([gold, *rated], ids, scores, worst),
        "```",
    ]


def section(group: list[Pass], args, reporter) -> list[str]:
    lang = group[0].lang
    gold = sheet_of(group[0].reference, args.scope)
    sheets = sheets_of(group, args.scope)
    quality = quality_rows(group, gold, sheets)

    cost = cost_rows(group)

    reporter.say(f"\n{lang} · scored against {group[0].reference.name}\n")
    reporter.say(ruled(quality))
    reporter.say("")
    reporter.say(ruled(cost))

    return [
        "",
        f"## {lang}",
        "",
        f"Every pass scored against `{group[0].reference}` "
        f"({len(gold.answers)} translated units).",
        "",
        *table(quality),
        "",
        "Cost:",
        "",
        *table(cost),
        "",
        "chrF by scope:",
        "",
        *table(scope_rows(group, gold, sheets)),
        *worst_block(group, gold, sheets, args.worst),
    ]


# One section per bench file, not per language: a file is what has a reference
# of its own, and two files could well ask for the same language.
def grouped(plan: list[Pass]) -> dict[Path, list[Pass]]:
    groups: dict[Path, list[Pass]] = {}

    for current in plan:
        groups.setdefault(current.source, []).append(current)

    return groups


def header(plan: list[Pass], args, out: Path) -> list[str]:
    files = sorted({str(current.source) for current in plan})
    aliases = list(dict.fromkeys(current.alias for current in plan))

    return [
        "# Model comparison",
        "",
        f"- Bench: {', '.join(f'`{name}`' for name in files)}",
        f"- Models: {', '.join(f'`{alias}`' for alias in aliases)}",
        f"- Passes written to: `{out}`",
        f"- Settings: temperature {args.temperature}, batch up to {args.batch}, "
        "translation memory off",
        f"- Written: {datetime.now().strftime('%Y-%m-%d %H:%M')}",
    ]


def write_bench(path: Path, plan: list[Pass], args, reporter, out: Path) -> None:
    lines = header(plan, args, out)

    for group in grouped(plan).values():
        lines += section(group, args, reporter)

    path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def run_bench(args, reporter, translate, deepl) -> int:
    if args.dry_run:
        reporter.warn("ERROR: --bench translates for real; --dry-run has nothing to score.")

        return 1

    pairs = checked(args, reporter)

    if pairs is None:
        return 1

    if not pairs:
        reporter.warn(f"ERROR: no bench file given, and no *{BLANK}.xlf in {BENCH_DIR}.")

        return 1

    out = args.output if args.output is not None else DEFAULT_OUT
    plan = planned(args, pairs, out)

    out.mkdir(parents=True, exist_ok=True)
    translate_all(plan, args, reporter, translate, deepl)
    report = args.report if args.report is not None else out / REPORT_NAME

    write_bench(report, plan, args, reporter, out)
    reporter.say(f"\nComparison: {report}")

    return 0
