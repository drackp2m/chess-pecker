from __future__ import annotations

import platform
import sys

CONTAINER_HINT = (
    "The translator runs on the host (macOS, Apple Silicon), never "
    "inside the devcontainer: MLX needs Metal, which the container has "
    "no access to. Run `pnpm i18n:export` inside the container, then "
    "this command outside it — the repo is bind-mounted, so both sides "
    "see translations/."
)


class HostUnsupportedError(RuntimeError):
    pass


def is_apple_silicon() -> bool:
    return sys.platform == "darwin" and platform.machine() == "arm64"


def require_mlx_runtime() -> None:
    if not is_apple_silicon():
        raise HostUnsupportedError(
            "MLX needs macOS on Apple Silicon, found "
            f"{sys.platform}/{platform.machine()}.\n{CONTAINER_HINT}"
        )

    try:
        import mlx.core as mx
    except ImportError as exc:
        raise HostUnsupportedError(
            f"Could not import mlx ({exc}).\n{CONTAINER_HINT}\n"
            "On the host, `uv sync` inside tools/scripts/i18n/translate "
            "installs it."
        ) from exc

    try:
        gpu_available = mx.metal.is_available()
    except AttributeError:
        gpu_available = True

    if not gpu_available:
        raise HostUnsupportedError(
            f"MLX imported but no Metal GPU is available.\n{CONTAINER_HINT}"
        )
