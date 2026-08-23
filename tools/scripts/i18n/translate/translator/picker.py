from __future__ import annotations

import os
import re
import sys
UP = "\x1b[A"
DOWN = "\x1b[B"
CTRL_D = "\x04"
ENTER = ("\r", "\n")
CANCEL = ("\x03", "\x04", "\x1b", "q")
CURSOR_HIDE = "\x1b[?25l"
CURSOR_SHOW = "\x1b[?25h"
CLEAR_LINE = "\x1b[2K"
CHUNK = 32
SEQUENCE_RE = re.compile(r"\x1b\[[0-9;]*[A-Za-z~]")
MARKED = "◉"
UNMARKED = "◯"
POINTER = "❯"


def interactive() -> bool:
    try:
        import termios  # noqa: F401
    except ImportError:
        return False

    return sys.stdin.isatty() and sys.stdout.isatty()


def keys_of(chunk: str) -> list[str]:
    keys: list[str] = []
    rest = chunk

    while rest:
        found = SEQUENCE_RE.match(rest)
        keys.append(found.group(0) if found else rest[0])
        rest = rest[len(keys[-1]):]

    return keys


def read_keys(fd: int) -> list[str]:
    return keys_of(os.read(fd, CHUNK).decode("utf-8", "ignore"))


def lines_of(options: list[str], marked: set[int], cursor: int) -> list[str]:
    rows = []

    for index, option in enumerate(options):
        pointer = POINTER if index == cursor else " "
        box = MARKED if index in marked else UNMARKED
        rows.append(f" {pointer} {box}  {option}")

    return rows


def draw(rows: list[str], first: bool) -> None:
    if not first:
        sys.stdout.write(f"\x1b[{len(rows)}A")

    for row in rows:
        sys.stdout.write(f"{CLEAR_LINE}{row}\n")

    sys.stdout.flush()


def moved(key: str, cursor: int, count: int) -> int:
    if key in (UP, "k"):
        return (cursor - 1) % count

    if key in (DOWN, "j"):
        return (cursor + 1) % count

    return cursor


def toggled(key: str, marked: set[int], cursor: int, count: int) -> set[int]:
    if key == "a":
        return set() if len(marked) == count else set(range(count))

    if key != " ":
        return marked

    return marked - {cursor} if cursor in marked else marked | {cursor}


def loop(options: list[str], fd: int) -> list[int] | None:
    marked: set[int] = set()
    cursor = 0
    first = True

    while True:
        draw(lines_of(options, marked, cursor), first)
        first = False

        for key in read_keys(fd) or [CTRL_D]:
            if key in CANCEL:
                return None

            if key in ENTER:
                return sorted(marked)

            cursor = moved(key, cursor, len(options))
            marked = toggled(key, marked, cursor, len(options))


def choose(options: list[str], hint: str = "") -> list[int] | None:
    import termios
    import tty

    stream = sys.stdin
    saved = termios.tcgetattr(stream)

    if hint:
        print(hint, flush=True)

    sys.stdout.write(CURSOR_HIDE)

    try:
        tty.setcbreak(stream.fileno())

        return loop(options, stream.fileno())
    except KeyboardInterrupt:
        return None
    finally:
        termios.tcsetattr(stream, termios.TCSADRAIN, saved)
        sys.stdout.write(CURSOR_SHOW)
        sys.stdout.flush()
