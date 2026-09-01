from __future__ import annotations

import re
from dataclasses import dataclass
from itertools import combinations
from pathlib import Path

from .prompting import blocks_of
from .tables import ruled
from .xliff_io import find_files, get_languages, read_xliff

ORDER = 6
BETA = 2.0
MARKER_RE = re.compile(r"__PH_([A-Za-z0-9]+)__")
SENTINEL = 0xE000
HEADINGS = ("file", "units", "chrF", "worst", "under 50")
PAIR_HEADINGS = ("a", "b", "chrF")


@dataclass(frozen=True)
class Answer:
    scope: str
    key: str
    source: str
    target: str


@dataclass(frozen=True)
class Sheet:
    path: Path
    lang: str
    answers: dict[str, Answer]

    @property
    def name(self) -> str:
        return self.path.name


def flattened(text: str) -> str:
    ids: dict[str, str] = {}

    def swap(found: re.Match) -> str:
        return ids.setdefault(found.group(1), chr(SENTINEL + len(ids)))

    return "".join(MARKER_RE.sub(swap, text).split()).lower()


def grams(text: str, order: int) -> dict[str, int]:
    counts: dict[str, int] = {}

    for index in range(len(text) - order + 1):
        piece = text[index : index + order]
        counts[piece] = counts.get(piece, 0) + 1

    return counts


def overlap(left: dict[str, int], right: dict[str, int]) -> int:
    return sum(min(count, right.get(piece, 0)) for piece, count in left.items())


# Only the orders both strings can actually have are averaged. Dividing by six
# regardless caps a four-character string at 66.7 and a lone placeholder at
# 16.7 even when it matches the reference exactly, which would score half the
# bench — every one-word label — on how long it is rather than how right it is.
def scored(left: str, right: str) -> tuple[float, float]:
    precisions = []
    recalls = []

    for order in range(1, ORDER + 1):
        mine, theirs = grams(left, order), grams(right, order)

        if not mine or not theirs:
            continue

        shared = overlap(mine, theirs)
        precisions.append(shared / sum(mine.values()))
        recalls.append(shared / sum(theirs.values()))

    if not precisions:
        return 0.0, 0.0

    return sum(precisions) / len(precisions), sum(recalls) / len(recalls)


# chrF: the character n-gram F-score, which needs no tokenizer and does not
# punish a language for gluing its morphemes together — which is the whole
# reason it survives Russian and Catalan where a word-level score would not.
def chrf(left: str, right: str) -> float:
    mine, theirs = flattened(left), flattened(right)

    if not mine or not theirs:
        return 100.0 if mine == theirs else 0.0

    precision, recall = scored(mine, theirs)

    if not precision or not recall:
        return 0.0

    weight = BETA * BETA

    return 100 * (1 + weight) * precision * recall / (weight * precision + recall)


def sheet_of(path: Path, scopes: list[str]) -> Sheet:
    root = read_xliff(path).getroot()
    langs = get_languages(root)
    answers: dict[str, Answer] = {}

    for element in find_files(root):
        block, units = blocks_of(element, *langs)

        if scopes and block.scope not in scopes:
            continue

        for unit in units:
            if unit.previous.strip():
                answers[unit.id] = Answer(block.scope, unit.key, unit.source, unit.previous)

    return Sheet(path, langs[1], answers)


def shared_ids(sheets: list[Sheet]) -> list[str]:
    common = set.intersection(*(set(sheet.answers) for sheet in sheets))

    return [unit for unit in sheets[0].answers if unit in common]


def mean(values: list[float]) -> float:
    return sum(values) / len(values) if values else 0.0


def between(left: Sheet, right: Sheet, ids: list[str]) -> list[float]:
    return [chrf(left.answers[unit].target, right.answers[unit].target) for unit in ids]


def per_unit(sheets: list[Sheet], ids: list[str], anchor: Sheet | None = None) -> dict[str, float]:
    pairs = [(anchor, sheet) for sheet in sheets] if anchor else list(combinations(sheets, 2))

    return {
        unit: mean([chrf(a.answers[unit].target, b.answers[unit].target) for a, b in pairs])
        for unit in ids
    }


