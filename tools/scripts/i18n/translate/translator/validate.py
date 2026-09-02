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
# A model that ignores gender writes the male or female branch for "other"
# with the personal pronoun clipped: «Сдался» off «Ты сдался». The tail after
# these pronouns is what the neuter form is compared against.
LEADING_PRONOUNS = (
    "ты ",
    "вы ",
    "я ",
    "you ",
    "you’ve ",
    "you've ",
    "i ",
    "i’ve ",
    "i've ",
    "je ",
)
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
# out of habit, and stripping it is cheaper and surer than asking again. The
# other direction is the same trade — a sentence that came back without the
# stop it started with gets it put back rather than retried. Only the full stop
# is restored: a lost «?» or «…» is a change of meaning, not of typing.
def fix_trailing(text: str, source: str) -> str:
    stripped = source.rstrip()

    if not text or not stripped:
        return text

    if text[-1] in TRAILING and stripped[-1] not in SENTENCE_END:
        return text[:-1].rstrip()

    if "." == stripped[-1] and text[-1] not in SENTENCE_END:
        return f"{text}."

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


# A label is "plural:one", "gender:other", or "plural:one · gender:other" when
# a key splits on several dimensions at once. Each part is a dimension and its
# CLDR value.
def expanded_parts(label: str) -> list[tuple[str, str]]:
    pairs = []

    for part in label.split(FORM_SEPARATOR):
        name, _, key = part.partition(":")

        if name in COLLAPSED_DIMENSIONS and key:
            pairs.append((name, key))

    return pairs


def dimension_of(label: str) -> str:
    pairs = expanded_parts(label)

    return pairs[0][0] if pairs else ""


def value_of(label: str) -> str:
    pairs = expanded_parts(label)

    return pairs[0][1] if pairs else label


# The pronoun a gendered sentence opens with, dropped from the same sentence:
# «Ты сдался» snips to «сдался». The neuter branch that matches that tail has
# taken the masculine side instead of turning the sentence around.
def pronoun_tail(text: str) -> str | None:
    lowered = text.casefold().strip()

    for pronoun in LEADING_PRONOUNS:
        if lowered.startswith(pronoun):
            return lowered[len(pronoun) :].strip()

    return None


def check_plural_forms(by_key: dict[str, str]) -> list[Issue]:
    distinct = {text for text in by_key.values()}

    if len(distinct) < 2:
        single = next(iter(distinct))

        return [Issue("forms-plural-collapsed", f"todos los números han salido igual: «{single}»", True)]

    one = by_key.get("one")

    if not one:
        return []

    merged = [key for key, text in by_key.items() if key != "one" and text == one]

    if not merged:
        return []

    return [
        Issue(
            "forms-plural-singular",
            f"la forma de singular se repite en {', '.join(merged)}: «{one}»",
            True,
            pairs=tuple((key, one) for key in merged),
        )
    ]


def check_gender_forms(by_key: dict[str, str]) -> list[Issue]:
    distinct = {text for text in by_key.values()}

    if len(distinct) < 2:
        return []

    male = by_key.get("male")
    female = by_key.get("female")
    other = by_key.get("other")

    if male and female and male == female and len(by_key) > 2:
        return [Issue("forms-gender-lumped", f"las formas masculina y femenina han salido igual: «{male}»")]

    if not other:
        return []

    for gendered, name in ((male, "masculina"), (female, "femenina")):
        if not gendered:
            continue

        candidates = [gendered.casefold()]
        tail = pronoun_tail(gendered)

        if tail is not None:
            candidates.append(tail)

        if other.casefold() in candidates:
            return [
                Issue(
                    "forms-gender-other",
                    f"la forma neutra ha tomado la {name}: «{other}»",
                    True,
                    pairs=tuple((key, text) for key, text in by_key.items()),
                )
            ]

    return []


def check_identical(forms: list[Form]) -> list[Issue]:
    grouped: dict[str, list[Form]] = {}
    by_key: dict[str, str] = {}
    dimension = ""

    for form in forms:
        written = form.text.strip()

        if not written:
            continue

        grouped.setdefault(written, []).append(form)
        dimension = dimension or dimension_of(form.label)
        by_key.setdefault(value_of(form.label), written)

    if dimension == "plural":
        issues = check_plural_forms(by_key)
    elif dimension == "gender":
        issues = check_gender_forms(by_key)
    elif len(grouped) == 1:
        (single,) = grouped

        issues = [Issue("forms-identical", f"todas las formas han salido igual: «{single}»")]
    else:
        issues = []

    if not issues:
        return []

    return issues


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
