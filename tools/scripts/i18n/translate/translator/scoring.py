from __future__ import annotations

import json
import re
from collections import Counter
from dataclasses import dataclass, field
from math import comb
from pathlib import Path

from .compare import chrf
from .context import contains_word
from .placeholders import PH_RE
from .prompting import REVIEW_SUB_STATE, blocks_of
from .samples import traces_of
from .validate import base_of, validate
from .xliff_io import NS, find_files, get_languages, ph_map, read_xliff, sub_state_of

CRITICAL = "critical"
MAJOR = "major"
MINOR = "minor"
EXPECTED = "expected"
STYLE = "style"
SEPARATOR = " · "
ELLIPSIS = "…"
CLOSERS = ".…?!:।"
PLACEHOLDER_RE = re.compile(r"\{[^{}]*\}|#")
OPENERS = " \t«»\"'“”„("
SENTINEL = ""
DEFAULT_QUOTES = (("«", "»"),)
DEFAULT_STOPS = (".",)
UNCASED = frozenset({"hi", "zh", "ja", "ko", "ar", "he", "fa"})
FOLDS = str.maketrans({"ё": "е", "Ё": "Е", " ": " ", " ": " ", "’": "'", "‘": "'"})
QUOTE_FOLDS = str.maketrans({"«": '"', "»": '"', "“": '"', "”": '"', "„": '"'})
ISSUES = {
    "empty": ("empty", CRITICAL),
    "placeholder-missing": ("markers", CRITICAL),
    "placeholder-invented": ("markers", CRITICAL),
    "placeholder-repeated": ("markers", CRITICAL),
    "placeholder-written": ("markers", CRITICAL),
    "special-token": ("tokens", CRITICAL),
    "inverted-marks": ("inverted", MAJOR),
    "untranslated": ("untranslated", MAJOR),
    "source-leak": ("script", MAJOR),
    "glossary": ("glossary", MAJOR),
    "too-long": ("length", MINOR),
    "too-short": ("length", MINOR),
}


@dataclass(frozen=True)
class Answer:
    id: str
    name: str
    scope: str
    category: str
    source: str
    target: str
    markers: tuple[str, ...]
    shown_source: str
    shown_target: str
    terms: tuple[tuple[str, str], ...]
    keep: tuple[str, ...]
    review: bool

    @property
    def group(self) -> str:
        return self.id.split("#", 1)[0]


@dataclass(frozen=True)
class Expectation:
    axis: str = ""
    refs: tuple[str, ...] = ()
    has: tuple[str, ...] = ()
    lacks: tuple[str, ...] = ()
    patterns: tuple[str, ...] = ()
    prefers: tuple[str, ...] = ()
    allow: frozenset[str] = frozenset()
    severity: str = CRITICAL

    @property
    def count(self) -> int:
        return len(self.has) + len(self.lacks) + len(self.patterns)


@dataclass(frozen=True)
class Expectations:
    quotes: tuple[tuple[str, str], ...] = DEFAULT_QUOTES
    stops: tuple[str, ...] = DEFAULT_STOPS
    units: dict[str, Expectation] = field(default_factory=dict)

    def of(self, answer: Answer) -> Expectation:
        return self.units.get(answer.name, Expectation())


@dataclass(frozen=True)
class Check:
    code: str
    severity: str
    detail: str = ""


@dataclass(frozen=True)
class Verdict:
    answer: Answer
    checks: tuple[Check, ...]
    expectation: Expectation
    score: float | None

    def count(self, severity: str) -> int:
        return len([check for check in self.checks if check.severity == severity])

    @property
    def missed(self) -> int:
        return len([check for check in self.checks if check.code == EXPECTED])

    @property
    def clean(self) -> bool:
        return not self.checks

    @property
    def rank(self) -> tuple[int, int, int, int]:
        return (self.count(CRITICAL), self.missed, self.count(MAJOR), self.count(MINOR))

    @property
    def broken(self) -> tuple[int, int]:
        return (self.count(CRITICAL), self.missed)


