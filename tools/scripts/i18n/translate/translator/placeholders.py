"""Everything about the __PH_x__ placeholder markers: finding them,
validating them, and recovering from a model dropping or inventing
one."""

from __future__ import annotations

import re

PH_RE = re.compile(r"__PH_[A-Za-z0-9_.-]+__")


def marker_position(source_text: str, marker: str) -> str:
    """Where a marker sits in the source: 'start', 'end' or 'middle'."""
    idx = source_text.find(marker)

    if idx == -1:
        return "middle"

    before = source_text[:idx].strip()
    after = source_text[idx + len(marker):].strip()

    if not before:
        return "start"

    if not after:
        return "end"

    return "middle"


def strip_hallucinated_placeholders(
    translated_text: str,
    expected_markers: list[str],
) -> str:
    """
    Remove placeholder markers the model invented.

    Small models sometimes echo the example marker from the prompt
    (e.g. __PH_s1__) even when the source has no placeholders.
    Extra markers are safe to drop; missing ones are not.
    """
    found = PH_RE.findall(translated_text)
    extras = {m for m in found if m not in expected_markers}

    if not extras:
        return translated_text

    print(
        f"    WARNING: removing hallucinated placeholders: "
        f"{sorted(extras)}"
    )

    for marker in extras:
        translated_text = translated_text.replace(marker, "")

    # Clean up whitespace left behind by the removed markers.
    translated_text = re.sub(r"[ \t]{2,}", " ", translated_text)
    translated_text = re.sub(r" +([.,;:!?])", r"\1", translated_text)

    return translated_text.strip()


def insert_marker_by_relative_position(
    source_text: str,
    translated_text: str,
    marker: str,
) -> str:
    """
    Heuristic fallback for a marker that was in the middle of the
    source and got dropped by the model.

    Estimates where the marker "should" go in the translation by
    using its relative character position in the source text, then
    snaps to the nearest word boundary. This is a best-effort guess,
    not a translation-aware placement, so callers must warn loudly.
    """
    idx = source_text.find(marker)

    if idx == -1 or not translated_text:
        # Can't estimate a position; just append at the end.
        return (translated_text + " " + marker).strip()

    ratio = idx / len(source_text)
    target_idx = round(ratio * len(translated_text))

    # Snap to the nearest whitespace boundary so we don't split a word.
    left = translated_text.rfind(" ", 0, target_idx)
    right = translated_text.find(" ", target_idx)

    if left == -1 and right == -1:
        snap_idx = len(translated_text)
    elif left == -1:
        snap_idx = right
    elif right == -1:
        snap_idx = left
    else:
        snap_idx = left if (target_idx - left) <= (right - target_idx) else right

    return (
        translated_text[:snap_idx].rstrip()
        + " " + marker + " "
        + translated_text[snap_idx:].lstrip()
    ).strip()


def salvage_missing_markers(
    source_text: str,
    translated_text: str,
    expected_markers: list[str],
):
    """
    Last-resort fix for markers the model dropped.

    Markers at the very start or end of the source are re-attached at
    the same position in the translation. Markers that were in the
    middle of the source are placed using a relative-position
    heuristic (see insert_marker_by_relative_position) since we can't
    know the correct grammatical spot for certain.
    """
    found = PH_RE.findall(translated_text)
    missing = [m for m in expected_markers if m not in found]

    if not missing:
        return translated_text

    heuristic_markers = []

    for marker in missing:
        position = marker_position(source_text, marker)

        if position == "start":
            translated_text = marker + " " + translated_text
        elif position == "end":
            translated_text = translated_text + " " + marker
        else:
            translated_text = insert_marker_by_relative_position(
                source_text, translated_text, marker
            )
            heuristic_markers.append(marker)

    print(
        f"    WARNING: re-attached dropped placeholders: {missing}"
    )

    if heuristic_markers:
        print(
            "    WARNING: placement is a best-effort guess (marker was "
            f"mid-sentence) for: {heuristic_markers} — please review "
            "this segment manually."
        )

    return translated_text
