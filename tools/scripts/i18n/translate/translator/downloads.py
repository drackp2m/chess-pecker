from __future__ import annotations

import re
import sys
import time
from dataclasses import dataclass

from .models import find, size_text
from .picker import choose, interactive
from .tables import aligned, ruled

HOUR = 3600.0
DAY = 86400.0
UNKNOWN = "—"
RANGE_RE = re.compile(r"^(\d+)\s*-\s*(\d+)$")
HEADINGS = ("#", "alias", "repository", "on disk", "last used")
HINT = "\nDelete which? ↑/↓ to move, space to mark, 'a' for all, enter to confirm, esc to cancel."


@dataclass(frozen=True)
class Entry:
    repo: str
    alias: str
    size: int
    used: float
    revisions: tuple[str, ...]

    @property
    def size_text(self) -> str:
        return size_text(self.size)

    @property
    def used_text(self) -> str:
        elapsed = max(0.0, time.time() - self.used)

        if elapsed < HOUR:
            return "just now"

        if elapsed < DAY:
            return f"{int(elapsed // HOUR)}h ago"

        return f"{int(elapsed // DAY)}d ago"


def entry_of(repo) -> Entry:
    known = find(repo.repo_id)

    return Entry(
        repo=repo.repo_id,
        alias=known.alias if known is not None else UNKNOWN,
        size=repo.size_on_disk,
        used=repo.last_accessed,
        revisions=tuple(revision.commit_hash for revision in repo.revisions),
    )


def load():
    from huggingface_hub import scan_cache_dir
    from huggingface_hub.errors import CacheNotFound

    try:
        info = scan_cache_dir()
    except CacheNotFound:
        return None, []

    models = [repo for repo in info.repos if repo.repo_type == "model"]
    entries = sorted((entry_of(repo) for repo in models), key=lambda e: -e.size)

    return info, entries


def sizes_by_repo() -> dict[str, int]:
    try:
        _, entries = load()
    except ImportError:
        return {}

    return {entry.repo.lower(): entry.size for entry in entries}


def cells(entry: Entry) -> tuple[str, ...]:
    return (entry.alias, entry.repo, entry.size_text, entry.used_text)


def table(entries: list[Entry]) -> str:
    return ruled([HEADINGS, *((str(index), *cells(entry)) for index, entry in enumerate(entries, 1))])


def header_of(entries: list[Entry]) -> str:
    rows = [HEADINGS[1:], *(cells(entry) for entry in entries)]

    return f"      {aligned(rows)[0]}"


def options_of(entries: list[Entry]) -> list[str]:
    rows = [HEADINGS[1:], *(cells(entry) for entry in entries)]

    return aligned(rows)[1:]


def numbers(answer: str, count: int) -> list[int] | None:
    if answer.strip().lower() in ("all", "todos", "*"):
        return list(range(count))

    wanted: set[int] = set()

    for piece in re.split(r"[\s,]+", answer.strip()):
        if not piece:
            continue

        found = RANGE_RE.match(piece)
        span = (int(found.group(1)), int(found.group(2))) if found else None

        if span is None and not piece.isdigit():
            return None

        first, last = span or (int(piece), int(piece))

        if not 1 <= first <= last <= count:
            return None

        wanted.update(range(first - 1, last))

    return sorted(wanted)


def listing(reporter) -> tuple[object, list[Entry]]:
    info, entries = load()

    if not entries:
        reporter.say("No models downloaded yet. The first run of one pulls it in.")

        return info, []

    reporter.say(table(entries))
    reporter.say(f"\n{len(entries)} model(s), {size_text(sum(entry.size for entry in entries))}")

    return info, entries


def show_cache(reporter) -> int:
    listing(reporter)

    return 0


def typed(reporter, entries: list[Entry]) -> list[Entry] | None:
    reporter.say(table(entries))
    reporter.say(f"\n{len(entries)} model(s), {size_text(sum(entry.size for entry in entries))}")

    try:
        answer = input("\nDelete which? (numbers, 2-5 for a range, 'all', empty to cancel) ")
    except (EOFError, KeyboardInterrupt):
        print()

        return []

    chosen = numbers(answer, len(entries))

    if chosen is None:
        reporter.warn("That is not a valid selection. Nothing was deleted.")

        return None

    return [entries[index] for index in chosen]


def picked(reporter, entries: list[Entry]) -> list[Entry] | None:
    if not interactive():
        return typed(reporter, entries)

    reporter.say(f"\n{len(entries)} model(s), {size_text(sum(entry.size for entry in entries))}")
    chosen = choose(options_of(entries), f"{HINT}\n{header_of(entries)}")

    return [entries[index] for index in chosen or []]


# Weights are re-downloadable, but a wrong pick still costs an hour of pulling
# them back: the repositories and the freed size go on screen before anything
# is touched, and the confirmation is a word, not a keystroke.
def prune_cache(reporter) -> int:
    info, entries = load()

    if not entries:
        reporter.say("No models downloaded yet. The first run of one pulls it in.")

        return 0

    if not sys.stdin.isatty():
        reporter.warn("\nERROR: --cache-remove needs a terminal to ask which ones to delete.")

        return 1

    doomed = picked(reporter, entries)

    if doomed is None:
        return 1

    if not doomed:
        reporter.say("Nothing selected, nothing deleted.")

        return 0

    strategy = info.delete_revisions(*[h for entry in doomed for h in entry.revisions])

    reporter.say("\nAbout to delete:")

    for entry in doomed:
        reporter.say(f"  {entry.repo}  ({entry.size_text}, {entry.alias})")

    reporter.say(f"\nThat frees {strategy.expected_freed_size_str}, and they can be pulled again.")

    try:
        answer = input("Type 'yes' to go ahead: ")
    except (EOFError, KeyboardInterrupt):
        answer = ""
        print()

    if answer.strip().lower() != "yes":
        reporter.say("Nothing deleted.")

        return 0

    strategy.execute()
    reporter.say(f"Done. {strategy.expected_freed_size_str} freed.")

    return 0