@dataclass(frozen=True)
class Summary:
    units: int
    critical: int
    major: int
    minor: int
    clean: int
    expected: int
    met: int
    groups: int
    groups_ok: int
    review: int
    score: float | None
    codes: dict[str, int]


def strings(value) -> tuple[str, ...]:
    if value is None:
        return ()

    if isinstance(value, str):
        return (value,)

    return tuple(str(item) for item in value)


def expectation_of(entry: dict) -> Expectation:
    return Expectation(
        axis=str(entry.get("axis", "")),
        refs=strings(entry.get("ref")),
        has=strings(entry.get("has")),
        lacks=strings(entry.get("not")),
        patterns=strings(entry.get("re")),
        prefers=strings(entry.get("prefer")),
        allow=frozenset(strings(entry.get("allow"))),
        severity=str(entry.get("severity", CRITICAL)),
    )


def load_expectations(path: Path | None) -> Expectations:
    if path is None or not path.exists():
        return Expectations()

    data = json.loads(path.read_text(encoding="utf-8"))
    lang = data.get("lang") or {}
    quotes = tuple((str(pair[0]), str(pair[1])) for pair in lang.get("quotes") or DEFAULT_QUOTES)
    stops = strings(lang.get("stops")) or DEFAULT_STOPS
    units = {name: expectation_of(entry) for name, entry in (data.get("units") or {}).items()}

    return Expectations(quotes, stops, units)


def data_of(element) -> dict[str, str]:
    found = element.xpath("./x:originalData/x:data", namespaces=NS)

    return {data.get("id") or "": "".join(data.itertext()) for data in found}


def shown(text: str, unit) -> str:
    data = data_of(unit.element)

    for marker, ph in ph_map(unit.source_element).items():
        text = text.replace(marker, data.get(ph.get("dataRef") or "", marker))

    return text


def name_of(unit) -> str:
    _, mark, suffix = unit.id.partition("#")

    return f"{unit.key}{mark}{suffix}"


def answer_of(block, unit) -> Answer:
    return Answer(
        id=unit.id,
        name=name_of(unit),
        scope=block.scope,
        category=unit.category,
        source=unit.source,
        target=unit.previous,
        markers=tuple(unit.markers),
        shown_source=shown(unit.source, unit),
        shown_target=shown(unit.previous, unit),
        terms=tuple(unit.terms),
        keep=block.keep,
        review=sub_state_of(unit.segment) == REVIEW_SUB_STATE,
    )


def answers_of(path: Path, scopes: list[str]) -> tuple[str, dict[str, Answer]]:
    root = read_xliff(path).getroot()
    langs = get_languages(root)
    answers: dict[str, Answer] = {}

    for element in find_files(root):
        block, units = blocks_of(element, *langs)

        if scopes and block.scope not in scopes:
            continue

        for unit in units:
            answers[unit.id] = answer_of(block, unit)

    return langs[1], answers


def folded(text: str) -> str:
    return " ".join(text.translate(FOLDS).casefold().split())


def comparable(text: str) -> str:
    return PLACEHOLDER_RE.sub(SENTINEL, text.translate(FOLDS).translate(QUOTE_FOLDS))


def best_score(target: str, refs: tuple[str, ...]) -> float | None:
    if not refs:
        return None

    return max(chrf(comparable(target), comparable(ref)) for ref in refs)


def issue_checks(answer: Answer, lang: str) -> list[Check]:
    markers, terms = list(answer.markers), list(answer.terms)
    issues = validate(answer.target, answer.source, markers, terms, lang, answer.keep)
    checks = []

    for issue in issues:
        code, severity = ISSUES.get(issue.code, (issue.code, MINOR))
        checks.append(Check(code, severity, issue.detail))

    return checks


