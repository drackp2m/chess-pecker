from __future__ import annotations

from dataclasses import dataclass

from .validate import base_of


@dataclass(frozen=True)
class Plural:
    words: tuple[str, ...]
    grammar: str = ""


@dataclass(frozen=True)
class Gender:
    male: str
    female: str
    neutral: str
    slashed: str


PLURALS = {
    "ru": {
        "one": Plural(("1 яблоко", "купил 21 книгу"), "singular, en el caso que pida la frase"),
        "few": Plural(("2 яблока", "купил 3 книги"), "genitivo singular, también tras un verbo"),
        "many": Plural(("5 яблок", "купил 11 книг"), "genitivo plural, también tras un verbo"),
        "other": Plural(
            ("1,5 яблока", "купил 2,5 книги"), "genitivo singular, también tras un verbo"
        ),
    },
    "en": {
        "one": Plural(("1 apple", "1 book")),
        "other": Plural(("0 apples", "2 books")),
    },
    "fr": {
        "one": Plural(("0 pomme", "1 livre")),
        "other": Plural(("2 pommes", "5 livres")),
    },
    "ca": {
        "one": Plural(("1 poma", "1 llibre")),
        "other": Plural(("0 pomes", "2 llibres")),
    },
    "hi": {
        "one": Plural(("1 सेब", "1 किताब")),
        "other": Plural(("2 सेब", "5 किताबें")),
    },
}

GENDERS = {
    "ru": Gender(
        "Ты дочитал книгу", "Ты дочитала книгу", "Книга прочитана", "Ты дочитал(а) книгу"
    ),
    "fr": Gender("Tu es fatigué", "Tu es fatiguée", "Tu as besoin de repos", "Tu es fatigué(e)"),
    "ca": Gender("Estàs cansat", "Estàs cansada", "Necessites descansar", "Estàs cansat/da"),
}

TRACES = {
    "ru": ("яблок", "книг", "купил", "дочитал", "прочитан"),
    "en": ("apple", "book"),
    "fr": ("pomme", "livre", "fatigu", "repos"),
    "ca": ("poma", "pomes", "llibre", "cansat", "cansada", "descans"),
    "hi": ("सेब", "किताब"),
}


def plural_of(lang: str, key: str) -> Plural | None:
    return PLURALS.get(base_of(lang), {}).get(key)


def gender_of(lang: str) -> Gender | None:
    return GENDERS.get(base_of(lang))


def traces_of(lang: str) -> tuple[str, ...]:
    return TRACES.get(base_of(lang), ())
