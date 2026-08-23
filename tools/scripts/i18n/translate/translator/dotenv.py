from __future__ import annotations

import os
from pathlib import Path

MARKER = "pnpm-workspace.yaml"
EXPORT = "export "
QUOTES = ("'", '"')


def workspace_root() -> Path | None:
    here = Path(__file__).resolve()

    for folder in (here, *here.parents):
        if (folder / MARKER).exists():
            return folder

    return None


def unquoted(value: str) -> str:
    text = value.strip()

    if len(text) > 1 and text[0] == text[-1] and text[0] in QUOTES:
        return text[1:-1]

    return text


def parse(text: str) -> dict[str, str]:
    values: dict[str, str] = {}

    for line in text.splitlines():
        stripped = line.strip().removeprefix(EXPORT)

        if not stripped or stripped.startswith("#") or "=" not in stripped:
            continue

        name, _, value = stripped.partition("=")
        values[name.strip()] = unquoted(value)

    return values


# The one .env at the repo root, read the way the API reads it: whatever is
# already exported in the shell wins, so a key given for a single command is
# not quietly overridden by the file. An empty value is left unset rather than
# set to "", which is what a copied .env.example is full of and what would
# otherwise send huggingface_hub an empty token instead of no token.
def load_env() -> Path | None:
    root = workspace_root()
    path = root / ".env" if root else None

    if path is None or not path.exists():
        return None

    for name, value in parse(path.read_text(encoding="utf-8")).items():
        if value:
            os.environ.setdefault(name, value)

    return path