def scores_of(sheet: Sheet, others: list[Sheet], ids: list[str]) -> list[float]:
    columns = [between(sheet, other, ids) for other in others if other is not sheet]

    return [mean([column[index] for column in columns]) for index in range(len(ids))]


def row_of(sheet: Sheet, scores: list[float], ids: list[str]) -> tuple[str, ...]:
    weak = len([score for score in scores if score < 50])

    return (
        sheet.name,
        str(len(ids)),
        f"{mean(scores):.1f}",
        f"{min(scores):.1f}" if scores else "—",
        str(weak),
    )


def pair_table(sheets: list[Sheet], ids: list[str]) -> str:
    rows = [PAIR_HEADINGS]

    for left, right in combinations(sheets, 2):
        rows.append((left.name, right.name, f"{mean(between(left, right, ids)):.1f}"))

    return ruled(rows)


def worst_lines(sheets: list[Sheet], ids: list[str], scores: dict[str, float], worst: int) -> list[str]:
    order = sorted(ids, key=lambda unit: scores[unit])[:worst]
    lines = []
    width = max(len(sheet.name) for sheet in sheets)

    for unit in order:
        first = sheets[0].answers[unit]
        lines.append(f"\n {scores[unit]:5.1f}  {first.scope}/{first.key}")
        lines.append(f"        {'source'.ljust(width)}  {first.source!r}")

        for sheet in sheets:
            lines.append(f"        {sheet.name.ljust(width)}  {sheet.answers[unit].target!r}")

    return lines


def loaded(reporter, paths: list[Path], scopes: list[str]) -> list[Sheet] | None:
    sheets = [sheet_of(path, scopes) for path in paths]
    langs = {sheet.lang for sheet in sheets}

    if len(langs) > 1:
        reporter.warn(f"ERROR: these files are not the same language: {', '.join(sorted(langs))}.")

        return None

    empty = [sheet.name for sheet in sheets if not sheet.answers]

    if empty:
        reporter.warn(f"ERROR: no translated units in {', '.join(empty)}.")

        return None

    return sheets


def heading(reporter, sheets: list[Sheet], ids: list[str], reference: Sheet | None) -> None:
    widest = max(len(sheet.answers) for sheet in sheets)
    reporter.say(f"\n{sheets[0].lang} · {len(sheets)} file(s) · {len(ids)} unit(s) in common")

    if len(ids) < widest:
        reporter.say(f"  {widest - len(ids)} unit(s) skipped: not translated in every file")

    if reference is not None:
        reporter.say(f"  scored against {reference.name}")
    else:
        reporter.say("  no reference: the score is how much each one agrees with the rest")


def compare(reporter, paths: list[Path], reference: Path | None, worst: int, scopes: list[str]) -> int:
    sheets = loaded(reporter, [*paths, *([reference] if reference else [])], scopes)

    if sheets is None:
        return 1

    if len(sheets) < 2:
        reporter.warn("ERROR: --compare needs two files, or one and a --reference.")

        return 1

    anchor = sheets[-1] if reference else None
    rated = sheets[:-1] if reference else sheets
    ids = shared_ids(sheets)

    if not ids:
        reporter.warn("ERROR: these files share no translated unit.")

        return 1

    heading(reporter, sheets, ids, anchor)
    rows = [HEADINGS]

    for sheet in rated:
        rows.append(row_of(sheet, scores_of(sheet, [anchor] if anchor else sheets, ids), ids))

    reporter.say(f"\n{ruled(rows)}")

    if anchor is None and len(sheets) > 2:
        reporter.say(f"\n{pair_table(sheets, ids)}")

    shown = [anchor, *rated] if anchor is not None else sheets
    scores = per_unit(rated, ids, anchor) if anchor is not None else per_unit(sheets, ids)

    reporter.say(f"\nWhere they disagree most, worst {min(worst, len(ids))} of {len(ids)}:")

    for line in worst_lines(shown, ids, scores, worst):
        reporter.say(line)

    return 0
