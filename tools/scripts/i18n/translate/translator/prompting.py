from __future__ import annotations

import re
from dataclasses import dataclass, field

from .context import parse_glossary, split_rules, useful_keep, useful_rules, useful_terms
from .models import INSTRUCT, TRANSLATE
from .placeholders import marker_position
from .validate import Form, validate_forms
from .xliff_io import (
    expected_markers_for,
    find_files,
    find_units,
    first_segment,
    note_text,
    notes_of,
    segment_source,
    segment_target,
    source_to_prompt_text,
    sub_state_of,
    target_is_empty,
    target_to_prompt_text,
)

OPEN, CLOSE = "⟦", "⟧"
INJECTIONS = ("none", "terms", "full")
OUTDATED_SUB_STATE = "chesspecker:outdated"
REVIEW_SUB_STATE = "chesspecker:review"
ANSWER_RE = re.compile(r"^\s*(\d{1,3})\s*[.)\]:>–-]?\s*(.*\S)\s*$")

CORE_RULES = """\
- Traduce sólo lo que va entre ⟦ y ⟧, y responde con la traducción y nada más: sin las marcas, \
sin comillas alrededor, sin explicaciones y sin repetir el original.
- Las notas son para ti: dicen qué es el texto y cómo debe sonar. No se traducen, no se resumen y \
no aparecen en la respuesta ni en parte.
- No dejes ni una palabra en el idioma de origen: la respuesta va entera en el idioma de destino, \
salvo lo que el vocabulario marque como intraducible.
- Copia la puntuación final del original: si no acaba en punto, tu traducción tampoco.\
"""

MARKER_RULES = """\
## Marcadores
- Los que tienen la forma __PH_s1__ son huecos que la aplicación rellena al vuelo.
- Cópialos tal cual, una sola vez cada uno, sin traducirlos ni renombrarlos.
- Colócalos donde los pida la gramática del idioma de destino.
- No inventes marcadores que no estén en el origen.\
"""

CONTEXT_PREFIX = "- Qué es: "
DEMAND_PREFIX = "- Usa sí o sí estas palabras: "

MIXED_MARKERS = (
    "- Sólo llevan marcadores los textos donde ya aparecen; a los demás no les añadas ninguno."
)

EXAMPLE = """\
Ejemplo:
Origen: «Cargados __PH_s1__ ejercicios»
Correcto: «Loaded __PH_s1__ exercises»
Incorrecto: «Loaded exercises» (se ha perdido el marcador; no hagas esto nunca)\
"""

SECTIONS = (
    ("app", "La aplicación"),
    ("language", "El idioma de destino"),
    ("scope", "Esta sección de la interfaz"),
)


def parse_terms(text: str) -> list[tuple[str, str]]:
    terms = []

    for chunk in text.split(","):
        piece = chunk.strip()

        if not piece:
            continue

        if "→" in piece:
            term, target = piece.split("→", 1)
            terms.append((term.strip(), target.strip()))
        else:
            terms.append((piece, ""))

    return terms


@dataclass(frozen=True)
class Block:
    scope: str
    source_lang: str
    target_lang: str
    notes: dict[str, list[str]] = field(default_factory=dict)
    profile: str = INSTRUCT
    injection: str = "terms"

    @property
    def glossary(self):
        return parse_glossary(note_text(self.notes, "glossary"))

    @property
    def keep(self) -> tuple[str, ...]:
        return self.glossary[1]

    @property
    def rules(self) -> list[str]:
        return split_rules(note_text(self.notes, "app"))[1]

    def section(self, category: str) -> str:
        text = note_text(self.notes, category)

        return split_rules(text)[0] if category == "app" else text

    @property
    def system(self) -> str:
        parts = [
            f"Eres un traductor profesional de {self.source_lang} a "
            f"{self.target_lang}, especializado en interfaces de software.",
            CORE_RULES,
        ]

        for category, heading in SECTIONS:
            text = self.section(category)

            if text:
                parts.append(f"## {heading}\n{text}")

        return "\n\n".join(parts)


