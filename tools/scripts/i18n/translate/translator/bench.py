"""The bench harness: the same blank file through one model after another, each
pass checked unit by unit and scored against the expectations written beside
it, all of it side by side in one markdown. The checks live in scoring.py; what
lives here is the loop, the clock and the table."""

from __future__ import annotations

import hashlib
import json
import time
from argparse import Namespace
from collections import Counter
from dataclasses import dataclass, field
from datetime import datetime
from itertools import combinations
from pathlib import Path

from .environment import HostUnsupportedError
from .models import DEFAULT_ALIAS, TRANSLATE, profile_for
from .prompting import blocks_of, build_messages, is_pending
from .report import Reporter
from .scoring import (
    Verdict,
    answers_of,
    by_axis,
    details,
    duel,
    failing,
    load_expectations,
    sign_test,
    summarise,
    verdicts_of,
)
from .tables import ruled
from .xliff_io import find_files, get_languages, read_xliff

DEEPL = "deepl"
BENCH_DIR = Path(__file__).resolve().parents[2] / "bench"
EXPECT_DIR = "expect"
BLANK = ".blank"
DEFAULT_OUT = Path("bench-runs")
REPORT_NAME = "comparison.md"
NONE = "—"
PRINT = 8
CODE_FILES = (
    "__main__.py",
    "context.py",
    "engine.py",
    "memory.py",
    "placeholders.py",
    "prompting.py",
    "samples.py",
    "validate.py",
    "xliff_io.py",
)
QUALITY = (
    "model",
    "prompt",
    "answered",
    "critical",
    "major",
    "minor",
    "clean",
    "expected",
    "forms",
    "chrF",
    "review",
)
COST = ("model", "units/min", "s/unit", "tokens/s", "calls", "prompt tokens/call", "seconds")
PAIRS = ("a", "b", "a better", "b better", "tie", "p")
BROKEN_TITLE = (
    "Head to head on what would ship broken (critical checks and assertions; p from a sign test):"
)
RANK_TITLE = "Head to head on every failure, minor ones included:"


@dataclass
class Pass:
    alias: str
    lang: str
    source: Path
    reference: Path | None
    output: Path
    profile: str
    inject: str
    summary: dict = field(default_factory=dict)
    reused: bool = False
    error: str = ""

    @property
    def expect(self) -> Path:
        return self.source.parent / EXPECT_DIR / f"{self.lang}.json"

    @property
    def prompt(self) -> str:
        return (self.summary.get("shape") or {}).get("prompt", NONE)


def aliases_of(args) -> list[str]:
    names = [name.strip() for name in (args.model or DEFAULT_ALIAS).split(",")]

    return [name for name in names if name]


def inputs_of(args) -> list[Path]:
    return list(args.inputs) or sorted(BENCH_DIR.glob(f"*{BLANK}.xlf"))


def bare_stem(path: Path) -> str:
    stem = path.stem

    return stem[: -len(BLANK)] if stem.endswith(BLANK) else stem


# The file handed to the model is the blank one; a neighbour with the good
# translation inside, when there is one, adds its answers to the references.
def reference_for(path: Path, args) -> Path | None:
    if args.reference is not None:
        return args.reference

    neighbour = path.with_name(f"{bare_stem(path)}{path.suffix}")

    return neighbour if neighbour.exists() and neighbour != path else None


# An alias can also be a bare repository id, and its slashes would name
# directories nobody created.
def output_of(out: Path, path: Path, alias: str) -> Path:
    return out / f"{bare_stem(path)}.{alias.replace('/', '_')}{path.suffix}"


# The XLIFF says what a pass answered, never what it cost: the clock stops with
# the process. Saved beside it, the cost survives, so re-running a finished
# bench rebuilds the whole report — speed included — without loading a model.
def stats_of(output: Path) -> Path:
    return output.with_suffix(".json")


def code_print() -> str:
    digest = hashlib.sha256()
    here = Path(__file__).parent

    for name in CODE_FILES:
        digest.update((here / name).read_bytes())

    return digest.hexdigest()[:PRINT]


