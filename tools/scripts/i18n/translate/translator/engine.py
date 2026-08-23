from __future__ import annotations

import inspect
import sys
import time
from dataclasses import dataclass

from .environment import require_mlx_runtime
from .models import repo_for, thinks
from .ollama_client import DEFAULT_MODEL as DEFAULT_OLLAMA_MODEL
from .ollama_client import ollama_chat_messages
from .validate import cut_at_stop

MIN_SHARED_TOKENS = 16
NO_THINK = "/no_think"
NO_TRIM = (
    "  This model keeps a recurrent cache that cannot be trimmed, so the shared "
    "prompt is read again on every call. Expect a high 'prompt tokens/call'."
)


@dataclass
class Usage:
    calls: int = 0
    prompt_tokens: int = 0
    generation_tokens: int = 0
    seconds: float = 0.0

    def record(self, prompt_tokens: int, generation_tokens: int, seconds: float) -> None:
        self.calls += 1
        self.prompt_tokens += prompt_tokens
        self.generation_tokens += generation_tokens
        self.seconds += seconds

    @property
    def tokens_per_second(self) -> float:
        return self.generation_tokens / self.seconds if self.seconds else 0.0


# The structured content TranslateGemma's template wants means nothing to a
# plain chat endpoint, so it gets the same wrapper the template would emit.
def flatten(messages: list[dict]) -> list[dict]:
    flattened = []

    for message in messages:
        content = message["content"]

        if isinstance(content, list):
            for part in content:
                source, target = part["source_lang_code"], part["target_lang_code"]
                content = (
                    f"Produce only the {target} translation, without any additional "
                    f"explanations or commentary. Please translate the following {source} "
                    f"text into {target}:\n\n\n{part['text']}"
                )

        flattened.append({"role": message["role"], "content": content})

    return flattened


def merge_system(messages: list[dict]) -> list[dict]:
    if len(messages) < 2 or messages[0]["role"] != "system":
        return messages

    head, following = messages[0], messages[1]

    if not isinstance(head["content"], str) or not isinstance(following["content"], str):
        return messages

    merged = f"{head['content']}\n\n{following['content']}"

    return [{"role": following["role"], "content": merged}, *messages[2:]]


def angled(text: str) -> bool:
    return "<" in text or ">" in text


def quieted(messages: list[dict]) -> list[dict]:
    quiet = list(messages)

    for index in reversed(range(len(quiet))):
        content = quiet[index]["content"]

        if quiet[index]["role"] == "user" and isinstance(content, str):
            quiet[index] = {"role": "user", "content": f"{content}\n\n{NO_THINK}"}
            break

    return quiet


def common_prefix(left: list[int], right: list[int]) -> int:
    shared = 0

    for first, second in zip(left, right):
        if first != second:
            break

        shared += 1

    return shared


