"""DeepL as a yardstick, not as a backend: it writes the same kind of file a
model run writes, so --compare can score the local models against it."""

from __future__ import annotations

import os
import re
import time
from dataclasses import dataclass, field
from pathlib import Path

import requests

from .prompting import REVIEW_SUB_STATE, blocks_of, is_pending
from .report import Record
from .validate import validate
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

KEY_VAR = "DEEPL_API_KEY"
FREE_SUFFIX = ":fx"
FREE_HOST = "https://api-free.deepl.com/v2"
PRO_HOST = "https://api.deepl.com/v2"
CHUNK = 50
TIMEOUT = 120
MARKER_RE = re.compile(r"__PH_([A-Za-z0-9]+)__")
PH_RE = re.compile(r"<ph id=\"([A-Za-z0-9]+)\"\s*/>")
REGIONAL = ("EN-GB", "EN-US", "PT-BR", "PT-PT", "ZH-HANS", "ZH-HANT")
GLOSSARY_LANGS = frozenset(
    "AR BG CS DA DE EL EN ES ET FI FR HE HU ID IT JA KO LT LV NB NL PL PT RO RU SK SL SV TH TR UK VI ZH".split()
)


class DeeplError(RuntimeError):
    pass


def api_key() -> str:
    key = os.environ.get(KEY_VAR, "").strip()

    if not key:
        raise DeeplError(
            f"No {KEY_VAR} in the environment. Put it in the .env at the repo "
            "root, or export it for this command."
        )

    return key


def host_for(key: str) -> str:
    return FREE_HOST if key.endswith(FREE_SUFFIX) else PRO_HOST


def code_of(tag: str, regional: bool) -> str:
    upper = tag.upper()

    if regional and upper in REGIONAL:
        return upper

    return upper.split("-")[0]


def escaped(text: str) -> str:
    safe = text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")

    return MARKER_RE.sub(lambda found: f'<ph id="{found.group(1)}"/>', safe)


def unescaped(text: str) -> str:
    plain = PH_RE.sub(lambda found: f"__PH_{found.group(1)}__", text)

    return plain.replace("&lt;", "<").replace("&gt;", ">").replace("&amp;", "&")


@dataclass
class Client:
    key: str
    host: str = ""
    session: requests.Session = field(default_factory=requests.Session)
    calls: int = 0
    characters: int = 0

    def __post_init__(self) -> None:
        self.host = self.host or host_for(self.key)

    def post(self, path: str, data: dict | list, as_json: bool = True):
        headers = {"Authorization": f"DeepL-Auth-Key {self.key}"}
        payload = {"json": data} if as_json else {"data": data}

        try:
            answer = self.session.post(
                f"{self.host}{path}", headers=headers, timeout=TIMEOUT, **payload
            )
        except requests.RequestException as exc:
            raise DeeplError(f"Could not reach DeepL: {exc}") from exc

        if answer.status_code == 456:
            raise DeeplError("DeepL says the quota for this key is spent.")

        if answer.status_code >= 400:
            raise DeeplError(f"DeepL answered {answer.status_code}: {answer.text[:300]}")

        return answer.json() if answer.content else {}

    def delete(self, path: str) -> None:
        headers = {"Authorization": f"DeepL-Auth-Key {self.key}"}

        try:
            self.session.delete(f"{self.host}{path}", headers=headers, timeout=TIMEOUT)
        except requests.RequestException:
            pass

    def translate(self, texts: list[str], source: str, target: str, glossary: str | None) -> list[str]:
        body = {
            "text": [escaped(text) for text in texts],
            "source_lang": source,
            "target_lang": target,
            "tag_handling": "xml",
            "ignore_tags": ["ph"],
            "preserve_formatting": True,
        }

        if glossary:
            body["glossary_id"] = glossary

        answer = self.post("/translate", body)
        self.calls += 1
        self.characters += sum(len(text) for text in texts)

        try:
            return [unescaped(item["text"]) for item in answer["translations"]]
        except (KeyError, TypeError) as exc:
            raise DeeplError(f"Unexpected answer from DeepL: {answer}") from exc

    def make_glossary(self, terms, source: str, target: str) -> str | None:
        pairs = {term.source: term.target for term in terms if term.source and term.target}

        if not pairs or source not in GLOSSARY_LANGS or target not in GLOSSARY_LANGS:
            return None

        answer = self.post(
            "/glossaries",
            {
                "name": f"chesspecker-{source}-{target}",
                "source_lang": source,
                "target_lang": target,
                "entries": "\n".join(f"{key}\t{value}" for key, value in pairs.items()),
                "entries_format": "tsv",
            },
        )

        return answer.get("glossary_id")