def prompt_print(current: Pass, args) -> str:
    if current.alias == DEEPL:
        return NONE

    from .__main__ import next_batch, plan_file

    root = read_xliff(current.source).getroot()
    shape = {"profile": current.profile, "injection": args.inject}
    jobs, _ = plan_file(root, pass_args(args, current.alias), shape)
    size = 1 if current.profile == TRANSLATE else max(1, args.batch)
    digest = hashlib.sha256()
    start = 0

    while start < len(jobs):
        batch = next_batch(jobs, start, size)
        messages = json.dumps(build_messages(batch), ensure_ascii=False, sort_keys=True)
        digest.update(messages.encode("utf-8"))
        start += batch.size

    return digest.hexdigest()[:PRINT]


def shape_note(args, current: Pass) -> dict:
    return {
        "profile": current.profile,
        "inject": current.inject,
        "batch": args.batch,
        "temperature": args.temperature,
        "think": args.think,
        "prompt": prompt_print(current, args),
        "code": code_print(),
    }


def save_stats(args, current: Pass) -> None:
    current.summary = {**current.summary, "shape": shape_note(args, current)}

    try:
        stats_of(current.output).write_text(
            json.dumps(current.summary, ensure_ascii=False, indent=2), encoding="utf-8"
        )
    except OSError:
        pass


def load_stats(current: Pass) -> dict:
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


def checked(args, reporter) -> list[tuple[Path, Path | None]] | None:
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
            if target is not None and not target.exists():
                reporter.warn(f"ERROR: file does not exist: {target}")

                return None

        if reference == path:
            reporter.warn(f"ERROR: {path} is its own reference.")

            return None

        pairs.append((path, reference))

    return pairs


# Model by model rather than file by file: the weights are loaded once per pass
# either way, and this order lets an interrupted bench end on a whole model.
def planned(args, pairs: list[tuple[Path, Path | None]], out: Path) -> list[Pass]:
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


def scored(group: list[Pass], args) -> dict[str, dict[str, Verdict]]:
    first = group[0]
    expectations = load_expectations(first.expect)
    reference = answers_of(first.reference, args.scope)[1] if first.reference else {}
    sheets = {}

    for current in group:
        if current.error or not current.output.exists():
            continue

        verdicts = verdicts_of(current.output, expectations, reference, args.scope)

        if any(verdict.answer.target for verdict in verdicts.values()):
            sheets[current.alias] = verdicts

    return sheets


def blank_row(current: Pass, headings: tuple[str, ...], why: str) -> tuple[str, ...]:
    return (current.alias, why, *(NONE for _ in headings[2:]))


def ratio(part: int, whole: int) -> str:
    return f"{part}/{whole}" if whole else NONE


def quality_row(current: Pass, verdicts: dict[str, Verdict]) -> tuple[str, ...]:
    summary = summarise(verdicts)
    answered = len([verdict for verdict in verdicts.values() if verdict.answer.target])

    return (
        current.alias,
        current.prompt,
        ratio(answered, summary.units),
        str(summary.critical),
        str(summary.major),
        str(summary.minor),
        f"{100 * summary.clean / summary.units:.0f}%" if summary.units else NONE,
        ratio(summary.met, summary.expected),
        ratio(summary.groups_ok, summary.groups),
        NONE if summary.score is None else f"{summary.score:.1f}",
        str(summary.review),
    )


def standing(verdicts: dict[str, Verdict]) -> tuple:
    summary = summarise(verdicts)

    return (
        summary.critical,
        summary.expected - summary.met,
        summary.major,
        -(summary.score or 0.0),
        summary.minor,
    )


def quality_rows(group: list[Pass], sheets: dict[str, dict[str, Verdict]]) -> list[tuple]:
    rated = sorted(
        (current for current in group if current.alias in sheets),
        key=lambda current: standing(sheets[current.alias]),
    )
    rows = [QUALITY, *(quality_row(current, sheets[current.alias]) for current in rated)]

    for current in group:
        if current.alias not in sheets:
            rows.append(blank_row(current, QUALITY, "failed" if current.error else "no answers"))

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


def code_rows(sheets: dict[str, dict[str, Verdict]]) -> list[tuple]:
    counts = {alias: summarise(verdicts).codes for alias, verdicts in sheets.items()}
    codes = sorted({code for tally in counts.values() for code in tally})

    if not codes:
        return []

    rows = [("model", *codes)]

    for alias, tally in counts.items():
        rows.append((alias, *(str(tally.get(code, 0)) for code in codes)))

    return rows


def axis_rows(sheets: dict[str, dict[str, Verdict]]) -> list[tuple]:
    tallies = {alias: by_axis(verdicts) for alias, verdicts in sheets.items()}
    axes = sorted({axis for tally in tallies.values() for axis in tally})

    if not axes:
        return []

    rows = [("model", *axes)]

    for alias, tally in tallies.items():
        rows.append((alias, *(ratio(*tally[axis]) if axis in tally else NONE for axis in axes)))

    return rows


