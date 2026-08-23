from __future__ import annotations

from dataclasses import dataclass

from .tables import ruled

INSTRUCT = "instruct"
TRANSLATE = "translate"
PROFILES = (INSTRUCT, TRANSLATE)


@dataclass(frozen=True)
class Model:
    alias: str
    repo: str
    family: str
    size: str
    disk: str
    profile: str = INSTRUCT
    thinking: bool = False
    note: str = ""


CATALOGUE = (
    Model(
        "gemma-4b",
        "mlx-community/gemma-3-4b-it-4bit",
        "Gemma 3",
        "4B",
        "3.4 GB",
        note="Smallest one that still reads the whole prompt. Fast, loses nuance.",
    ),
    Model(
        "gemma-4b-qat",
        "mlx-community/gemma-3-4b-it-qat-4bit",
        "Gemma 3",
        "4B",
        "3.0 GB",
        note="Quantisation-aware conversion: same size, less damage than plain 4-bit.",
    ),
    Model(
        "gemma-12b",
        "mlx-community/gemma-3-12b-it-4bit",
        "Gemma 3",
        "12B",
        "8.0 GB",
        note="The generalist the plan takes as its reference point.",
    ),
    Model(
        "gemma-12b-qat",
        "mlx-community/gemma-3-12b-it-qat-4bit",
        "Gemma 3",
        "12B",
        "8.0 GB",
        note="Same weights as gemma-12b, quantisation-aware. Start here on a 16 GB Mac.",
    ),
    Model(
        "gemma-27b",
        "mlx-community/gemma-3-27b-it-4bit",
        "Gemma 3",
        "27B",
        "16.8 GB",
        note="Needs 32 GB of unified memory to stay comfortable.",
    ),
    Model(
        "gemma-27b-qat",
        "mlx-community/gemma-3-27b-it-qat-4bit",
        "Gemma 3",
        "27B",
        "16.8 GB",
        note="The best Gemma that fits on a 32 GB Mac.",
    ),
    Model(
        "gemma4-e2b",
        "mlx-community/gemma-4-e2b-it-4bit",
        "Gemma 4",
        "E2B",
        "3.6 GB",
        note="Selective activation: 2B of it runs at a time, all of it sits in memory.",
    ),
    Model(
        "gemma4-e4b",
        "mlx-community/gemma-4-e4b-it-4bit",
        "Gemma 4",
        "E4B",
        "5.1 GB",
        note="The bigger of the two selective ones. The Gemma 4 to try first.",
    ),
    Model(
        "gemma4-26b",
        "mlx-community/gemma-4-26b-a4b-it-4bit",
        "Gemma 4",
        "26B-A4B",
        "15.3 GB",
        note="Mixture of experts, 4B active. Wants a 32 GB Mac.",
    ),
    Model(
        "gemma4-31b",
        "mlx-community/gemma-4-31b-it-4bit",
        "Gemma 4",
        "31B",
        "18.4 GB",
        note="The dense flagship. Slow, and the most Gemma 4 there is.",
    ),
    Model(
        "qwen-4b",
        "mlx-community/Qwen3-4B-Instruct-2507-4bit",
        "Qwen 3",
        "4B",
        "2.3 GB",
        note="The 2507 instruct line never reasons, so nothing has to be turned off.",
    ),
    Model(
        "qwen-8b",
        "mlx-community/Qwen3-8B-4bit",
        "Qwen 3",
        "8B",
        "4.6 GB",
        thinking=True,
        note="Hybrid model: thinking is switched off through the chat template.",
    ),
    Model(
        "qwen-14b",
        "mlx-community/Qwen3-14B-4bit",
        "Qwen 3",
        "14B",
        "8.3 GB",
        thinking=True,
        note="Same family as qwen-8b, one size up.",
    ),
    Model(
        "qwen-30b",
        "mlx-community/Qwen3-30B-A3B-Instruct-2507-4bit",
        "Qwen 3",
        "30B-A3B",
        "17.2 GB",
        note="Mixture of experts: 3B active, so it runs near a small model on a big machine.",
    ),
    Model(
        "qwen35-2b",
        "mlx-community/Qwen3.5-2B-4bit",
        "Qwen 3.5",
        "2B",
        "1.7 GB",
        note="The smallest thing here. Worth a run when speed is the whole point.",
    ),
    Model(
        "qwen35-4b",
        "mlx-community/Qwen3.5-4B-4bit",
        "Qwen 3.5",
        "4B",
        "3.0 GB",
        note="Successor to qwen-4b. Linear-attention layers: no prompt cache, see the README.",
    ),
    Model(
        "qwen35-9b",
        "mlx-community/Qwen3.5-9B-4bit",
        "Qwen 3.5",
        "9B",
        "6.0 GB",
        note="Successor to qwen-8b, same caveat about the prompt cache.",
    ),
    Model(
        "qwen36-35b",
        "mlx-community/Qwen3.6-35B-A3B-4bit",
        "Qwen 3.6",
        "35B-A3B",
        "20.4 GB",
        note="Mixture of experts, 3B active. Wants a 32 GB Mac.",
    ),
    Model(
        "qwen38-27b",
        "mlx-community/Qwen3.8-27B-4bit",
        "Qwen 3.8",
        "27B",
        "16.1 GB",
        note="The newest dense Qwen. Multimodal upstream; mlx-lm loads the text half.",
    ),
    Model(
        "translate-4b",
        "mlx-community/translategemma-4b-it-4bit",
        "TranslateGemma",
        "4B",
        "2.2 GB",
        profile=TRANSLATE,
        note="Translation only: no system prompt, no context, no batching.",
    ),
    Model(
        "translate-4b-8bit",
        "mlx-community/translategemma-4b-it-8bit",
        "TranslateGemma",
        "4B",
        "4.1 GB",
        profile=TRANSLATE,
        note="Same model, 8-bit: the cheapest way to tell quantisation damage apart from the model.",
    ),
    Model(
        "translate-12b",
        "mlx-community/translategemma-12b-it-4bit",
        "TranslateGemma",
        "12B",
        "6.6 GB",
        profile=TRANSLATE,
        note="The middle size of the specialist.",
    ),
    Model(
        "translate-27b",
        "mlx-community/translategemma-27b-it-4bit",
        "TranslateGemma",
        "27B",
        "15.2 GB",
        profile=TRANSLATE,
        note="The biggest specialist that fits on a 32 GB Mac.",
    ),
)

DEFAULT_ALIAS = "gemma-12b"
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


def columns(model: Model) -> tuple[str, ...]:
    return (model.alias, model.repo, model.size, model.disk, model.profile, model.note)


HEADINGS = ("alias", "repository", "size", "on disk", "prompt", "what it is for")


def table() -> str:
    return ruled([HEADINGS, *(columns(model) for model in CATALOGUE)])