def first_letter(text: str) -> str:
    return next((char for char in PH_RE.sub(" ", text) if char.isalpha()), "")


def opens_with_marker(text: str) -> bool:
    return PH_RE.match(text.lstrip(OPENERS)) is not None


def check_case(answer: Answer, lang: str) -> list[Check]:
    if opens_with_marker(answer.source) or opens_with_marker(answer.target):
        return []

    wanted, got = first_letter(answer.source), first_letter(answer.target)

    if base_of(lang) in UNCASED or not wanted or not got or wanted.isupper() == got.isupper():
        return []

    shape = "mayúscula" if wanted.isupper() else "minúscula"

    return [Check("case", MINOR, f"el original empieza en {shape}")]


def ending(text: str) -> str:
    stripped = text.rstrip()

    return stripped[-1] if stripped and stripped[-1] in CLOSERS else ""


def ends_well(wanted: str, got: str, stops: tuple[str, ...]) -> bool:
    if wanted == ".":
        return got in stops

    if wanted == "!":
        return got == "!" or got in stops

    if wanted:
        return got == wanted

    return got not in (*stops, ELLIPSIS)


def check_ending(answer: Answer, stops: tuple[str, ...]) -> list[Check]:
    wanted, got = ending(answer.source), ending(answer.target)

    if ends_well(wanted, got, stops):
        return []

    return [Check("ending", MINOR, f"el original cierra con «{wanted or 'nada'}»")]


def check_ellipsis(answer: Answer) -> list[Check]:
    if "..." in answer.target:
        return [Check("ellipsis", MINOR, "tres puntos en vez de «…»")]

    if ELLIPSIS in answer.source and ELLIPSIS not in answer.target:
        return [Check("ellipsis", MINOR, "se ha perdido el «…»")]

    return []


def check_separator(answer: Answer) -> list[Check]:
    wanted, got = answer.source.count(SEPARATOR), answer.target.count(SEPARATOR)

    if wanted == got:
        return []

    return [Check("separator", MAJOR, f"« · » {got} veces, el original {wanted}")]


def check_traces(answer: Answer, lang: str) -> list[Check]:
    text = folded(answer.shown_target)
    copied = [trace for trace in traces_of(lang) if folded(trace) in text]

    if not copied:
        return []

    return [Check("sample", CRITICAL, f"copia el ejemplo de la nota: {', '.join(copied)}")]


def check_keep(answer: Answer) -> list[Check]:
    lost = [
        name
        for name in answer.keep
        if contains_word(answer.source, name) and name not in answer.target
    ]

    return [Check("keep", MAJOR, f"no se conserva {', '.join(lost)}")] if lost else []


def check_quotes(answer: Answer, quotes: tuple[tuple[str, str], ...]) -> list[Check]:
    if "«" not in answer.source:
        return []

    if any(opening in answer.target and closing in answer.target for opening, closing in quotes):
        return []

    return [Check("quotes", MINOR, "no usa las comillas del idioma")]


def auto_checks(answer: Answer, lang: str, expectations: Expectations) -> list[Check]:
    if not answer.target.strip():
        return [Check("empty", CRITICAL, "sin respuesta")]

    return [
        *issue_checks(answer, lang),
        *check_traces(answer, lang),
        *check_case(answer, lang),
        *check_ending(answer, expectations.stops),
        *check_ellipsis(answer),
        *check_separator(answer),
        *check_keep(answer),
        *check_quotes(answer, expectations.quotes),
    ]


def check_expected(answer: Answer, expected: Expectation) -> list[Check]:
    text = folded(answer.shown_target)
    checks = []

    for wanted in expected.has:
        if folded(wanted) not in text:
            checks.append(Check(EXPECTED, expected.severity, f"falta «{wanted}»"))

    for unwanted in expected.lacks:
        if folded(unwanted) in text:
            checks.append(Check(EXPECTED, expected.severity, f"sobra «{unwanted}»"))

    for pattern in expected.patterns:
        if re.search(pattern, text) is None:
            checks.append(Check(EXPECTED, expected.severity, f"no cumple /{pattern}/"))

    for wanted in expected.prefers:
        if folded(wanted) not in text:
            checks.append(Check(STYLE, MINOR, f"mejor «{wanted}»"))

    return checks


