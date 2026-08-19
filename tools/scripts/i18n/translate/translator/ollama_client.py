"""Everything that talks to Ollama: raw chat calls and the
segment-translation prompt/response handling."""

from __future__ import annotations

import json
import re

import requests

from .placeholders import marker_position

OLLAMA_URL = "http://localhost:11434/api/chat"
DEFAULT_MODEL = "translategemma:4b"
BIG_MODEL = "translategemma:12b"
DEFAULT_GLOSSARY_MODEL = "qwen2.5-coder:7b"


def ollama_chat(prompt: str, model: str, timeout: int = 600) -> str:
    """Bare Ollama chat call: one prompt in, raw text out."""
    payload = {
        "model": model,
        "messages": [{"role": "user", "content": prompt}],
        "stream": False,
        "options": {"temperature": 0},
    }

    try:
        response = requests.post(OLLAMA_URL, json=payload, timeout=timeout)
        response.raise_for_status()
    except requests.RequestException as exc:
        raise RuntimeError(f"Could not contact Ollama: {exc}") from exc

    try:
        data = response.json()
        return data["message"]["content"].strip()
    except (ValueError, KeyError, TypeError) as exc:
        raise RuntimeError(
            f"Unexpected response from Ollama: {response.text}"
        ) from exc


def parse_json_response(text: str):
    """Parse a model's JSON reply, tolerating ```json fences."""
    cleaned = text.strip()
    cleaned = re.sub(r"^```(json)?", "", cleaned).strip()
    cleaned = re.sub(r"```$", "", cleaned).strip()
    return json.loads(cleaned)


def ollama_translate(
    text: str,
    source_lang: str,
    target_lang: str,
    model: str,
    expected_markers: list[str],
    timeout: int = 600,
    strict: bool = False,
    with_example: bool = False,
    glossary_terms: list[tuple[str, str]] | None = None,
    context: str | None = None,
) -> str:
    """
    Translate one segment using TranslateGemma via Ollama.
    """

    prompt = (
        f"You are a professional {source_lang} ({source_lang}) "
        f"to {target_lang} ({target_lang}) translator. "
        "Your goal is to accurately convey the meaning and nuances "
        f"of the original {source_lang} text while adhering to "
        f"{target_lang} grammar, vocabulary, and cultural conventions.\n\n"
        f"Produce only the {target_lang} translation, without any "
        "additional explanations or commentary.\n"
    )

    if context:
        prompt += (
            f"\nContext about this document: {context}. Use this to "
            "resolve ambiguous words and pick the correct "
            "domain-specific meaning/translation, not a generic one.\n"
        )

    if expected_markers:
        markers = ", ".join(expected_markers)
        prompt += (
            "\nIMPORTANT:\n"
            f"- The text contains these placeholders: {markers}\n"
            "- Placeholders look like __PH_s1__ and may be attached "
            "directly to a word, e.g. __PH_s1__M. They are NOT part "
            "of the word and must NEVER be translated or removed.\n"
            "- Preserve every placeholder exactly as it appears.\n"
            "- Do not add, remove, rename, or translate placeholders.\n"
            "- Keep placeholders in an appropriate grammatical position.\n"
        )

        for marker in expected_markers:
            position = marker_position(text, marker)

            if position == "start":
                prompt += (
                    f"- {marker} is at the very beginning of the text; "
                    "your translation must also begin with it.\n"
                )
            elif position == "end":
                prompt += (
                    f"- {marker} is at the very end of the text; "
                    "your translation must also end with it.\n"
                )
    else:
        prompt += (
            "\nIMPORTANT:\n"
            "- The text contains no placeholders.\n"
            "- Do not add any markers such as __PH_...__ to your output.\n"
        )

    if strict and expected_markers:
        markers = ", ".join(expected_markers)
        prompt += (
            "\nYour previous answer was rejected because it dropped "
            f"these placeholders: {markers}. Answer again with ONLY "
            "the translation, and make sure every one of those "
            "placeholders appears verbatim in your output.\n"
        )

    if with_example and expected_markers:
        prompt += (
            "\nEXAMPLE (source language token, keep it untranslated "
            "and unchanged, wherever it lands grammatically):\n"
            "Source: 'Loaded __PH_s1__ exercises.'\n"
            "Correct output: 'लोड किए गए __PH_s1__ अभ्यास।'\n"
            "Incorrect output: 'लोड किए गए अभ्यास।' "
            "(placeholder silently dropped — never do this)\n"
        )

    if glossary_terms:
        prompt += (
            "\nUse this established terminology consistently "
            "(these translations are already fixed for this "
            "document, keep using them):\n"
        )
        for term, translation in glossary_terms:
            prompt += f"- {term} → {translation}\n"

    prompt += (
        f"\nPlease translate the following {source_lang} text into "
        f"{target_lang}:\n\n"
        f"{text}"
    )

    payload = {
        "model": model,
        "messages": [
            {
                "role": "user",
                "content": prompt,
            }
        ],
        "stream": False,
        "options": {
            # Deterministic enough for reproducible testing.
            "temperature": 0,
        },
    }

    try:
        response = requests.post(
            OLLAMA_URL,
            json=payload,
            timeout=timeout,
        )
        response.raise_for_status()
    except requests.RequestException as exc:
        raise RuntimeError(
            f"Could not contact Ollama: {exc}"
        ) from exc

    try:
        data = response.json()
        translated = data["message"]["content"]
    except (ValueError, KeyError, TypeError) as exc:
        raise RuntimeError(
            f"Unexpected response from Ollama: {response.text}"
        ) from exc

    translated = translated.strip()

    if not translated:
        raise RuntimeError("Ollama returned an empty translation.")

    return translated
