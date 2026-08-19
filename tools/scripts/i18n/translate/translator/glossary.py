"""Repeated-terminology glossary: frequency extraction, filtering
with a lightweight model, batch translation, and JSON caching."""

from __future__ import annotations

import json
import re
import time
import unicodedata
from collections import Counter
from pathlib import Path

from .ollama_client import ollama_chat, parse_json_response
from .placeholders import PH_RE
from .xliff_io import XLIFF_NS, source_to_prompt_text

WORD_RE = re.compile(r"[^\W\d_]+", re.UNICODE)


def strip_accents(word: str) -> str:
    """Normalize accented characters for stopword matching, e.g.
    'está' -> 'esta', 'cómo' -> 'como'. Does NOT change the word
    actually used as a glossary term/candidate — only used for
    comparison against the stopword list."""
    normalized = unicodedata.normalize("NFKD", word)
    return "".join(c for c in normalized if not unicodedata.combining(c))

# Small embedded stopword list. Only used to pre-filter candidates for
# Spanish sources before handing them to the glossary model; for other
# source languages we skip this filter and rely on the model + the
# frequency threshold instead.
STOPWORDS_ES = {
    "a", "al", "algo", "algunas", "algunos", "ante", "antes", "como",
    "con", "contra", "cual", "cuando", "de", "del", "desde", "donde",
    "durante", "e", "el", "ella", "ellas", "ellos", "en", "entre",
    "era", "erais", "eramos", "eran", "eras", "eres", "es", "esa",
    "esas", "ese", "eso", "esos", "esta", "estaba", "estabais",
    "estabamos", "estaban", "estabas", "estad", "estada", "estadas",
    "estado", "estados", "estamos", "estando", "estar", "estara",
    "estaran", "estaras", "estare", "estareis", "estaremos", "estaria",
    "estariais", "estariamos", "estarian", "estarias", "estas",
    "este", "esto", "estos", "estoy", "fue", "fuera", "fuerais",
    "fueramos", "fueran", "fueras", "fueron", "fui", "fuimos", "ha",
    "habeis", "haber", "habia", "habiais", "habiamos", "habian",
    "habias", "habida", "habidas", "habido", "habidos", "habiendo",
    "han", "has", "hasta", "hay", "haya", "hayamos", "hayan", "hayas",
    "hayais", "he", "hemos", "hube", "hubiera", "hubierais",
    "hubieramos", "hubieran", "hubieras", "hubieron", "hubiese",
    "hubieseis", "hubiesemos", "hubiesen", "hubieses", "hubimos",
    "hubiste", "hubisteis", "hubo", "la", "las", "le", "les", "lo",
    "los", "mas", "me", "mi", "mia", "mias", "mientras", "mio",
    "mios", "mis", "mucho", "muchos", "muy", "nada", "ni", "no",
    "nos", "nosotras", "nosotros", "nuestra", "nuestras", "nuestro",
    "nuestros", "o", "os", "otra", "otras", "otro", "otros", "para",
    "pero", "poco", "por", "porque", "que", "quien", "quienes", "se",
    "sea", "seamos", "sean", "seas", "sera", "seran", "seras",
    "sereis", "seremos", "seria", "seriais", "seriamos", "serian",
    "serias", "si", "sido", "siendo", "sin", "sobre", "sois", "somos",
    "son", "soy", "su", "sus", "suya", "suyas", "suyo", "suyos",
    "tambien", "tanto", "te", "tendra", "tendran", "tendras",
    "tendre", "tendreis", "tendremos", "tendria", "tendriais",
    "tendriamos", "tendrian", "tendrias", "tened", "tenemos",
    "tenga", "tengamos", "tengan", "tengas", "tengo", "tenia",
    "teniais", "teniamos", "tenian", "tenias", "ti", "tiene",
    "tienen", "tienes", "todo", "todos", "tu", "tus", "tuya", "tuyas",
    "tuyo", "tuyos", "un", "una", "uno", "unos", "vosotras",
    "vosotros", "vuestra", "vuestras", "vuestro", "vuestros", "y",
    "ya", "yo",
    # Extra closed-class words not covered by the base list above.
    # Accented variants (está, cómo, sólo...) are matched via
    # strip_accents(), so we only need the unaccented base form here.
    "solo", "solamente", "asi", "aqui", "ahi", "alli", "aca", "alla",
    "bien", "mal", "mas", "menos", "casi", "siempre", "nunca",
    "todavia", "aun", "incluso", "quiza", "quizas", "tal", "vez",
    "cierto", "cierta", "ciertos", "ciertas", "cada", "algun",
    "alguna", "algunos", "algunas", "ningun", "ninguna", "ningunos",
    "ningunas", "otro", "otra", "otros", "otras", "mismo", "misma",
    "mismos", "mismas", "propio", "propia", "propios", "propias",
}


