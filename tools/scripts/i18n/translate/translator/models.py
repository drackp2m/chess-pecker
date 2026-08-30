from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass

from .tables import ruled

INSTRUCT = "instruct"
TRANSLATE = "translate"
PROFILES = (INSTRUCT, TRANSLATE)
GIGABYTE = 1e9
MEGABYTE = 1e6
MISSING = "—"


@dataclass(frozen=True)
class Model:
    alias: str
    repo: str
    family: str
    size: str
    disk: str
    profile: str = INSTRUCT
    thinking: bool = False
    added: str = ""
    note: str = ""


CATALOGUE = (
    Model(
        "gemma-12b-qat",
        "mlx-community/gemma-3-12b-it-qat-4bit",
        "Gemma 3",
        "12B",
        "8.0 GB",
        added="2025-04-15",
        note="The safety net: same Russian as the default, three times slower, nothing left for review.",
    ),
    Model(
        "gemma-12b-qat-6bit",
        "mlx-community/gemma-3-12b-it-qat-6bit",
        "Gemma 3",
        "12B",
        "11.2 GB",
        added="2025-04-15",
        note="Six bits instead of four: measured, and worth neither the 3.2 GB nor the fifth of speed.",
    ),
    Model(
        "gemma-12b",
        "mlx-community/gemma-3-12b-it-4bit",
        "Gemma 3",
        "12B",
        "8.0 GB",
        added="2025-03-12",
        note="Same weights without the QAT conversion: what quantisation alone costs.",
    ),
    Model(
        "gemma4-e4b",
        "mlx-community/gemma-4-e4b-it-4bit",
        "Gemma 4",
        "E4B",
        "5.1 GB",
        added="2026-04-02",
        note="Selective activation, flat 4-bit: drops placeholders and its Russian is the weakest. Use the OptiQ one.",
    ),
    Model(
        "gemma4-e4b-qat",
        "mlx-community/gemma-4-E4B-it-qat-4bit",
        "Gemma 4",
        "E4B",
        "6.8 GB",
        added="2026-06-05",
        note="Quantisation-aware twin of gemma4-e4b, still unmeasured. The OptiQ one beat both.",
    ),
    Model(
        "gemma4-e4b-optiq",
        "mlx-community/gemma-4-e4b-it-qat-OptiQ-4bit",
        "Gemma 4",
        "E4B",
        "7.5 GB",
        added="2026-06-13",
        note="QAT plus per-layer bit allocation. Won the bench: best speed, Russian level with the best.",
    ),
    Model(
        "gemma4-e4b-8bit",
        "mlx-community/gemma-4-e4b-it-8bit",
        "Gemma 4",
        "E4B",
        "8.9 GB",
        added="2026-04-02",
        note="The same model with no quantisation damage left to blame. The family ceiling.",
    ),
    Model(
        "qwen-14b",
        "mlx-community/Qwen3-14B-4bit",
        "Qwen 3",
        "14B",
        "8.3 GB",
        thinking=True,
        added="2025-04-28",
        note="Ties the best Russian score, but the slowest of the lot and it leaks Latin.",
    ),
    Model(
        "qwen35-9b",
        "mlx-community/Qwen3.5-9B-4bit",
        "Qwen 3.5",
        "9B",
        "6.0 GB",
        added="2026-03-02",
        note="Best English of the bench. Linear attention: no prompt cache, see the README.",
    ),
    Model(
        "qwen35-9b-optiq",
        "mlx-community/Qwen3.5-9B-OptiQ-4bit",
        "Qwen 3.5",
        "9B",
        "8.2 GB",
        added="2026-03-05",
        note="Per-layer bit allocation over qwen35-9b, and the download people reach for.",
    ),
    Model(
        "mistral-24b",
        "mlx-community/Mistral-Small-3.2-24B-Instruct-2506-4bit",
        "Mistral Small 3.2",
        "24B",
        "13.3 GB",
        added="2025-06-21",
        note="Twice the parameters in the same budget, and a family nobody here has measured. Past a 16 GB Mac's default wired limit: see the README.",
    ),
)

DEFAULT_ALIAS = "gemma4-e4b-optiq"
ALIASES = tuple(model.alias for model in CATALOGUE)


def find(name: str) -> Model | None:
    wanted = name.strip().lower()

    for model in CATALOGUE:
        if wanted in (model.alias, model.repo.lower()):
            return model

    return None


def repo_for(name: str | None) -> str:
    if not name:
        return repo_for(DEFAULT_ALIAS)

    found = find(name)

    return found.repo if found is not None else name.strip()


def profile_for(repo: str) -> str:
    found = find(repo)

    if found is not None:
        return found.profile

    return TRANSLATE if "translategemma" in repo.lower() else INSTRUCT


def thinks(repo: str) -> bool:
    found = find(repo)

    return found is not None and found.thinking


def size_text(size: int) -> str:
    return f"{size / GIGABYTE:.1f} GB" if size >= GIGABYTE else f"{size / MEGABYTE:.0f} MB"


def local_text(model: Model, downloaded: Mapping[str, int]) -> str:
    size = downloaded.get(model.repo.lower())

    return size_text(size) if size is not None else MISSING


def columns(model: Model, downloaded: Mapping[str, int]) -> tuple[str, ...]:
    return (
        model.alias,
        model.repo,
        model.size,
        model.disk,
        local_text(model, downloaded),
        model.added or MISSING,
        model.note,
    )


HEADINGS = ("alias", "repository", "size", "expected", "downloaded", "added", "what it is for")


def table(downloaded: Mapping[str, int] | None = None) -> str:
    sizes = downloaded or {}

    return ruled([HEADINGS, *(columns(model, sizes) for model in CATALOGUE)])


def summary(downloaded: Mapping[str, int] | None = None) -> str:
    sizes = downloaded or {}
    here = [sizes[model.repo.lower()] for model in CATALOGUE if model.repo.lower() in sizes]

    if not here:
        return "\nNone of them downloaded yet. The first run of one pulls it in."

    return f"\n{len(here)} of {len(CATALOGUE)} downloaded, {size_text(sum(here))} on disk."
