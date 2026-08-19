from __future__ import annotations

from dataclasses import dataclass, field

from .placeholders import marker_position
from .xliff_io import (
    expected_markers_for,
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

KEEP_PREFIX = "No traducir nunca:"
OPEN, CLOSE = "⟦", "⟧"
PROFILES = ("instruct", "translate")
INJECTIONS = ("none", "terms", "full")
OUTDATED_SUB_STATE = "chesspecker:outdated"
REVIEW_SUB_STATE = "chesspecker:review"

RULES = """\
Cada encargo trae unas notas y, al final, el texto a traducir entre ⟦ y ⟧.

- Traduce sólo lo que va entre ⟦ y ⟧, y responde con la traducción y nada más: sin las marcas, \
sin comillas alrededor, sin explicaciones y sin repetir el original.
- Las notas son para ti: dicen qué es el texto y cómo debe sonar. No se traducen, no se resumen y \
no aparecen en la respuesta ni en parte.
- No dejes ni una palabra en el idioma de origen: la respuesta va entera en el idioma de destino, \
salvo lo que el vocabulario marque como intraducible.
- Copia la puntuación final del original: si no acaba en punto, tu traducción tampoco.

Marcadores:
- Los que tienen la forma __PH_s1__ son huecos que la aplicación rellena al vuelo.
- Cópialos tal cual, una sola vez cada uno, sin traducirlos ni renombrarlos.
- Colócalos donde los pida la gramática del idioma de destino.
- No inventes marcadores que no estén en el origen.\
"""

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
    ("glossary", "Vocabulario obligado"),
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
    profile: str = "instruct"
    injection: str = "terms"

    @property
    def keep(self) -> tuple[str, ...]:
        for line in note_text(self.notes, "glossary").splitlines():
            if line.startswith(KEEP_PREFIX):
                return tuple(
                    term.strip() for term in line[len(KEEP_PREFIX) :].split(",") if term.strip()
                )

        return ()

    @property
    def system(self) -> str:
        parts = [
            f"Eres un traductor profesional de {self.source_lang} a "
            f"{self.target_lang}, especializado en interfaces de software.",
            RULES,
        ]

        for category, heading in SECTIONS:
            text = note_text(self.notes, category)

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

    def prompt(self, target_lang: str, attempt: int = 0, reason: str = "") -> str:
        notes = self.note_lines()
        parts = ["Notas (no se traducen):\n" + "\n".join(notes)] if notes else []

        if attempt and reason:
            parts.append(
                f"Tu respuesta anterior se rechazó: {reason}. Responde otra vez con "
                "sólo la traducción, corrigiendo eso."
            )

        if attempt > 1 and self.markers:
            parts.append(EXAMPLE)

        parts.append(
            f"Traduce al {target_lang} el texto que va entre {OPEN} y {CLOSE}, y responde sólo "
            f"con la traducción:\n{OPEN}{self.source}{CLOSE}"
        )

        return "\n\n".join(parts)

    def note_lines(self) -> list[str]:
        lines = []
        context = note_text(self.notes, "context")
        terms = note_text(self.notes, "term")
        params = note_text(self.notes, "param")

        if context:
            flattened = " ".join(context.split())
            lines.append(f"- Qué es este texto: {flattened}")

        if terms:
            lines.append(f"- Términos fijados: {terms}")

        if params:
            lines.append(f"- Qué rellena cada hueco: {params}")

        lines.extend(self.markers_note())

        if not self.markers:
            lines.append("- El texto no lleva marcadores: no añadas ninguno.")

        if self.outdated and self.previous:
            lines.append(
                "- Había esta traducción, hecha sobre un origen que después cambió; "
                f"corrígela, no la copies: {self.previous}"
            )

        return lines


# TranslateGemma's template has no slot for anything but the text, so the only
# way terminology reaches it is inside the text itself — which is what Google
# recommends, and what the validator is there to police.
def injected(unit: "Unit", injection: str) -> str:
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


def translate_content(block: Block, unit: "Unit") -> list[dict[str, str]]:
    return [
        {
            "type": "text",
            "source_lang_code": block.source_lang,
            "target_lang_code": block.target_lang,
            "text": injected(unit, block.injection),
        }
    ]


def build_messages(block: Block, unit: "Unit", attempt: int = 0, reason: str = "") -> list[dict]:
    if block.profile == "translate":
        return [{"role": "user", "content": translate_content(block, unit)}]

    return [
        {"role": "system", "content": block.system},
        {"role": "user", "content": unit.prompt(block.target_lang, attempt, reason)},
    ]


def fenced(block: Block, unit: "Unit") -> bool:
    return block.profile == "instruct" or injected(unit, block.injection) != unit.source


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
    profile: str = "instruct",
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
