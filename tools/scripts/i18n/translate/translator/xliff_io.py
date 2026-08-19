"""Reading, writing and manipulating the XLIFF 2.0 XML tree:
<source>/<target>/<segment>/<ph> handling."""

from __future__ import annotations

import re
from pathlib import Path

from lxml import etree

from .placeholders import PH_RE

XLIFF_NS = "urn:oasis:names:tc:xliff:document:2.0"
NS = {"x": XLIFF_NS}


def local_name(element) -> str:
    """Return the local XML element name."""
    return etree.QName(element).localname


def read_xliff(path: Path):
    parser = etree.XMLParser(
        remove_blank_text=False,
        resolve_entities=False,
        no_network=True,
    )

    try:
        tree = etree.parse(str(path), parser)
    except OSError as exc:
        raise RuntimeError(f"Cannot read XLIFF file: {exc}") from exc
    except etree.XMLSyntaxError as exc:
        raise RuntimeError(f"Invalid XML/XLIFF: {exc}") from exc

    root = tree.getroot()

    if local_name(root) != "xliff":
        raise RuntimeError("The root element is not <xliff>.")

    return tree


def get_languages(root):
    source_lang = root.get("srcLang")
    target_lang = root.get("trgLang")

    if not source_lang or not target_lang:
        raise RuntimeError(
            "The XLIFF must define srcLang and trgLang."
        )

    return source_lang, target_lang


def source_to_prompt_text(source_element):
    """
    Turn:

        Cargados <ph id="s1"/> ejercicios

    into:

        Cargados __PH_s1__ ejercicios

    while remembering where each placeholder came from.
    """
    parts: list[str] = []
    placeholders: list[tuple[str, etree._Element]] = []

    if source_element.text:
        parts.append(source_element.text)

    for child in source_element:
        if local_name(child) == "ph":
            ph_id = child.get("id")
            if not ph_id:
                raise RuntimeError("<ph> without an id.")

            marker = f"__PH_{ph_id}__"
            parts.append(marker)
            placeholders.append((marker, child))

        else:
            raise RuntimeError(
                f"Unsupported element inside <source>: "
                f"<{local_name(child)}>"
            )

        if child.tail:
            parts.append(child.tail)

    return "".join(parts), placeholders


def expected_markers_for(source_element) -> list[str]:
    """Markers that MUST appear in the translation."""
    markers = []

    for child in source_element:
        if local_name(child) == "ph":
            ph_id = child.get("id")
            markers.append(f"__PH_{ph_id}__")

    return markers


def build_target(source_element, translated_text: str):
    """
    Reconstruct a <target> preserving the <ph> elements.

    The translated text must contain every placeholder marker exactly once.
    """
    expected_markers = expected_markers_for(source_element)

    found_markers = PH_RE.findall(translated_text)

    if sorted(found_markers) != sorted(expected_markers):
        raise RuntimeError(
            "Placeholder mismatch.\n"
            f"Expected: {expected_markers}\n"
            f"Found:    {found_markers}\n"
            f"Translation: {translated_text}"
        )

    target = etree.Element(f"{{{XLIFF_NS}}}target")

    # Map marker -> original <ph> template.
    ph_templates = {}

    for child in source_element:
        if local_name(child) == "ph":
            ph_id = child.get("id")
            marker = f"__PH_{ph_id}__"
            ph_templates[marker] = child

    # Split while keeping markers.
    tokens = re.split(r"(__PH_[A-Za-z0-9_.-]+__)", translated_text)

    previous_node = None

    for token in tokens:
        if not token:
            continue

        if token in ph_templates:
            original_ph = ph_templates[token]
            ph = etree.SubElement(
                target,
                f"{{{XLIFF_NS}}}ph",
            )

            # Copy all attributes.
            for key, value in original_ph.attrib.items():
                ph.set(key, value)

            previous_node = ph

        else:
            if previous_node is None:
                target.text = (target.text or "") + token
            else:
                previous_node.tail = (previous_node.tail or "") + token

    return target


def find_segments(root):
    """
    Yield <segment> elements in document order.
    """
    return root.xpath(".//x:segment", namespaces=NS)


def target_is_empty(segment):
    targets = segment.xpath("./x:target", namespaces=NS)

    if not targets:
        return True

    target = targets[0]

    # Consider target empty if it contains no text/elements.
    if target.text and target.text.strip():
        return False

    if len(target):
        return False

    return True


def replace_target(segment, new_target):
    old_targets = segment.xpath("./x:target", namespaces=NS)

    if old_targets:
        old_target = old_targets[0]
        parent = old_target.getparent()
        index = parent.index(old_target)
        new_target.tail = old_target.tail
        parent.remove(old_target)
        parent.insert(index, new_target)
    else:
        # No previous <target>: match indentation, using the source's
        # own tail (e.g. "\n    ") as a guide, then close the segment
        # on its own line.
        source = segment.find(f"{{{XLIFF_NS}}}source")
        indent = source.tail if source is not None and source.tail else "\n"
        new_target.tail = indent
        segment.append(new_target)


def save_tree(tree, output_path: Path):
    """
    Write the result after every successfully translated segment.
    """
    tree.write(
        str(output_path),
        encoding="UTF-8",
        xml_declaration=True,
        pretty_print=False,
    )
