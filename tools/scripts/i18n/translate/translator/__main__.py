#!/usr/bin/env python3

from __future__ import annotations

import sys
from dataclasses import dataclass
from pathlib import Path

from .cli import build_arg_parser
from .downloads import prune_cache, show_cache
from .compare import compare
from .deepl import DeeplError, run_deepl
from .dotenv import load_env
from .engine import build_engine
from .environment import HostUnsupportedError
from .memory import TranslationMemory
from .models import TRANSLATE, profile_for, table
from .prompting import (
    REVIEW_SUB_STATE,
    Batch,
    blocks_of,
    build_messages,
    fenced,
    is_pending,
    parse_answers,
)
from .report import GAVE_UP, Record, Reporter, Tally, write_report
from .validate import clean, demanded, reason_of, repair, validate
from .xliff_io import (
    build_target,
    ensure_parent,
    find_files,
    get_languages,
    output_for,
    read_xliff,
    replace_target,
    save_tree,
    set_state,
)

RETRIES = 2
MAX_TOKENS_FACTOR = 4
MAX_TOKENS_FLOOR = 48
MAX_TOKENS_CEILING = 640
BATCH_CEILING = 2048
BATCH_SLACK = 8
BATCH_CHARS = 700
MIN_BATCH = 1
JUDGE_FROM = 4
SHRINK_RATIO = 0.75

@dataclass
class Session:
    engine: object
    args: object
    memory: TranslationMemory
    reporter: Reporter
    tally: Tally
    size: int = 1

    def resize(self, size: int) -> None:
        self.size = size
        self.tally.size = size

    # A model that cannot hold a numbered list of twenty loses every unit it
    # never answers to a call of its own. Taking the size down to what it did
    # manage converges in a step or two, and turns --batch into a ceiling
    # rather than a wager.
    def shrink(self, offered: int, answered: int) -> None:
        if self.size <= MIN_BATCH or offered < JUDGE_FROM:
            return

        if answered >= offered * SHRINK_RATIO:
            return

        managed = answered if answered else self.size // 2

        self.resize(max(MIN_BATCH, managed))
        self.tally.backoff += 1
        self.reporter.warn(
            f"  Only {answered} of {offered} lines came back; "
            f"dropping the batch size to {self.size}."
        )


def max_tokens_for(engine, batch: Batch) -> int:
    estimate = sum(engine.count_tokens(unit.source) for unit in batch.units) * MAX_TOKENS_FACTOR
    ceiling = MAX_TOKENS_CEILING if batch.single else BATCH_CEILING

    return max(MAX_TOKENS_FLOOR, min(ceiling, estimate + batch.size * BATCH_SLACK))


def judge(block, unit, text: str) -> tuple[str, list]:
    candidate = clean(text, unit.source, "last" if fenced(block, unit) else "first")
    issues = validate(
        candidate,
        unit.source,
        unit.markers,
        unit.terms,
        lang=block.target_lang,
        keep=block.keep,
    )

    return candidate, issues


def ask(engine, batch: Batch) -> str:
    return engine.generate(build_messages(batch), max_tokens_for(engine, batch))


def attempt(engine, batch: Batch, index: int, issues: list) -> tuple[str, list]:
    batch.attempt = index
    batch.reason = reason_of(issues) if issues else ""
    batch.demand = demanded(issues)

    return judge(batch.block, batch.units[0], ask(engine, batch))


def translate_unit(session: Session, block, unit) -> tuple[str, list[str], bool]:
    batch = Batch(block, [unit])
    seen: list[str] = []
    candidate, issues = attempt(session.engine, batch, 0, [])
    calls = 1

    while issues and calls <= RETRIES:
        seen.extend(issue.code for issue in issues)
        candidate, issues = attempt(session.engine, batch, calls, issues)
        calls += 1

    if not issues:
        session.tally.alone(calls, calls, seen, False)

        return candidate, [], False

    seen.extend(issue.code for issue in issues)
    rescued = any(issue.hard for issue in issues)

    if rescued:
        candidate = repair(candidate, unit.source, unit.markers)

    session.tally.alone(calls, GAVE_UP, seen, rescued)

    return candidate, [f"{issue.code}: {issue.detail}" for issue in issues], True


# A batch answer is all-or-nothing per line: what comes back clean is kept, and
# what does not is simply not there, so the caller retranslates it on its own.
def translate_batch(session: Session, batch: Batch) -> dict[int, str]:
    reply = ask(session.engine, batch)
    answers = parse_answers(reply, batch.size)
    accepted = {}
    seen: list[str] = []

    if not answers:
        session.reporter.unparsed(reply)

    for number, answer in answers.items():
        candidate, issues = judge(batch.block, batch.units[number - 1], answer)

        if issues:
            seen.extend(issue.code for issue in issues)
        else:
            accepted[number - 1] = candidate

    session.tally.batched(
        batch.size, len(answers), len(accepted), seen, max(answers, default=0)
    )
    session.shrink(batch.size, len(answers))

    return accepted