def extract_candidate_terms(
    segments,
    source_lang: str,
    min_count: int = 3,
    top_n: int = 40,
    min_length: int = 4,
) -> list[tuple[str, int, str]]:
    """
    Frequency count of words across all <source> texts, plus one
    example sentence per word (helps the filtering model judge real
    usage instead of a word in isolation).

    Pure statistics, no model involved. Placeholders are stripped
    first so __PH_s1__ never shows up as a "word".
    """
    counter: Counter[str] = Counter()
    examples: dict[str, str] = {}

    for segment in segments:
        source = segment.find(f"{{{XLIFF_NS}}}source")

        if source is None:
            continue

        text, _ = source_to_prompt_text(source)
        text = PH_RE.sub(" ", text)

        for word in WORD_RE.findall(text.lower()):
            if len(word) < min_length:
                continue
            if source_lang.lower().startswith("es") and strip_accents(word) in STOPWORDS_ES:
                continue
            counter[word] += 1
            examples.setdefault(word, text.strip())

    candidates = [
        (word, count, examples.get(word, ""))
        for word, count in counter.most_common()
        if count >= min_count
    ]

    return candidates[:top_n]


def filter_terms_with_model(
    candidates: list[tuple[str, int, str]],
    source_lang: str,
    glossary_model: str,
    context: str | None = None,
) -> list[str]:
    """
    Ask a lightweight model to keep only real domain terminology from
    the frequency-based candidates (drop leftover connectors, generic
    verbs, etc.). Falls back to the raw candidate list if the model
    call or JSON parsing fails.
    """
    if not candidates:
        return []

    context_block = ""
    if context:
        context_block = (
            f"\nContext about this document: {context}. Use this to "
            "judge whether a word is domain terminology (e.g. specific "
            "to that context) versus a generic word that happens to be "
            "frequent.\n"
        )

    word_lines = "\n".join(
        f"- {w} ({c} times) — example: \"{example}\""
        for w, c, example in candidates
    )

    prompt = (
        f"The following words are the most frequent ones in a "
        f"{source_lang} software UI text corpus, along with how many "
        f"times each appears and one example sentence where it's "
        f"used:\n\n{word_lines}\n"
        f"{context_block}"
        "\nGo through each word and decide, based on how it's ACTUALLY "
        "used in its example sentence (not just the word in "
        "isolation), whether it is specific domain/product "
        "terminology that must be translated the SAME way every "
        "time it appears (e.g. a feature name, a UI element, a "
        "domain-specific noun).\n\n"
        "Discard a word if, in its example, it is:\n"
        "- a generic connector, pronoun, preposition, or adverb\n"
        "- part of a generic verb form or imperative aimed at the "
        "user in a non-domain way (e.g. 'inténtalo', 'espera')\n"
        "- a generic adjective/quality word whose translation "
        "doesn't need to be fixed (e.g. 'alto', 'bajo', 'nuevo' used "
        "as plain descriptors, not as a fixed UI label)\n"
        "- any word whose meaning is fully clear from context and "
        "doesn't risk being translated inconsistently\n\n"
        "Keep a word only if it names a specific concept of the "
        "product/domain that should read identically every time a "
        "user sees it.\n\n"
        "Respond with ONLY a JSON array of strings, using the exact "
        "words as given, nothing else. Example: "
        '["ejercicio", "sesion"]'
    )

    try:
        raw = ollama_chat(prompt, glossary_model)
        parsed = parse_json_response(raw)

        if not isinstance(parsed, list):
            raise ValueError("Expected a JSON array.")

        allowed = {w for w, _, _ in candidates}
        filtered = [w for w in parsed if isinstance(w, str) and w in allowed]

        return filtered

    except Exception as exc:
        print(
            f"    WARNING: glossary term filtering failed ({exc}); "
            "using the raw frequency list instead."
        )
        return [w for w, _, _ in candidates]