def pair_rows(sheets: dict[str, dict[str, Verdict]], aspect: str) -> list[tuple]:
    if len(sheets) < 2:
        return []

    rows = [PAIRS]

    for left, right in combinations(sheets, 2):
        wins, losses, ties = duel(sheets[left], sheets[right], aspect)
        p = f"{sign_test(wins, losses):.2f}"
        rows.append((left, right, str(wins), str(losses), str(ties), p))

    return rows


def cells(row: tuple[str, ...]) -> str:
    return " | ".join(cell.replace("|", "\\|") for cell in row)


def table(rows: list[tuple]) -> list[str]:
    if not rows:
        return []

    head, *body = rows
    lines = [f"| {cells(head)} |", f"| {' | '.join('---' for _ in head)} |"]

    return lines + [f"| {cells(row)} |" for row in body]


def titled(title: str, rows: list[tuple]) -> list[str]:
    return ["", title, "", *table(rows)] if rows else []


def failing_units(sheets: dict[str, dict[str, Verdict]]) -> list[str]:
    counts: Counter = Counter()

    for verdicts in sheets.values():
        counts.update(unit for unit, verdict in verdicts.items() if failing(verdict))

    return sorted(counts, key=lambda unit: (-counts[unit], unit))


def failure_lines(sheets: dict[str, dict[str, Verdict]], unit: str, width: int) -> list[str]:
    verdicts = [(alias, sheet[unit]) for alias, sheet in sheets.items() if unit in sheet]
    answer, expectation = verdicts[0][1].answer, verdicts[0][1].expectation
    lines = [
        f"\n{answer.scope}/{answer.name}",
        f"  {'source'.ljust(width)}  {answer.shown_source!r}",
    ]

    if expectation.refs:
        lines.append(f"  {'ref'.ljust(width)}  {expectation.refs[0]!r}")

    for alias, verdict in verdicts:
        target = verdict.answer.shown_target
        lines.append(f"  {alias.ljust(width)}  {target!r}  [{details(verdict)}]")

    return lines


def failure_block(sheets: dict[str, dict[str, Verdict]], worst: int) -> list[str]:
    units = failing_units(sheets)

    if not units:
        return ["", "No unit failed a critical check or an expectation."]

    width = max(len("source"), *(len(alias) for alias in sheets))
    lines = [line for unit in units[:worst] for line in failure_lines(sheets, unit, width)]

    return [
        "",
        f"Where they fail, {min(worst, len(units))} of {len(units)} units with a critical "
        "check or an expectation broken:",
        "",
        "```",
        *lines,
        "```",
    ]


def expectation_note(group: list[Pass]) -> str:
    first = group[0]
    expectations = load_expectations(first.expect)
    written = len([unit for unit in expectations.units.values() if unit.count or unit.refs])

    if not written:
        return "No expectations written for this language: automatic checks only."

    return f"Expectations: `{first.expect}` ({written} units)."


def mixed_note(group: list[Pass]) -> list[str]:
    prints = {current.prompt for current in group if current.prompt != NONE}

    if len(prints) < 2:
        return []

    return [
        "",
        "**Not every pass ran with the same prompt** (column `prompt`): compare them with care.",
    ]


def section(group: list[Pass], args, reporter) -> list[str]:
    lang = group[0].lang
    sheets = scored(group, args)
    quality = quality_rows(group, sheets)
    cost = cost_rows(group)

    reporter.say(f"\n{lang} · {group[0].source.name}\n")
    reporter.say(ruled(quality))
    reporter.say("")
    reporter.say(ruled(cost))

    return [
        "",
        f"## {lang}",
        "",
        expectation_note(group),
        *mixed_note(group),
        "",
        *table(quality),
        *titled("Cost:", cost),
        *titled("Failed checks, by code:", code_rows(sheets)),
        *titled("Expectations met, by axis:", axis_rows(sheets)),
        *titled(BROKEN_TITLE, pair_rows(sheets, "broken")),
        *titled(RANK_TITLE, pair_rows(sheets, "rank")),
        *failure_block(sheets, args.worst),
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
        f"thinking {'on the last try' if args.think else 'off'}, translation memory off",
        f"- Code: `{code_print()}`",
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