def remembered_units(batch: Batch, memory) -> tuple[list, list]:
    outcomes = []
    left = []

    for unit in batch.units:
        found = memory.get(batch.block.target_lang, unit.source)

        if found is None:
            left.append(unit)
        else:
            outcomes.append((unit, found, "memory", [], False))

    return outcomes, left


def in_order(batch: Batch, outcomes: list) -> list:
    place = {id(unit): index for index, unit in enumerate(batch.units)}

    return sorted(outcomes, key=lambda outcome: place[id(outcome[0])])


def resolve(session: Session, batch: Batch) -> list:
    lang = batch.block.target_lang
    memory = session.memory
    outcomes, left = remembered_units(batch, memory)

    if len(left) > 1:
        accepted = translate_batch(session, Batch(batch.block, left))

        for index in sorted(accepted, reverse=True):
            unit = left.pop(index)
            memory.remember(lang, unit.source, accepted[index])
            outcomes.append((unit, accepted[index], "batch", [], False))

    for unit in left:
        text, issues, review = translate_unit(session, batch.block, unit)

        if not review:
            memory.remember(lang, unit.source, text)

        outcomes.append((unit, text, "model", issues, review))

    return in_order(batch, outcomes)


def wanted(unit, args) -> bool:
    if args.scope and unit.scope not in args.scope:
        return False

    if args.only_stale:
        return unit.outdated

    return is_pending(unit)


def shape_for(args, model: str) -> dict[str, str]:
    profile = args.profile if args.profile != "auto" else profile_for(model)

    return {"profile": profile, "injection": args.inject}


def batch_size_for(args, shape: dict[str, str]) -> int:
    if shape.get("profile") == TRANSLATE:
        return 1

    return max(1, args.batch)


def plan_file(root, args, shape) -> tuple[list, int]:
    jobs = []
    total = 0

    for element in find_files(root):
        block, units = blocks_of(element, *get_languages(root), **shape)
        total += len(units)

        for unit in units:
            if wanted(unit, args):
                jobs.append((block, unit))

    return jobs, total


# Units arrive in the document order the export wrote, which is the order of
# keys.ts: neighbours in a batch are neighbours in the catalogue. Batches are
# cut one at a time because the size can drop while the run is going.
def next_batch(jobs: list, start: int, size: int) -> Batch:
    block = jobs[start][0]
    units: list = []
    length = 0

    for owner, unit in jobs[start:]:
        crowded = len(units) >= size or length + len(unit.source) > BATCH_CHARS

        if owner is not block or (units and crowded):
            break

        units.append(unit)
        length += len(unit.source)

    return Batch(block, units)


def seed_memory(root, memory, source_lang, target_lang) -> None:
    for element in find_files(root):
        block, units = blocks_of(element, source_lang, target_lang)

        for unit in units:
            if not unit.outdated and unit.previous.strip():
                memory.seed(target_lang, unit.source, unit.previous)


def apply_unit(unit, text: str, review: bool) -> None:
    replace_target(unit.segment, build_target(unit.source_element, text))
    set_state(unit.segment, "translated", REVIEW_SUB_STATE if review else None)


def show_prompts(batch: Batch, reporter) -> None:
    reporter.say(f"\n----- {batch.block.scope}: {', '.join(unit.key for unit in batch.units)}")

    for message in build_messages(batch):
        reporter.say(f"[{message['role']}]")
        reporter.say(str(message["content"]))


def record_unit(unit, text: str, origin: str, issues: list[str], review: bool, seconds: float):
    return Record(
        scope=unit.scope,
        key=unit.key,
        unit=unit.id,
        source=unit.source,
        target=text,
        origin=origin,
        issues=issues,
        review=review,
        seconds=seconds,
    )


def write_outcomes(outcomes: list, reporter, done: int, pending: int, seconds: float) -> int:
    for unit, text, origin, issues, review in outcomes:
        if not text.strip():
            reporter.warn(f"  {unit.scope}/{unit.key}: no translation, left pending.")
            continue

        try:
            apply_unit(unit, text, review)
        except RuntimeError as exc:
            reporter.warn(f"  {unit.scope}/{unit.key}: {exc}")
            reporter.warn("  Left pending.")
            continue

        done += 1
        reporter.unit_done(record_unit(unit, text, origin, issues, review, seconds), done, pending)

    return done


