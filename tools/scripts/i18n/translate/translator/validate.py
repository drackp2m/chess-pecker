from __future__ import annotations

import re
import sys
from contextlib import redirect_stdout
from dataclasses import dataclass

from .placeholders import PH_RE, salvage_missing_markers, strip_hallucinated_placeholders

FENCE_RE = re.compile(r"^```[A-Za-z]*\n?|\n?```$")
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


@dataclass(frozen=True)
class Issue:
    code: str
    detail: str
    hard: bool = False


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
    cleaned = FENCE_RE.sub("", str(text).strip()).strip()
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


def limit_for(source: str) -> float:
    if len(source) <= SHORT_SOURCE:
        return max(SHORT_SOURCE * 3, len(source) * 4)

    return len(source) * MAX_RATIO


def check_length(text: str, source: str) -> list[Issue]:
    limit = limit_for(source)

    if len(text) > limit:
        return [Issue("too-long", f"{len(text)} caracteres frente a {len(source)} del origen")]

    if len(source) > SHORT_SOURCE and len(text) < len(source) * MIN_RATIO:
        return [Issue("too-short", f"{len(text)} caracteres frente a {len(source)} del origen")]

    return []


def contains_word(haystack: str, needle: str) -> bool:
    pattern = r"(?<!\w)" + re.escape(needle.casefold())

    return re.search(pattern, haystack.casefold()) is not None


def check_terms(text: str, source: str, terms: list[tuple[str, str]]) -> list[Issue]:
    ignored = []

    for term, target in terms:
        if not target or not contains_word(source, term):
            continue

        if not contains_word(text, target):
            ignored.append(f"{term} → {target}")

    if not ignored:
        return []

    return [Issue("glossary", f"sin usar {', '.join(ignored)}")]


def bare(text: str, keep: tuple[str, ...]) -> str:
    stripped = PH_RE.sub(" ", text)

    for term in keep:
        stripped = re.sub(re.escape(term), " ", stripped, flags=re.IGNORECASE)

    return stripped


# The target language writes in a script of its own, so a word left in the
# Latin alphabet is the source showing through — which is what a leaked
# "Resuelto," looks like from here.
def check_script(text: str, lang: str, keep: tuple[str, ...]) -> list[Issue]:
    script = SCRIPTS.get(lang.split("-")[0].lower())

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