class OllamaEngine:
    name = "ollama"

    def __init__(self, model: str | None = None, temperature: float = 0.0) -> None:
        self.model = model or DEFAULT_OLLAMA_MODEL
        self.temperature = temperature
        self.usage = Usage()
        self.load_seconds = 0.0

    def load(self) -> "OllamaEngine":
        return self

    def count_tokens(self, text: str) -> int:
        return max(1, len(text) // 3)

    def start_block(self) -> None:
        return None

    def generate(self, messages: list[dict], max_tokens: int) -> str:
        messages = flatten(messages)
        started = time.perf_counter()
        text = ollama_chat_messages(
            messages,
            self.model,
            options={"temperature": self.temperature, "num_predict": max_tokens},
        )
        elapsed = time.perf_counter() - started

        sent = "".join(str(message["content"]) for message in messages)
        self.usage.record(self.count_tokens(sent), self.count_tokens(text), elapsed)

        return text


class MlxEngine:
    name = "mlx"

    def __init__(self, model: str | None = None, temperature: float = 0.0) -> None:
        self.model = repo_for(model)
        self.temperature = temperature
        self.usage = Usage()
        self.load_seconds = 0.0
        self._model = None
        self._tokenizer = None
        self._cache = None
        self._prompt = []
        self._system_role = True
        self._extra = {"enable_thinking": False}
        self._no_think = thinks(self.model)
        self._said: set[str] = set()

    def load(self) -> "MlxEngine":
        require_mlx_runtime()

        from mlx_lm import load

        started = time.perf_counter()
        self._model, self._tokenizer = load(self.model)
        self.load_seconds = time.perf_counter() - started

        return self

    def count_tokens(self, text: str) -> int:
        return len(self._tokenizer.encode(text))

    def start_block(self) -> None:
        self._cache = None
        self._prompt = []

    # A hybrid Qwen3 reasons unless it is told twice not to: the template flag
    # is the clean way, the /no_think switch the one that survives an older
    # chat template shipped with the conversion.
    def _apply(self, messages: list[dict]) -> list[int]:
        try:
            return list(
                self._tokenizer.apply_chat_template(
                    messages, add_generation_prompt=True, **self._extra
                )
            )
        except TypeError:
            if not self._extra:
                raise

            self._extra = {}

            return self._apply(messages)

    # Gemma's chat template rejects a system role outright. Falling back to a
    # single user turn keeps the prefix cache working: the system text is still
    # the head of the prompt, which is all the cache cares about.
    def _tokens(self, messages: list[dict]) -> list[int]:
        wanted = messages if self._system_role else merge_system(messages)

        try:
            return self._apply(quieted(wanted) if self._no_think else wanted)
        except Exception as exc:
            if not self._system_role or merge_system(messages) == messages:
                raise RuntimeError(
                    f"{self.model} rejected the prompt ({exc}). A translation-only "
                    "model needs --profile translate; check --dry-run to see what is sent."
                ) from exc

            self._system_role = False

            return self._tokens(messages)

    def _cache_length(self) -> int:
        if not self._cache:
            return -1

        offset = getattr(self._cache[0], "offset", None)

        return -1 if offset is None else int(offset)

    def _notice(self, text: str) -> None:
        if text in self._said:
            return

        self._said.add(text)
        print(text, file=sys.stderr, flush=True)

    def _trim(self, count: int) -> bool:
        if count <= 0:
            return True

        from mlx_lm.models.cache import can_trim_prompt_cache, trim_prompt_cache

        if not can_trim_prompt_cache(self._cache):
            self._notice(NO_TRIM)

            return False

        return trim_prompt_cache(self._cache, count) == count

    # The cache holds the previous prompt plus whatever was generated from it.
    # Its own offset is the authority on how long it is; trimming back to the
    # prefix this prompt shares with the last one is what turns a whole scope's
    # context into something processed once instead of once per unit.
    def _prepare(self, tokens: list[int]) -> int:
        shared = min(common_prefix(self._prompt, tokens), len(tokens) - 1)
        length = self._cache_length()

        if shared >= MIN_SHARED_TOKENS and length >= shared:
            if self._trim(length - shared):
                return shared

        from mlx_lm.models.cache import make_prompt_cache

        self._cache = make_prompt_cache(self._model)

        return 0

    def _stream(self, tokens: list[int], max_tokens: int):
        from mlx_lm import stream_generate

        kwargs = {"max_tokens": max_tokens, "prompt_cache": self._cache}
        parameters = inspect.signature(stream_generate).parameters

        if "sampler" in parameters:
            from mlx_lm.sample_utils import make_sampler

            kwargs["sampler"] = make_sampler(temp=self.temperature)
        elif "temp" in parameters:
            kwargs["temp"] = self.temperature

        return stream_generate(self._model, self._tokenizer, tokens, **kwargs)

    def generate(self, messages: list[dict], max_tokens: int) -> str:
        tokens = self._tokens(messages)
        shared = self._prepare(tokens)
        fed = tokens[shared:]
        pieces = []
        produced = 0
        started = time.perf_counter()

        for response in self._stream(fed, max_tokens):
            pieces.append(response.text)
            produced += 1

            if angled(response.text) and cut_at_stop("".join(pieces))[1]:
                break

        elapsed = time.perf_counter() - started
        self._prompt = tokens

        self.usage.record(len(fed), produced, elapsed)

        return cut_at_stop("".join(pieces))[0].strip()


def build_engine(backend: str, model: str | None, temperature: float = 0.0):
    if backend == "mlx":
        return MlxEngine(model, temperature)

    return OllamaEngine(model, temperature)