def run_jobs(jobs: list, session: Session, tree, output) -> int:
    reporter = session.reporter
    done = 0
    pending = len(jobs)
    current = None
    start = 0

    while start < len(jobs):
        batch = next_batch(jobs, start, session.size)
        start += batch.size

        if batch.block is not current:
            session.engine.start_block()
            current = batch.block

        if session.args.dry_run:
            show_prompts(batch, reporter)
            done += batch.size
            continue

        started = reporter.elapsed
        outcomes = resolve(session, batch)
        spent = (reporter.elapsed - started) / max(1, len(outcomes))
        done = write_outcomes(outcomes, reporter, done, pending, spent)

        save_tree(tree, output)

    return done


def run_file(path: Path, session: Session, budget: int | None, shape=None) -> int:
    args = session.args
    shape = shape or {}
    output = output_for(path, args.output)

    ensure_parent(output)

    tree = read_xliff(output if output.exists() else path)
    root = tree.getroot()
    source_lang, target_lang = get_languages(root)

    seed_memory(root, session.memory, source_lang, target_lang)

    jobs, total = plan_file(root, args, shape)
    pending = len(jobs) if budget is None else min(len(jobs), budget)

    session.reporter.file_started(path, output, pending, total)

    try:
        return run_jobs(jobs[:pending], session, tree, output)
    finally:
        if not args.dry_run:
            save_tree(tree, output)


def run(args, reporter) -> int:
    engine = build_engine(args.backend, args.model, args.temperature)
    session = Session(engine, args, TranslationMemory(enabled=args.memory), reporter, Tally())
    shape = shape_for(args, engine.model)

    session.resize(batch_size_for(args, shape))

    if not args.dry_run:
        reporter.say(f"Loading {engine.name} model {engine.model}…")
        engine.load()

        if engine.load_seconds:
            reporter.say(f"Loaded in {engine.load_seconds:.1f}s")

        reporter.reset()

    reporter.say(
        f"Prompt profile: {shape['profile']} (inject: {shape['injection']}, "
        f"batch: up to {session.size})"
    )

    budget = args.limit

    for path in args.inputs:
        if budget is not None and budget <= 0:
            break

        done = run_file(path, session, budget, shape)

        if budget is not None:
            budget -= done

    if args.dry_run:
        return 0

    summary = reporter.finish(engine, session.memory, session.tally)

    if args.report is not None:
        write_report(args.report, summary, reporter, session.tally)
        reporter.say(f"\nReport: {args.report}")

    return 0


def check_inputs(args, reporter) -> None:
    if not args.inputs:
        reporter.warn("ERROR: no input file given. See --help, or --list-models.")
        sys.exit(1)

    missing = [path for path in args.inputs if not path.exists()]

    if missing:
        reporter.warn(f"ERROR: file does not exist: {', '.join(str(p) for p in missing)}")
        sys.exit(1)

    if args.output is not None and len(args.inputs) > 1:
        reporter.warn("ERROR: --output only makes sense with a single input file.")
        sys.exit(1)

    for target in (args.output, args.report):
        if target is None:
            continue

        try:
            ensure_parent(target)
        except OSError as exc:
            reporter.warn(f"ERROR: cannot write to {target}: {exc}")
            sys.exit(1)


def run_comparison(args, reporter) -> int:
    if len(args.inputs) < (1 if args.reference else 2):
        reporter.warn("ERROR: --compare needs two files, or one and a --reference.")

        return 1

    missing = [path for path in (*args.inputs, args.reference) if path and not path.exists()]

    if missing:
        reporter.warn(f"ERROR: file does not exist: {', '.join(str(p) for p in missing)}")

        return 1

    return compare(reporter, args.inputs, args.reference, args.worst, args.scope)


def main() -> None:
    args = build_arg_parser().parse_args()
    reporter = Reporter(as_json=args.as_json)

    load_env()

    if args.list_models:
        print(table())
        sys.exit(0)

    if args.compare:
        sys.exit(run_comparison(args, reporter))

    if args.cache or args.cache_remove:
        try:
            sys.exit(prune_cache(reporter) if args.cache_remove else show_cache(reporter))
        except KeyboardInterrupt:
            reporter.warn("\nInterrupted. Nothing was deleted.")
            sys.exit(130)

    check_inputs(args, reporter)

    try:
        sys.exit(run_deepl(args, reporter) if args.deepl else run(args, reporter))
    except DeeplError as exc:
        reporter.warn(f"ERROR: {exc}")
        sys.exit(1)
    except HostUnsupportedError as exc:
        reporter.warn(f"ERROR: {exc}")
        sys.exit(1)
    except KeyboardInterrupt:
        reporter.warn("\nInterrupted. Everything translated so far is saved.")
        sys.exit(130)
    except (RuntimeError, OSError) as exc:
        reporter.warn(f"ERROR: {exc}")
        reporter.warn("Everything translated so far is saved in the output file.")
        sys.exit(1)


if __name__ == "__main__":
    main()
