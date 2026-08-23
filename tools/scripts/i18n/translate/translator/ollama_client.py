"""The prototype backend: a local Ollama serving the same layered prompt the
MLX engine gets, so the two can be compared. Deleted in T5."""

from __future__ import annotations

import requests

OLLAMA_URL = "http://localhost:11434/api/chat"
DEFAULT_MODEL = "translategemma:4b"


def ollama_chat_messages(
    messages: list[dict[str, str]],
    model: str,
    options: dict | None = None,
    timeout: int = 600,
) -> str:
    payload = {
        "model": model,
        "messages": messages,
        "stream": False,
        "options": options or {"temperature": 0},
    }

    try:
        response = requests.post(OLLAMA_URL, json=payload, timeout=timeout)
        response.raise_for_status()
    except requests.RequestException as exc:
        raise RuntimeError(f"Could not contact Ollama: {exc}") from exc

    try:
        return response.json()["message"]["content"].strip()
    except (ValueError, KeyError, TypeError) as exc:
        raise RuntimeError(f"Unexpected response from Ollama: {response.text}") from exc