def units_of(root, scopes: list[str], only_stale: bool) -> tuple[list, list]:
    jobs = []
    terms = []

    for element in find_files(root):
        block, units = blocks_of(element, *get_languages(root))

        if scopes and block.scope not in scopes:
            continue

        terms.extend(block.glossary[0])
        jobs.extend(
            (block, unit)
            for unit in units
            if (unit.outdated if only_stale else is_pending(unit))
        )

    return jobs, terms


def chunked(jobs: list, size: int):
    for start in range(0, len(jobs), size):
        yield jobs[start : start + size]


def issues_of(unit, block, text: str, lang: str) -> list[str]:
    found = validate(text, unit.source, unit.markers, unit.terms, lang, block.keep)

    return [f"{issue.code}: {issue.detail}" for issue in found]


def store(unit, text: str, review: bool) -> None:
    replace_target(unit.segment, build_target(unit.source_element, text))
    set_state(unit.segment, "translated", REVIEW_SUB_STATE if review else None)


def write_batch(batch: list, texts: list[str], reporter, lang: str, done: int, pending: int) -> int:
    for (block, unit), text in zip(batch, texts):
        issues = issues_of(unit, block, text, lang)
        done += 1
        store(unit, text, bool(issues))
        reporter.unit_done(
            Record(
                scope=unit.scope,
                key=unit.key,
                unit=unit.id,
                source=unit.source,
                target=text,
                origin="deepl",
                issues=issues,
                review=bool(issues),
            ),
            done,
            pending,
        )

    return done


def translate_file(
    client: Client, path: Path, args, reporter, budget: int | None, output: Path | None = None
) -> int:
    output = output or output_for(path, args.output, "deepl")

    ensure_parent(output)

    tree = read_xliff(output if output.exists() else path)
    root = tree.getroot()
    source_lang, target_lang = get_languages(root)
    jobs, terms = units_of(root, args.scope, args.only_stale)
    jobs = jobs if budget is None else jobs[:budget]
    langs = (code_of(source_lang, False), code_of(target_lang, True))
    glossary = None if args.no_glossary else client.make_glossary(terms, *langs)

    reporter.file_started(path, output, len(jobs), len(jobs))
    reporter.say(f"  DeepL {langs[0]} → {langs[1]}" + ("  (with glossary)" if glossary else ""))
    done = 0

    try:
        for batch in chunked(jobs, CHUNK):
            sources = [unit.source for _, unit in batch]
            texts = client.translate(sources, *langs, glossary)
            done = write_batch(batch, texts, reporter, target_lang, done, len(jobs))

            save_tree(tree, output)
    finally:
        save_tree(tree, output)

        if glossary:
            client.delete(f"/glossaries/{glossary}")

    return done


# A reference run is worth nothing if it silently stops halfway, so the summary
# says what it cost in characters: that is the number the quota is spent in.
def run_deepl(args, reporter, jobs=None) -> int:
    client = Client(api_key())
    started = time.perf_counter()
    budget = args.limit
    done = 0

    for path, output in jobs or [(path, None) for path in args.inputs]:
        if budget is not None and budget <= 0:
            break

        translated = translate_file(client, path, args, reporter, budget, output)
        done += translated
        budget = None if budget is None else budget - translated

    elapsed = time.perf_counter() - started
    review = len(reporter.reviewed)

    reporter.say(
        f"\nDeepL translated {done} units in {elapsed:.0f}s "
        f"({client.calls} calls, {client.characters} characters of quota)"
    )

    if review:
        reporter.say(f"{review} unit(s) failed a check and are marked for review:")

        for record in reporter.reviewed:
            reporter.say(f"  {record.scope}/{record.key}: {'; '.join(record.issues)}")

    return 0