def _review_terms_checkbox(
    kept_terms: list[str],
    discarded: list[str],
) -> list[str] | None:
    """
    Checkbox-style review using the `questionary` library (arrow keys
    + space to toggle, enter to confirm). Returns None if the library
    isn't available or the terminal doesn't support it, so the caller
    can fall back to the plain numeric prompt.
    """
    try:
        import questionary
    except ImportError:
        return None

    choices = [
        questionary.Choice(title=term, checked=True) for term in kept_terms
    ] + [
        questionary.Choice(title=term, checked=False) for term in discarded
    ]

    if not choices:
        return kept_terms

    try:
        selected = questionary.checkbox(
            "Glossary terms (space to toggle, enter to confirm):",
            choices=choices,
        ).ask()
    except Exception:
        return None

    if selected is None:
        # User cancelled (Ctrl-C inside questionary): keep as-is.
        return kept_terms

    return selected


def review_terms_interactively(
    kept_terms: list[str],
    candidates: list[tuple[str, int, str]],
) -> list[str]:
    """
    Let the user review the model-filtered term list: untick entries
    that don't belong, tick back words the model dropped, and
    optionally type in extra words it missed entirely.
    """
    discarded = [w for w, _, _ in candidates if w not in kept_terms]

    selected = _review_terms_checkbox(kept_terms, discarded)

    if selected is None:
        print(
            "    (Tip: `pip install questionary` for an arrow-keys + "
            "space checkbox selector here.)"
        )
        print("\n    Glossary term review:")
        for i, term in enumerate(kept_terms, start=1):
            print(f"        {i:>3}. {term}")

        if discarded:
            preview = ", ".join(discarded[:25])
            more = "..." if len(discarded) > 25 else ""
            print(f"    Discarded by the filter model: {preview}{more}")

        try:
            remove_input = input(
                "    Numbers to REMOVE (comma-separated), or Enter to keep all: "
            ).strip()
        except EOFError:
            # Non-interactive environment (e.g. piped input): keep as-is.
            return kept_terms

        selected = kept_terms
        if remove_input:
            to_remove = set()
            for chunk in remove_input.split(","):
                chunk = chunk.strip()
                if chunk.isdigit():
                    idx = int(chunk) - 1
                    if 0 <= idx < len(kept_terms):
                        to_remove.add(idx)
            selected = [t for i, t in enumerate(kept_terms) if i not in to_remove]

    try:
        add_input = input(
            "    Extra words to ADD (comma-separated, or Enter to skip): "
        ).strip()
    except EOFError:
        add_input = ""

    if add_input:
        for word in add_input.split(","):
            word = word.strip()
            if word and word not in selected:
                selected.append(word)

    print(f"    Final glossary terms ({len(selected)}): {selected}\n")

    return selected