@dataclass
class Unit:
    element: object
    segment: object
    source_element: object
    id: str
    scope: str
    source: str
    markers: list[str]
    notes: dict[str, list[str]]
    previous: str
    outdated: bool

    @property
    def key(self) -> str:
        return note_text(self.notes, "key") or self.id

    @property
    def terms(self) -> list[tuple[str, str]]:
        return parse_terms(note_text(self.notes, "term"))

    def markers_note(self) -> list[str]:
        lines = []

        for marker in self.markers:
            position = marker_position(self.source, marker)

            if position == "start":
                lines.append(f"- {marker} abre el texto; tu traducción también debe abrir con él.")
            elif position == "end":
                lines.append(f"- {marker} cierra el texto; tu traducción también debe cerrar con él.")
            else:
                lines.append(f"- {marker} va dentro de la frase.")

        return lines

    @property
    def context(self) -> str:
        return " ".join(note_text(self.notes, "context").split())

    def demand_lines(self) -> list[str]:
        pairs = [f"«{target}» para «{term}»" for term, target in self.terms if target]

        return [DEMAND_PREFIX + ", ".join(pairs)] if pairs else []

    def detail_lines(self) -> list[str]:
        lines = []
        params = note_text(self.notes, "param")

        if params and self.markers:
            lines.append(f"- Qué rellena cada hueco: {params}")

        lines.extend(self.markers_note())

        if self.outdated and self.previous:
            lines.append(
                "- Había esta traducción, hecha sobre un origen que después cambió; "
                f"corrígela, no la copies: {self.previous}"
            )

        return lines

    def note_lines(self) -> list[str]:
        lines = [f"{CONTEXT_PREFIX}{self.context}"] if self.context else []

        return self.demand_lines() + lines + self.detail_lines()


@dataclass
class Batch:
    block: Block
    units: list[Unit]
    attempt: int = 0
    reason: str = ""
    demand: tuple[tuple[str, str], ...] = ()

    @property
    def size(self) -> int:
        return len(self.units)

    @property
    def single(self) -> bool:
        return self.size == 1

    @property
    def texts(self) -> list[str]:
        return [unit.source for unit in self.units]

    @property
    def has_markers(self) -> bool:
        return any(unit.markers for unit in self.units)

    def marker_section(self) -> str:
        if not self.has_markers:
            return ""

        if all(unit.markers for unit in self.units):
            return MARKER_RULES

        return f"{MARKER_RULES}\n{MIXED_MARKERS}"

    def named_terms(self) -> set[str]:
        return {source.casefold() for unit in self.units for source, _ in unit.terms}

    def glossary_section(self) -> str:
        terms, keep = self.block.glossary
        lines = [term.line for term in useful_terms(terms, self.texts, self.named_terms())]
        names = useful_keep(keep, self.texts)

        if names:
            lines.append(f"Se dejan como están, sin traducir: {', '.join(names)}")

        if not lines:
            return ""

        return "## Vocabulario obligado\n" + "\n".join(lines)

    def rules_section(self) -> str:
        rules = useful_rules(self.block.rules, self.texts)

        if not rules:
            return ""

        return "## Reglas que aplican aquí\n" + "\n".join(f"- {rule}" for rule in rules)

    def retry_section(self) -> str:
        if not (self.attempt and self.reason):
            return ""

        lines = [
            f"Tu respuesta anterior se rechazó: {self.reason}. Responde otra vez con "
            "sólo la traducción, corrigiendo eso."
        ]

        for term, target in self.demand:
            lines.append(
                f"El original dice «{term}»: tu traducción tiene que llevar la palabra "
                f"«{target}», con la forma que pida la frase."
            )

        return "\n".join(lines)

    def example_section(self) -> str:
        return EXAMPLE if self.attempt > 1 and self.has_markers else ""

    def head(self) -> list[str]:
        parts = (
            self.rules_section(),
            self.marker_section(),
            self.glossary_section(),
            self.retry_section(),
            self.example_section(),
        )

        return [part for part in parts if part]

    def one(self) -> str:
        unit = self.units[0]
        notes = unit.note_lines()
        parts = []

        if notes:
            parts.append("## Notas (no se traducen)\n" + "\n".join(notes))

        parts.append(
            f"Traduce al {self.block.target_lang} el texto que va entre {OPEN} y {CLOSE}, "
            f"y responde sólo con la traducción:\n{OPEN}{unit.source}{CLOSE}"
        )

        return "\n\n".join(parts)

    # The export hangs the same group note on every key of a group, so inside a
    # batch it would arrive ten times over: it is written once and pointed at.
    def context_line(self, unit: Unit, index: int, seen: dict[str, int]) -> str:
        first = seen.setdefault(unit.context, index)

        if first == index:
            return f"  {CONTEXT_PREFIX}{unit.context}"

        return f"  {CONTEXT_PREFIX}lo mismo que en el {first}."

    def many(self) -> str:
        lines = []
        seen: dict[str, int] = {}

        for index, unit in enumerate(self.units, 1):
            lines.append(f"{index} {OPEN}{unit.source}{CLOSE}")
            lines.extend(f"  {line}" for line in unit.demand_lines())

            if unit.context:
                lines.append(self.context_line(unit, index, seen))

            lines.extend(f"  {note}" for note in unit.detail_lines())

        return (
            f"Traduce al {self.block.target_lang} los {self.size} textos numerados. Responde "
            f"con {self.size} líneas, cada una con su número, un espacio y sólo la traducción: "
            f"sin las marcas {OPEN} {CLOSE}, sin las notas y sin ninguna línea de más.\n\n"
            + "\n".join(lines)
        )

    def render(self) -> str:
        return "\n\n".join([*self.head(), self.one() if self.single else self.many()])


