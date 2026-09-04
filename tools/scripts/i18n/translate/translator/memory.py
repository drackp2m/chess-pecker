from __future__ import annotations


def normalise(text: str) -> str:
    return " ".join(str(text).split())


class TranslationMemory:
    def __init__(self, enabled: bool = True) -> None:
        self.enabled = enabled
        self.hits = 0
        self._entries: dict[tuple[str, str, str], str] = {}

    def _key(self, lang: str, source: str, form: str) -> tuple[str, str, str]:
        return (lang, form, normalise(source))

    def seed(self, lang: str, source: str, target: str, form: str) -> None:
        if not self.enabled or not normalise(source) or not normalise(target):
            return

        self._entries.setdefault(self._key(lang, source, form), target)

    def remember(self, lang: str, source: str, target: str, form: str) -> None:
        if not self.enabled or not normalise(target):
            return

        self._entries[self._key(lang, source, form)] = target

    def get(self, lang: str, source: str, form: str) -> str | None:
        if not self.enabled:
            return None

        found = self._entries.get(self._key(lang, source, form))

        if found is not None:
            self.hits += 1

        return found

    def __len__(self) -> int:
        return len(self._entries)
