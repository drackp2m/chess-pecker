from __future__ import annotations

import re
import sys
from contextlib import redirect_stdout
from dataclasses import dataclass

from .context import contains_word
from .placeholders import PH_RE, salvage_missing_markers, strip_hallucinated_placeholders

FENCE_RE = re.compile(r"^```[A-Za-z]*\n?|\n?```$")
STOP_MARKERS = (
    "<end_of_turn>",
    "<start_of_turn>",
    "<|im_end|>",
    "<|im_start|>",
    "<|endoftext|>",
    "<eos>",
    "<bos>",
    "<pad>",
)
THINK_CLOSED_RE = re.compile(r"^.*</think\s*>", re.DOTALL)
THINK_OPEN_RE = re.compile(r"<think\s*>.*$", re.DOTALL)
FENCED_RE = re.compile(r"⟦(.*?)⟧", re.DOTALL)
LEAD_RE = re.compile(
    r"^\s*(?:here (?:is|'s)[^:\n]{0,40}|the translation[^:\n]{0,40}|translation|"
    r"traducci[óo]n[^:\n]{0,40}|traduction[^:\n]{0,40}|sure[^:\n]{0,40}|"
    r"of course[^:\n]{0,40}|claro[^:\n]{0,40})\s*[:：]\s*",
    re.IGNORECASE,
)
QUOTE_PAIRS = (
    ('"', '"'),
    ("'", "'"),
    ("«", "»"),
    ("“", "”"),
    ("‘", "’"),
)
SHORT_SOURCE = 24
FORM_SEPARATOR = " · "
COLLAPSED_DIMENSIONS = ("plural", "gender")
SINGLE_FORM_LANGUAGES = frozenset({"id", "vi", "zh"})
SENTENCE_END = ".!?…。।؟"
TRAILING = ".。।"
LATIN_RUN = re.compile(r"[A-Za-zÀ-ÖØ-öø-ÿ]{3,}")
SCRIPTS = {
    "hi": "\u0900-\u097f",
    "ru": "\u0400-\u04ff",
    "uk": "\u0400-\u04ff",
    "bg": "\u0400-\u04ff",
    "el": "\u0370-\u03ff",
    "he": "\u0590-\u05ff",
    "ar": "\u0600-\u06ff",
    "fa": "\u0600-\u06ff",
    "zh": "\u4e00-\u9fff",
    "ja": "\u3040-\u30ff\u4e00-\u9fff",
    "ko": "\uac00-\ud7af",
}
MAX_RATIO = 2.0
MIN_RATIO = 0.35
STEM_FLOOR = 4
STEM_TRIM = 2


@dataclass(frozen=True)
class Issue:
    code: str
    detail: str
    hard: bool = False
    pairs: tuple[tuple[str, str], ...] = ()


@dataclass(frozen=True)
class Form:
    label: str
    text: str


def base_of(lang: str) -> str:
    return str(lang).split("-")[0].lower()


# A model that keeps talking after its own end-of-turn token repeats it dozens
# of times; the answer is whatever came before the first one.
def cut_at_stop(text: str) -> tuple[str, bool]:
    found = [index for index in (text.find(marker) for marker in STOP_MARKERS) if index != -1]

    if not found:
        return text, False

    return text[: min(found)], True


def strip_control(text: str) -> str:
    without_thoughts = THINK_OPEN_RE.sub("", THINK_CLOSED_RE.sub("", text))

    return cut_at_stop(without_thoughts)[0].strip()


def unquote(text: str) -> str:
    for opening, closing in QUOTE_PAIRS:
        if len(text) > 1 and text.startswith(opening) and text.endswith(closing):
            inner = text[len(opening) : -len(closing)].strip()

            if opening not in inner and closing not in inner:
                return inner

    return text


# A label never grew a full stop the original did not have: the model adds one
# out of habit, and stripping it is cheaper and surer than asking again.
def fix_trailing(text: str, source: str) -> str:
    stripped = source.rstrip()

    if not text or not stripped:
        return text

    if text[-1] in TRAILING and stripped[-1] not in SENTENCE_END:
        return text[:-1].rstrip()

    return text


# What comes back may carry the injected notes with it: the fence is the first
# thing to look for, and after that the answer is the last line, not the first.
def extract(text: str, prefer: str) -> str:
    inside = FENCED_RE.search(text)

    if inside is not None:
        return inside.group(1).strip()

    lines = [line for line in text.splitlines() if line.strip()]

    if not lines:
        return ""

    return (lines[-1] if prefer == "last" else lines[0]).strip()


def clean(text: str, source: str, prefer: str = "first") -> str:
    cleaned = FENCE_RE.sub("", strip_control(str(text))).strip()
    cleaned = LEAD_RE.sub("", cleaned).strip()
    cleaned = unquote(cleaned)

    if "\n" not in source and "\n" in cleaned:
        cleaned = extract(cleaned, prefer)
    else:
        cleaned = FENCED_RE.sub(r"\1", cleaned).strip()

    return fix_trailing(unquote(cleaned.strip()), source)


def check_markers(text: str, expected: list[str]) -> list[Issue]:
    found = PH_RE.findall(text)
    missing = [marker for marker in expected if marker not in found]
    invented = sorted({marker for marker in found if marker not in expected})
    repeated = sorted({marker for marker in expected if found.count(marker) > 1})
    issues = []

    if missing:
        issues.append(Issue("placeholder-missing", f"faltan {', '.join(missing)}", True))

    if invented:
        issues.append(Issue("placeholder-invented", f"sobran {', '.join(invented)}", True))

    if repeated:
        issues.append(Issue("placeholder-repeated", f"repetidos {', '.join(repeated)}", True))

    return issues


