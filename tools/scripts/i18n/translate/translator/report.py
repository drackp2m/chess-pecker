from __future__ import annotations

import json
import sys
import time
from collections import Counter
from dataclasses import dataclass, field
from pathlib import Path

GAVE_UP = 0
TRACE_LINES = 6
ORDINALS = {1: "first try", 2: "second", 3: "third", 4: "fourth"}


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


# What the model got wrong, and how often, is the only way to tell a bad model
# from a bad prompt after the fact — the log scrolls past, this does not.
@dataclass
class Tally:
    batch_calls: int = 0
    batch_offered: int = 0
    batch_kept: int = 0
    batch_missing: int = 0
    batch_short: int = 0
    batch_reach: int = 0
    backoff: int = 0
    size: int = 0
    batch_issues: Counter = field(default_factory=Counter)
    single_units: int = 0
    single_calls: int = 0
    single_issues: Counter = field(default_factory=Counter)
    attempts: Counter = field(default_factory=Counter)
    repaired: int = 0

    def batched(
        self, offered: int, answered: int, kept: int, issues: list[str], reach: int
    ) -> None:
        self.batch_calls += 1
        self.batch_offered += offered
        self.batch_kept += kept
        self.batch_missing += offered - answered
        self.batch_reach += reach
        self.batch_short += 1 if reach < offered else 0
        self.batch_issues.update(issues)

    def alone(self, calls: int, attempt: int, issues: list[str], repaired: bool) -> None:
        self.single_units += 1
        self.single_calls += calls
        self.attempts[attempt] += 1
        self.single_issues.update(issues)
        self.repaired += 1 if repaired else 0

    def payload(self) -> dict:
        return {
            "batch_calls": self.batch_calls,
            "batch_offered": self.batch_offered,
            "batch_kept": self.batch_kept,
            "batch_missing": self.batch_missing,
            "batch_short": self.batch_short,
            "backoff": self.backoff,
            "batch_size": self.size,
            "batch_issues": dict(self.batch_issues),
            "single_units": self.single_units,
            "single_calls": self.single_calls,
            "single_issues": dict(self.single_issues),
            "attempts": {str(key): value for key, value in sorted(self.attempts.items())},
            "repaired": self.repaired,
        }

    def batch_lines(self) -> list[str]:
        if not self.batch_calls:
            return []

        lines = [
            f"Batches: {self.batch_calls} calls, {self.batch_offered} units offered, "
            f"{self.batch_kept} answered and kept"
        ]
        rejected = self.batch_offered - self.batch_kept - self.batch_missing

        if rejected:
            lines.append(f"  {rejected} rejected (checks failed: {counted(self.batch_issues)})")

        if self.batch_missing:
            lines.append(f"  {self.batch_missing} never answered (the model lost the numbering)")

        if self.batch_short:
            average = self.batch_reach / self.batch_calls
            lines.append(
                f"  {self.batch_short} of {self.batch_calls} calls stopped answering "
                f"around line {average:.0f}"
            )

        if self.backoff:
            lines.append(f"  --batch backed off {self.backoff} time(s), ending at {self.size}")

        return lines

    def single_lines(self) -> list[str]:
        if not self.single_units:
            return []

        lines = [f"One at a time: {self.single_units} units, {self.single_calls} calls"]
        order = [f"{ORDINALS.get(key, key)} {value}" for key, value in sorted(self.attempts.items()) if key]

        if self.attempts[GAVE_UP]:
            order.append(f"gave up {self.attempts[GAVE_UP]}")

        if order:
            lines.append("  " + " · ".join(order))

        if self.single_issues:
            lines.append(f"  checks failed: {counted(self.single_issues)}")

        if self.repaired:
            lines.append(f"  {self.repaired} rescued by re-attaching placeholders")

        return lines

    def lines(self) -> list[str]:
        return self.batch_lines() + self.single_lines()


def counted(issues: Counter) -> str:
    return ", ".join(f"{code} {count}" for code, count in issues.most_common())


