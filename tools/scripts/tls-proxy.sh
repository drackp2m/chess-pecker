#!/bin/sh

REPO_ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
CERT="$REPO_ROOT/.cert/cert.pem"
KEY="$REPO_ROOT/.cert/key.pem"
SOURCE_PORT=""
TARGET_PORT=""
BIND_HOST=0.0.0.0

usage() {
  echo "Usage: sh tools/scripts/tls-proxy.sh --source <port> --target <port> [--hostname <bind-host>]"
  echo ""
  echo "  --source     port to listen on over HTTPS"
  echo "  --target     port of the plain HTTP server to forward to, on 127.0.0.1"
  echo "  --hostname   interface to bind (default 0.0.0.0, so .local and LAN IPs reach it)"
  echo ""
  echo "TLS is terminated with the mkcert pair in .cert and forwarded as HTTP/1.1,"
  echo "which is what Safari needs when the server behind speaks HTTP/2."
  exit 1
}

while [ $# -gt 0 ]; do
  case "$1" in
    --source) SOURCE_PORT="$2"; shift 2 || usage ;;
    --target) TARGET_PORT="$2"; shift 2 || usage ;;
    --hostname) BIND_HOST="$2"; shift 2 || usage ;;
    -h | --help) usage ;;
    *) echo "❌ Unknown option: $1" && usage ;;
  esac
done

if [ -z "$SOURCE_PORT" ] || [ -z "$TARGET_PORT" ]; then
  echo "❌ Both --source and --target are required."
  usage
fi

if [ ! -f "$CERT" ] || [ ! -f "$KEY" ]; then
  echo "❌ Missing certificate ($CERT / $KEY). Generate it with mkcert first."
  exit 1
fi

PROXY_BIN=$(command -v local-ssl-proxy 2> /dev/null)

if [ -z "$PROXY_BIN" ]; then
  PROXY_BIN="$REPO_ROOT/apps/web/node_modules/.bin/local-ssl-proxy"
fi

if [ ! -x "$PROXY_BIN" ]; then
  PROXY_BIN="$REPO_ROOT/node_modules/.bin/local-ssl-proxy"
fi

if [ ! -x "$PROXY_BIN" ]; then
  echo "❌ local-ssl-proxy not found. Run pnpm install first."
  exit 1
fi

echo "🔐 Terminating TLS on $BIND_HOST:$SOURCE_PORT → 127.0.0.1:$TARGET_PORT..."

exec "$PROXY_BIN" \
  --source "$SOURCE_PORT" \
  --target "$TARGET_PORT" \
  --hostname "$BIND_HOST" \
  --cert "$CERT" \
  --key "$KEY"