def measured(text: str) -> int:
    return len(PH_RE.sub("", text).strip())


def limit_for(length: int) -> float:
    if length <= SHORT_SOURCE:
        return max(SHORT_SOURCE * 3, length * 4)

    return length * MAX_RATIO


def check_length(text: str, source: str) -> list[Issue]:
    written, origin = measured(text), measured(source)
    limit = limit_for(origin)

    if written > limit:
        return [Issue("too-long", f"{written} caracteres frente a {origin} del origen")]

    if origin > SHORT_SOURCE and written < origin * MIN_RATIO:
        return [Issue("too-short", f"{written} caracteres frente a {origin} del origen")]

    return []


# A glossary term arrives in its dictionary form and the sentence declines it:
# "попытка" is written "попытку", "manche" turns up as "manches". Matching the
# stem is what keeps an inflected language from failing every single check.
def stem(term: str) -> str:
    head, _, last = term.rpartition(" ")
    trimmed = last[: max(STEM_FLOOR, len(last) - STEM_TRIM)]

    return f"{head} {trimmed}" if head else trimmed


def check_terms(text: str, source: str, terms: list[tuple[str, str]]) -> list[Issue]:
    ignored = []

    for term, target in terms:
        if not target or not contains_word(source, term):
            continue

        if not contains_word(text, stem(target)):
            ignored.append((term, target))

    if not ignored:
        return []

    listed = ", ".join(f"{term} → {target}" for term, target in ignored)

    return [Issue("glossary", f"sin usar {listed}", pairs=tuple(ignored))]


def bare(text: str, keep: tuple[str, ...]) -> str:
    stripped = PH_RE.sub(" ", text)

    for term in keep:
        stripped = re.sub(re.escape(term), " ", stripped, flags=re.IGNORECASE)

    return stripped


# The target language writes in a script of its own, so a word left in the
# Latin alphabet is the source showing through — which is what a leaked
# "Resuelto," looks like from here.
def check_script(text: str, lang: str, keep: tuple[str, ...]) -> list[Issue]:
    script = SCRIPTS.get(base_of(lang))

    if script is None:
        return []

    leaks = sorted(set(LATIN_RUN.findall(bare(text, keep))))

    if not leaks:
        return []

    return [Issue("source-leak", f"sin traducir: {', '.join(leaks[:5])}")]


def check_copy(text: str, source: str, keep: tuple[str, ...]) -> list[Issue]:
    if text.strip() != source.strip():
        return []

    if not LATIN_RUN.search(bare(source, keep)):
        return []

    return [Issue("untranslated", "idéntico al origen")]


def named(forms: list[Form]) -> str:
    labels = [form.label or "?" for form in forms]

    if 2 > len(labels):
        return "".join(labels)

    return f"{', '.join(labels[:-1])} y {labels[-1]}"


def check_identical(forms: list[Form]) -> list[Issue]:
    grouped: dict[str, list[Form]] = {}

    for form in forms:
        written = form.text.strip()

        if written:
            grouped.setdefault(written, []).append(form)

    alike = [(text, group) for text, group in grouped.items() if len(group) > 1]

    if not alike:
        return []

    listed = "; ".join(f"{named(group)} → «{text}»" for text, group in alike)

    return [Issue("forms-identical", f"formas iguales: {listed}")]


def expanded(form: Form) -> list[str]:
    parts = form.label.split(FORM_SEPARATOR)

    return [part for part in parts if part.split(":", 1)[0] in COLLAPSED_DIMENSIONS]


def check_surplus(forms: list[Form], lang: str) -> list[Issue]:
    if base_of(lang) not in SINGLE_FORM_LANGUAGES:
        return []

    grown = [form for form in forms if expanded(form)]

    if len(grown) < 2:
        return []

    return [
        Issue(
            "forms-surplus",
            f"{lang} tiene una sola forma y han venido {len(grown)}: {named(grown)}",
            True,
        )
    ]


def validate_forms(forms: list[Form], lang: str = "") -> list[Issue]:
    if len(forms) < 2:
        return []

    return [*check_surplus(forms, lang), *check_identical(forms)]


def validate(
    text: str,
    source: str,
    markers: list[str],
    terms: list[tuple[str, str]],
    lang: str = "",
    keep: tuple[str, ...] = (),
) -> list[Issue]:
    if not text.strip():
        return [Issue("empty", "el modelo no ha devuelto nada", True)]

    return [
        *check_markers(text, markers),
        *check_copy(text, source, keep),
        *check_script(text, lang, keep),
        *check_length(text, source),
        *check_terms(text, source, terms),
    ]


def reason_of(issues: list[Issue]) -> str:
    return "; ".join(f"{issue.code} ({issue.detail})" for issue in issues)


def demanded(issues: list[Issue]) -> tuple[tuple[str, str], ...]:
    return tuple(pair for issue in issues for pair in issue.pairs)


def drop_repeats(text: str) -> str:
    seen: set[str] = set()
    parts = []

    for token in re.split(r"(__PH_[A-Za-z0-9_.-]+__)", text):
        if not token:
            continue

        if PH_RE.fullmatch(token):
            if token in seen:
                continue

            seen.add(token)

        parts.append(token)

    return re.sub(r"[ \t]{2,}", " ", "".join(parts)).strip()


# The rescue of the prototype warns by printing; sent to stderr it stays out of
# the NDJSON that --json writes on stdout.
def repair(text: str, source: str, markers: list[str]) -> str:
    with redirect_stdout(sys.stderr):
        repaired = strip_hallucinated_placeholders(text, markers)
        repaired = drop_repeats(repaired)

        return salvage_missing_markers(source, repaired, markers).strip()