def refs_of(answer: Answer, expected: Expectation, reference: dict[str, Answer]) -> tuple[str, ...]:
    gold = reference.get(answer.id)

    return expected.refs + ((gold.shown_target,) if gold and gold.target else ())


def verdict_of(answer, lang, expectations, reference) -> Verdict:
    expected = expectations.of(answer)
    found = auto_checks(answer, lang, expectations)
    checks = [check for check in found if check.code not in expected.allow]
    checks += check_expected(answer, expected)
    score = best_score(answer.shown_target, refs_of(answer, expected, reference))

    return Verdict(answer, tuple(checks), expected, score)


def verdicts_of(
    path: Path,
    expectations: Expectations,
    reference: dict[str, Answer],
    scopes: list[str],
) -> dict[str, Verdict]:
    lang, answers = answers_of(path, scopes)

    return {
        unit: verdict_of(answer, lang, expectations, reference)
        for unit, answer in answers.items()
    }


def mean(values: list[float]) -> float | None:
    return sum(values) / len(values) if values else None


def summarise(verdicts: dict[str, Verdict]) -> Summary:
    rows = list(verdicts.values())
    grouped: dict[str, list[Verdict]] = {}

    for verdict in rows:
        if "#" in verdict.answer.id:
            grouped.setdefault(verdict.answer.group, []).append(verdict)

    broken = [
        group
        for group in grouped.values()
        if any(check.code == EXPECTED for v in group for check in v.checks)
    ]

    return Summary(
        units=len(rows),
        critical=len([v for v in rows if v.count(CRITICAL)]),
        major=len([v for v in rows if v.count(MAJOR)]),
        minor=len([v for v in rows if v.count(MINOR)]),
        clean=len([v for v in rows if v.clean]),
        expected=sum(v.expectation.count for v in rows),
        met=sum(v.expectation.count - v.missed for v in rows),
        groups=len(grouped),
        groups_ok=len(grouped) - len(broken),
        review=len([v for v in rows if v.answer.review]),
        score=mean([v.score for v in rows if v.score is not None]),
        codes=dict(Counter(check.code for v in rows for check in v.checks)),
    )


def by_axis(verdicts: dict[str, Verdict]) -> dict[str, tuple[int, int]]:
    tally: dict[str, list[int]] = {}

    for verdict in verdicts.values():
        expected = verdict.expectation

        if not expected.count:
            continue

        counts = tally.setdefault(expected.axis or "—", [0, 0])
        counts[0] += expected.count - verdict.missed
        counts[1] += expected.count

    return {axis: (met, total) for axis, (met, total) in sorted(tally.items())}


def duel(
    left: dict[str, Verdict], right: dict[str, Verdict], aspect: str = "rank"
) -> tuple[int, int, int]:
    wins = losses = ties = 0

    for unit in left.keys() & right.keys():
        mine, theirs = getattr(left[unit], aspect), getattr(right[unit], aspect)

        if mine < theirs:
            wins += 1
        elif theirs < mine:
            losses += 1
        else:
            ties += 1

    return wins, losses, ties


def sign_test(wins: int, losses: int) -> float:
    total = wins + losses

    if not total:
        return 1.0

    tail = sum(comb(total, index) for index in range(min(wins, losses) + 1))

    return min(1.0, 2 * tail / 2**total)


def failing(verdict: Verdict) -> bool:
    return any(check.severity == CRITICAL or check.code == EXPECTED for check in verdict.checks)


def details(verdict: Verdict) -> str:
    return "; ".join(f"{check.code}: {check.detail}" for check in verdict.checks) or "ok"
