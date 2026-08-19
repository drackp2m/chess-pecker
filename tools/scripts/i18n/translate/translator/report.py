from __future__ import annotations

import json
import sys
import time
from dataclasses import dataclass, field
from pathlib import Path


@dataclass
class Record:
    scope: str
    key: str
    unit: str
    source: str
    target: str
    origin: str
    issues: list[str] = field(default_factory=list)
    review: bool = False
    seconds: float = 0.0


@dataclass
class Reporter:
    as_json: bool = False
    started: float = field(default_factory=time.perf_counter)
    records: list[Record] = field(default_factory=list)
    files: list[dict] = field(default_factory=list)

    def reset(self) -> None:
        self.started = time.perf_counter()

    @property
    def elapsed(self) -> float:
        return time.perf_counter() - self.started

    @property
    def translated(self) -> int:
        return len(self.records)

    @property
    def reviewed(self) -> list[Record]:
        return [record for record in self.records if record.review]

    def emit(self, payload: dict) -> None:
        if self.as_json:
            print(json.dumps(payload, ensure_ascii=False), flush=True)

    def say(self, text: str = "") -> None:
        if not self.as_json:
            print(text, flush=True)

    def warn(self, text: str) -> None:
        print(text, file=sys.stderr, flush=True)

    def file_started(self, path: Path, output: Path, pending: int, total: int) -> None:
        self.files.append({"input": str(path), "output": str(output), "pending": pending})
        self.emit(
            {
                "event": "file",
                "input": str(path),
                "output": str(output),
                "pending": pending,
                "total": total,
            }
        )
        self.say(f"\n{path}  →  {output}")
        self.say(f"  {total} units, {pending} pending")

    def unit_done(self, record: Record, index: int, pending: int) -> None:
        self.records.append(record)
        self.emit(
            {
                "event": "unit",
                "scope": record.scope,
                "key": record.key,
                "id": record.unit,
                "source": record.source,
                "target": record.target,
                "origin": record.origin,
                "issues": record.issues,
                "review": record.review,
                "seconds": round(record.seconds, 3),
            }
        )

        flag = " [review]" if record.review else ""
        self.say(f"  [{index}/{pending}] {record.key}{flag}")
        self.say(f"    {record.source!r}")
        self.say(f"    → {record.target!r}  ({record.origin}, {record.seconds:.1f}s)")

        for issue in record.issues:
            self.say(f"    ! {issue}")

    def rates(self, usage) -> dict[str, float]:
        minutes = self.elapsed / 60

        return {
            "units_per_minute": self.translated / minutes if minutes else 0.0,
            "tokens_per_second": usage.tokens_per_second,
            "seconds": self.elapsed,
        }

    def summary(self, engine, memory) -> dict:
        rates = self.rates(engine.usage)

        return {
            "event": "done",
            "backend": engine.name,
            "model": engine.model,
            "translated": self.translated,
            "from_memory": memory.hits,
            "review": len(self.reviewed),
            "calls": engine.usage.calls,
            "prompt_tokens": engine.usage.prompt_tokens,
            "generation_tokens": engine.usage.generation_tokens,
            **{key: round(value, 2) for key, value in rates.items()},
        }

    def finish(self, engine, memory) -> dict:
        summary = self.summary(engine, memory)

        self.emit(summary)
        self.say()
        self.say(
            f"Translated {summary['translated']} units "
            f"({summary['from_memory']} from memory) in {summary['seconds']:.0f}s"
        )
        self.say(
            f"{summary['units_per_minute']:.1f} units/min · "
            f"{summary['tokens_per_second']:.1f} tokens/s · "
            f"{summary['calls']} model calls"
        )

        if self.reviewed:
            self.say(f"\n{len(self.reviewed)} unit(s) marked for review:")

            for record in self.reviewed:
                self.say(f"  {record.scope}/{record.key}: {'; '.join(record.issues)}")

        return summary


def write_report(path: Path, summary: dict, reporter: Reporter) -> None:
    lines = [
        "# Translation run",
        "",
        f"- Backend: `{summary['backend']}`",
        f"- Model: `{summary['model']}`",
        f"- Translated: {summary['translated']} units "
        f"({summary['from_memory']} from the run memory)",
        f"- Marked for review: {summary['review']}",
        f"- Speed: {summary['units_per_minute']:.1f} units/min, "
        f"{summary['tokens_per_second']:.1f} tokens/s",
        f"- Model calls: {summary['calls']} "
        f"({summary['prompt_tokens']} prompt / {summary['generation_tokens']} generated tokens)",
        "",
        "## Files",
        "",
    ]

    for entry in reporter.files:
        lines.append(f"- `{entry['input']}` → `{entry['output']}` ({entry['pending']} pending)")

    if reporter.reviewed:
        lines += ["", "## Marked for review", "", "| Scope | Key | Source | Target | Why |", "| --- | --- | --- | --- | --- |"]

        for record in reporter.reviewed:
            issues = "; ".join(record.issues).replace("|", "\\|")
            source = record.source.replace("|", "\\|")
            target = record.target.replace("|", "\\|")
            lines.append(
                f"| {record.scope} | {record.key} | {source} | {target} | {issues} |"
            )

    path.write_text("\n".join(lines) + "\n", encoding="utf-8")
