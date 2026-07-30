#!/bin/sh

REPO_ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
SOURCE_PORT=""
TARGET_PORT=""
URL_HOST=localhost
ENV_ASSIGNMENTS=""

usage() {
  echo "Usage: sh tools/scripts/start-safari.sh --source <port> [--target <port>] [--host <name>] [--env KEY=VALUE]... -- <command> [args...]"
  echo ""
  echo "  --source   port exposed over HTTPS by the TLS proxy"
  echo "  --target   port the command listens on, in plain HTTP (default: source + 1)"
  echo "  --host     host name used only for the URL printed on start (default: localhost)"
  echo "  --env      variable set for the command only; repeat the flag for more than one"
  echo ""
  echo "Runs <command> over plain HTTP with tools/scripts/tls-proxy.sh in front of it, so"
  echo "Safari is answered in HTTP/1.1 over TLS instead of the server's own HTTP/2."
  echo ""
  echo "Examples:"
  echo "  … --source 4200 -- ng serve --host 0.0.0.0 --port 4201 --ssl=false"
  echo "  … --source 3000 --env API_PROTOCOL=http --env API_PORT=3001 -- nest start --watch"
  exit 1
}

while [ $# -gt 0 ]; do
  case "$1" in
    --source) SOURCE_PORT="$2"; shift 2 || usage ;;
    --target) TARGET_PORT="$2"; shift 2 || usage ;;
    --host) URL_HOST="$2"; shift 2 || usage ;;
    --env) ENV_ASSIGNMENTS="$ENV_ASSIGNMENTS $2"; shift 2 || usage ;;
    -h | --help) usage ;;
    --) shift && break ;;
    *) echo "❌ Unknown option: $1" && usage ;;
  esac
done

if [ -z "$SOURCE_PORT" ]; then
  echo "❌ --source is required."
  usage
fi

if [ $# -eq 0 ]; then
  echo "❌ A command is required after --."
  usage
fi

if [ -z "$TARGET_PORT" ]; then
  TARGET_PORT=$((SOURCE_PORT + 1))
fi

cleanup() {
  trap - INT TERM EXIT
  echo ""
  echo "🛑 Stopping the server and the TLS proxy..."
  kill $COMMAND_PID $PROXY_PID 2>/dev/null
}
trap cleanup INT TERM EXIT

sh "$REPO_ROOT/tools/scripts/tls-proxy.sh" --source "$SOURCE_PORT" --target "$TARGET_PORT" &
PROXY_PID=$!

echo "🏃 Starting \`$*\` over plain HTTP on port $TARGET_PORT..."
# shellcheck disable=SC2086
env $ENV_ASSIGNMENTS "$@" &
COMMAND_PID=$!

echo "🚀 Ready → https://$URL_HOST:$SOURCE_PORT"

wait