# Numbering only has to climb, not to be complete: a model that skips one line
# used to cost the whole tail of the batch, and every line is validated against
# its own source anyway.
def parse_answers(text: str, count: int) -> dict[int, str]:
    answers: dict[int, str] = {}
    last = 0

    for line in text.splitlines():
        match = ANSWER_RE.match(line)

        if match is None:
            continue

        index = int(match.group(1))

        if not last < index <= count:
            continue

        answers[index] = match.group(2).strip()
        last = index

    return answers


# TranslateGemma's template has no slot for anything but the text, so the only
# way terminology reaches it is inside the text itself — which is what Google
# recommends, and what the validator is there to police.
def injected(unit: Unit, injection: str) -> str:
    if injection == "none":
        return unit.source

    lines = [f"{term} = {target}" for term, target in unit.terms if target]

    if injection == "full":
        context = " ".join(note_text(unit.notes, "context").split())

        if context:
            lines.append(context)

    if not lines:
        return unit.source

    return "\n".join(lines) + f"\n{OPEN}{unit.source}{CLOSE}"


def translate_content(block: Block, unit: Unit) -> list[dict[str, str]]:
    return [
        {
            "type": "text",
            "source_lang_code": block.source_lang,
            "target_lang_code": block.target_lang,
            "text": injected(unit, block.injection),
        }
    ]


def build_messages(batch: Batch) -> list[dict]:
    block = batch.block

    if block.profile == TRANSLATE:
        return [{"role": "user", "content": translate_content(block, batch.units[0])}]

    return [
        {"role": "system", "content": block.system},
        {"role": "user", "content": batch.render()},
    ]


def fenced(block: Block, unit: Unit) -> bool:
    return block.profile == INSTRUCT or injected(unit, block.injection) != unit.source


def unit_of(element, scope: str) -> Unit | None:
    segment = first_segment(element)

    if segment is None:
        return None

    source_element = segment_source(segment)

    if source_element is None:
        return None

    source, _ = source_to_prompt_text(source_element)
    target_element = segment_target(segment)
    previous = ""

    if target_element is not None and not target_is_empty(segment):
        previous = target_to_prompt_text(source_element, target_element) or ""

    return Unit(
        element=element,
        segment=segment,
        source_element=source_element,
        id=element.get("id") or "",
        scope=scope,
        source=source,
        markers=expected_markers_for(source_element),
        notes=notes_of(element),
        previous=previous,
        outdated=sub_state_of(segment) == OUTDATED_SUB_STATE,
    )


def is_pending(unit: Unit) -> bool:
    return unit.outdated or not unit.previous.strip()


def blocks_of(
    file_element,
    source_lang: str,
    target_lang: str,
    profile: str = INSTRUCT,
    injection: str = "terms",
) -> tuple[Block, list[Unit]]:
    scope = file_element.get("id") or ""
    block = Block(
        scope=scope,
        source_lang=source_lang,
        target_lang=target_lang,
        notes=notes_of(file_element),
        profile=profile,
        injection=injection,
    )
    units = [unit_of(element, scope) for element in find_units(file_element)]

    return block, [unit for unit in units if unit is not None]


def group_id(unit: Unit) -> str:
    return unit.id.split("#", 1)[0]


def forms_of(units: list[Unit]) -> list[Form]:
    return [Form(note_text(unit.notes, "category"), unit.previous) for unit in units]


def groups_of(units: list[Unit]) -> list[list[Unit]]:
    grouped: dict[str, list[Unit]] = {}

    for unit in units:
        if "#" in unit.id:
            grouped.setdefault(group_id(unit), []).append(unit)

    return list(grouped.values())


def check_forms(root, langs: tuple[str, str], reporter) -> None:
    for element in find_files(root):
        block, units = blocks_of(element, *langs)

        for group in groups_of(units):
            reporter.forms_checked(
                block.scope, group[0].key, validate_forms(forms_of(group), langs[1])
            )