@dataclass
class Reporter:
    as_json: bool = False
    started: float = field(default_factory=time.perf_counter)
    records: list[Record] = field(default_factory=list)
    groups: list[dict] = field(default_factory=list)
    files: list[dict] = field(default_factory=list)
    finished: dict = field(default_factory=dict)

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

    @property
    def batched(self) -> int:
        return len([record for record in self.records if record.origin == "batch"])

    def emit(self, payload: dict) -> None:
        if self.as_json:
            print(json.dumps(payload, ensure_ascii=False), flush=True)

    def say(self, text: str = "") -> None:
        if not self.as_json:
            print(text, flush=True)

    def warn(self, text: str) -> None:
        print(text, file=sys.stderr, flush=True)

    # Nothing parseable came back, and no counter can say why: the only useful
    # thing left is the reply itself, so it goes to stderr where --json is not.
    def unparsed(self, reply: str) -> None:
        lines = [line for line in reply.splitlines() if line.strip()][:TRACE_LINES]

        self.warn("  No numbered lines in the batch answer. What came back:")

        for line in lines or ["(nothing at all)"]:
            self.warn(f"    | {line[:120]}")

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

    def forms_checked(self, scope: str, key: str, issues: list) -> None:
        if not issues:
            return

        detail = "; ".join(f"{issue.code} ({issue.detail})" for issue in issues)

        self.groups.append({"scope": scope, "key": key, "issues": detail})
        self.emit({"event": "forms", "scope": scope, "key": key, "issues": detail})
        self.say(f"  ! {scope}/{key}: {detail}")

    def rates(self, usage) -> dict[str, float]:
        minutes = self.elapsed / 60

        return {
            "units_per_minute": self.translated / minutes if minutes else 0.0,
            "tokens_per_second": usage.tokens_per_second,
            "prompt_tokens_per_call": usage.prompt_tokens / usage.calls if usage.calls else 0.0,
            "seconds": self.elapsed,
        }

    def summary(self, engine, memory, tally: Tally) -> dict:
        rates = self.rates(engine.usage)

        return {
            "tally": tally.payload(),
            "event": "done",
            "backend": engine.name,
            "model": engine.model,
            "translated": self.translated,
            "from_memory": memory.hits,
            "from_batch": self.batched,
            "review": len(self.reviewed),
            "forms_flagged": len(self.groups),
            "calls": engine.usage.calls,
            "prompt_tokens": engine.usage.prompt_tokens,
            "generation_tokens": engine.usage.generation_tokens,
            **{key: round(value, 2) for key, value in rates.items()},
        }

    def finish(self, engine, memory, tally: Tally) -> dict:
        summary = self.summary(engine, memory, tally)
        self.finished = summary

        self.emit(summary)
        self.say()
        self.say(
            f"Translated {summary['translated']} units "
            f"({summary['from_batch']} in a batch, {summary['from_memory']} from memory) "
            f"in {summary['seconds']:.0f}s"
        )
        self.say(
            f"{summary['units_per_minute']:.1f} units/min · "
            f"{summary['tokens_per_second']:.1f} tokens/s · "
            f"{summary['calls']} model calls · "
            f"{summary['prompt_tokens_per_call']:.0f} prompt tokens/call"
        )

        for line in tally.lines():
            self.say(line if line.startswith(" ") else f"\n{line}")

        if self.reviewed:
            self.say(f"\n{len(self.reviewed)} unit(s) marked for review:")

            for record in self.reviewed:
                self.say(f"  {record.scope}/{record.key}: {'; '.join(record.issues)}")

        if self.groups:
            self.say(f"\n{len(self.groups)} key(s) whose forms need a look:")

            for group in self.groups:
                self.say(f"  {group['scope']}/{group['key']}: {group['issues']}")

        return summary


def write_report(path: Path, summary: dict, reporter: Reporter, tally: Tally) -> None:
    lines = [
        "# Translation run",
        "",
        f"- Backend: `{summary['backend']}`",
        f"- Model: `{summary['model']}`",
        f"- Translated: {summary['translated']} units "
        f"({summary['from_batch']} answered in a batch, "
        f"{summary['from_memory']} from the run memory)",
        f"- Marked for review: {summary['review']}",
        f"- Keys whose forms need a look: {summary['forms_flagged']}",
        f"- Speed: {summary['units_per_minute']:.1f} units/min, "
        f"{summary['tokens_per_second']:.1f} tokens/s",
        f"- Model calls: {summary['calls']} "
        f"({summary['prompt_tokens']} prompt / {summary['generation_tokens']} generated tokens, "
        f"{summary['prompt_tokens_per_call']:.0f} prompt tokens per call)",
        "",
        "## Files",
        "",
    ]

    for entry in reporter.files:
        lines.append(f"- `{entry['input']}` → `{entry['output']}` ({entry['pending']} pending)")

    if tally.lines():
        lines += ["", "## What had to be corrected", "", "```"]
        lines += tally.lines()
        lines.append("```")

    if reporter.reviewed:
        lines += ["", "## Marked for review", "", "| Scope | Key | Source | Target | Why |", "| --- | --- | --- | --- | --- |"]

        for record in reporter.reviewed:
            issues = "; ".join(record.issues).replace("|", "\\|")
            source = record.source.replace("|", "\\|")
            target = record.target.replace("|", "\\|")
            lines.append(
                f"| {record.scope} | {record.key} | {source} | {target} | {issues} |"
            )

    if reporter.groups:
        lines += ["", "## Forms that need a look", "", "| Scope | Key | Why |", "| --- | --- | --- |"]

        for group in reporter.groups:
            issues = group["issues"].replace("|", "\\|")
            lines.append(f"| {group['scope']} | {group['key']} | {issues} |")

    path.write_text("\n".join(lines) + "\n", encoding="utf-8")