def translate_glossary(
    terms: list[str],
    source_lang: str,
    target_lang: str,
    model: str,
    chunk_size: int = 20,
    context: str | None = None,
) -> dict[str, str]:
    """
    Translate the glossary terms together (in chunks) so translations
    stay consistent with each other, returning term -> translation.
    """
    glossary: dict[str, str] = {}

    if not terms:
        return glossary

    context_line = f"\nContext about this document: {context}.\n" if context else ""

    chunks = [
        terms[start:start + chunk_size]
        for start in range(0, len(terms), chunk_size)
    ]

    for i, chunk in enumerate(chunks, start=1):
        print(
            f"    Translating chunk {i}/{len(chunks)} "
            f"({len(chunk)} terms) with {model}..."
        )

        prompt = (
            f"Translate the following {source_lang} terms into "
            f"{target_lang}. These are recurring terms from the same "
            "software UI, so translate each one the way you would "
            "want it used consistently everywhere it appears."
            f"{context_line}"
            "\nTerms:\n"
            + "\n".join(f"- {term}" for term in chunk)
            + "\n\nRespond with ONLY a JSON object mapping each "
            f"{source_lang} term to its {target_lang} translation, "
            "nothing else. Example: "
            '{"ejercicio": "..." , "sesion": "..."}'
        )

        try:
            raw = ollama_chat(prompt, model)
            parsed = parse_json_response(raw)

            if not isinstance(parsed, dict):
                raise ValueError("Expected a JSON object.")

            translated_in_chunk = 0

            for term in chunk:
                if term in parsed and isinstance(parsed[term], str):
                    glossary[term] = parsed[term].strip()
                    translated_in_chunk += 1

            print(f"        → {translated_in_chunk}/{len(chunk)} translated")

        except Exception as exc:
            print(
                f"        WARNING: could not translate this chunk: {exc}"
            )

    return glossary


def build_or_load_glossary(
    segments,
    source_lang: str,
    target_lang: str,
    model: str,
    glossary_model: str,
    glossary_path: Path,
    min_count: int,
    top_n: int,
    rebuild: bool,
    context: str | None = None,
    interactive: bool = False,
) -> dict[str, str]:
    if glossary_path.exists() and not rebuild:
        print(f"Loading existing glossary: {glossary_path}")
        try:
            with glossary_path.open("r", encoding="utf-8") as fh:
                glossary = json.load(fh)
            print(f"    {len(glossary)} terms loaded.")
            return glossary
        except (OSError, ValueError) as exc:
            print(f"    WARNING: could not load glossary ({exc}); rebuilding.")

    print("Building glossary...")
    print(f"    Translation model: {model}")
    print(f"    Glossary (filtering) model: {glossary_model}")
    if context:
        print(f"    Context: {context}")
    start_time = time.time()

    print(
        f"    [1/4] Scanning {len(segments)} segments for frequent "
        f"words (min. {min_count} occurrences, top {top_n})..."
    )
    candidates = extract_candidate_terms(
        segments, source_lang, min_count=min_count, top_n=top_n
    )
    if candidates:
        preview = ", ".join(w for w, _, _ in candidates[:10])
        print(
            f"        → {len(candidates)} candidates found "
            f"(top: {preview}{'...' if len(candidates) > 10 else ''})"
        )
    else:
        print("        → no candidates found.")

    print(
        f"    [2/4] Filtering candidates with {glossary_model} "
        "(keeping only real terminology)..."
    )
    terms = filter_terms_with_model(
        candidates, source_lang, glossary_model, context=context
    )
    print(f"        → {len(terms)} terms kept: {terms}")

    if interactive:
        print("    [3/4] Manual review...")
        terms = review_terms_interactively(terms, candidates)
    else:
        print("    [3/4] Manual review skipped (--no-glossary-interactive).")

    print(
        f"    [4/4] Translating {len(terms)} terms with {model} "
        "(all together, for consistency)..."
    )
    glossary = translate_glossary(
        terms, source_lang, target_lang, model, context=context
    )

    elapsed = time.time() - start_time
    print(
        f"    Done: {len(glossary)} glossary terms in {elapsed:.1f}s."
    )

    try:
        with glossary_path.open("w", encoding="utf-8") as fh:
            json.dump(glossary, fh, ensure_ascii=False, indent=2, sort_keys=True)
        print(f"    Saved glossary: {glossary_path}")
    except OSError as exc:
        print(f"    WARNING: could not save glossary ({exc})")

    return glossary


def glossary_terms_for_text(
    glossary: dict[str, str],
    text: str,
    max_terms: int = 12,
) -> list[tuple[str, str]]:
    """Glossary entries whose source term appears in this segment's text."""
    text_lower = text.lower()
    matches = [
        (term, translation)
        for term, translation in glossary.items()
        if term.lower() in text_lower
    ]
    return matches[:max_terms]
