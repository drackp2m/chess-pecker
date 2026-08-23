from __future__ import annotations

GAP = "  "


def widths_of(rows: list[tuple[str, ...]]) -> list[int]:
    return [max(len(row[column]) for row in rows) for column in range(len(rows[0]))]


def aligned(rows: list[tuple[str, ...]]) -> list[str]:
    widths = widths_of(rows)

    return [GAP.join(cell.ljust(width) for cell, width in zip(row, widths)).rstrip() for row in rows]


def ruled(rows: list[tuple[str, ...]]) -> str:
    lines = aligned(rows)

    lines.insert(1, GAP.join("-" * width for width in widths_of(rows)))

    return "\n".join(lines)
