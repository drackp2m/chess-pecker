from __future__ import annotations

import re
from dataclasses import dataclass

from .placeholders import PH_RE

KEEP_PREFIX = "No traducir nunca:"
BULLET_RE = re.compile(r"^\s*[-*]\s+")
ARROW_RE = re.compile(r"^(.+?)\s*→\s*(.+)$")
GLOSS_SEPARATOR = " — "
BLANK_RUN_RE = re.compile(r"\n{3,}")


def has_marker(texts: list[str]) -> bool:
    return any(PH_RE.search(text) for text in texts)


def has_separator(texts: list[str]) -> bool:
    return any("·" in text for text in texts)


def has_ellipsis(texts: list[str]) -> bool:
    return any("…" in text or "..." in text for text in texts)


PROBES = (
    (("{{", "param", "marcador", "placeholder"), has_marker),
    (("·", "punto medio"), has_separator),
    (("…", "puntos suspensivos"), has_ellipsis),
)


@dataclass(frozen=True)
class Term:
    source: str
    target: str
    gloss: str = ""

    @property
    def line(self) -> str:
        pair = f"{self.source} → {self.target}"

        return f"{pair}{GLOSS_SEPARATOR}{self.gloss}" if self.gloss else pair


def contains_word(haystack: str, needle: str) -> bool:
    if not needle:
        return False

    return re.search(r"(?<!\w)" + re.escape(needle.casefold()), haystack.casefold()) is not None


def leads_bullets(lines: list[str], index: int) -> bool:
    for line in lines[index:]:
        if not line.strip():
            continue

        return bool(BULLET_RE.match(line))

    return False


def split_rules(text: str) -> tuple[str, list[str]]:
    lines = text.splitlines()
    prose: list[str] = []
    rules: list[str] = []

    for index, line in enumerate(lines):
        if BULLET_RE.match(line):
            rules.append(BULLET_RE.sub("", line).strip())
        elif not (line.strip().endswith(":") and leads_bullets(lines, index + 1)):
            prose.append(line)

    return BLANK_RUN_RE.sub("\n\n", "\n".join(prose)).strip(), rules


def rule_applies(rule: str, texts: list[str]) -> bool:
    lowered = rule.lower()
    matched = [detect for tokens, detect in PROBES if any(token in lowered for token in tokens)]

    if not matched:
        return True

    return any(detect(texts) for detect in matched)


def useful_rules(rules: list[str], texts: list[str]) -> list[str]:
    return [rule for rule in rules if rule_applies(rule, texts)]


def parse_glossary(text: str) -> tuple[list[Term], tuple[str, ...]]:
    terms: list[Term] = []
    keep: tuple[str, ...] = ()

    for line in text.splitlines():
        stripped = line.strip()

        if stripped.startswith(KEEP_PREFIX):
            names = stripped[len(KEEP_PREFIX) :].split(",")
            keep = tuple(name.strip() for name in names if name.strip())
            continue

        match = ARROW_RE.match(stripped)

        if match is None:
            continue

        target, _, gloss = match.group(2).partition(GLOSS_SEPARATOR)
        terms.append(Term(match.group(1).strip(), target.strip(), gloss.strip()))

    return terms, keep


def useful_terms(terms: list[Term], texts: list[str], named: set[str]) -> list[Term]:
    wanted = []

    for term in terms:
        if term.source.casefold() in named or any(contains_word(t, term.source) for t in texts):
            wanted.append(term)

    return wanted


def useful_keep(keep: tuple[str, ...], texts: list[str]) -> list[str]:
    joined = "\n".join(texts).casefold()

    return [name for name in keep if name.casefold() in joined]
