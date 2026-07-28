#!/bin/sh

REPO_ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
CERT="$REPO_ROOT/.cert/cert.pem"
KEY="$REPO_ROOT/.cert/key.pem"
BASE_HREF="/chesspecker/"
SERVE_DIR="dist/pwa"
APP_PORT=4201
PROXY_PORT=4200

cleanup() {
  trap - INT TERM EXIT
  echo ""
  echo "🛑 Stopping build watcher, static server and TLS proxy..."
  kill $BUILD_PID $SERVER_PID $PROXY_PID 2>/dev/null
}
trap cleanup INT TERM EXIT

if [ ! -f "$CERT" ] || [ ! -f "$KEY" ]; then
  echo "❌ Missing certificate ($CERT / $KEY). Generate it with mkcert first."
  exit 1
fi

echo "🔗 Linking $SERVE_DIR/chesspecker → dist/chesspecker/browser..."
mkdir -p "$SERVE_DIR"
ln -sfn "../chesspecker/browser" "$SERVE_DIR/chesspecker"

echo "🏗️ Building PWA in watch mode (base-href $BASE_HREF)..."
ng build --watch --base-href "$BASE_HREF" &
BUILD_PID=$!

echo "📂 Serving $SERVE_DIR over plain HTTP on port $APP_PORT..."
http-server "$SERVE_DIR" -p "$APP_PORT" -c-1 &
SERVER_PID=$!

echo "🔐 Terminating TLS with local-ssl-proxy on port $PROXY_PORT..."
local-ssl-proxy --source "$PROXY_PORT" --target "$APP_PORT" --hostname 0.0.0.0 --cert "$CERT" --key "$KEY" &
PROXY_PID=$!

echo "🚀 Ready → https://MarcBook-Air.local:$PROXY_PORT$BASE_HREF"

wait
