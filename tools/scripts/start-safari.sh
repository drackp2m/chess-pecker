#!/bin/sh

CERT=".cert/cert.pem"
KEY=".cert/key.pem"
APP_PORT=4201
PROXY_PORT=4200

cleanup() {
  trap - INT TERM EXIT
  echo ""
  echo "🛑 Stopping dev server and TLS proxy..."
  kill $NG_PID $PROXY_PID 2>/dev/null
}
trap cleanup INT TERM EXIT

if [ ! -f "$CERT" ] || [ ! -f "$KEY" ]; then
  echo "❌ Missing certificate ($CERT / $KEY). Generate it with mkcert first."
  exit 1
fi

echo "🅰️ Starting Angular dev server (HMR) over plain HTTP on port $APP_PORT..."
ng serve --host 0.0.0.0 --port "$APP_PORT" --ssl=false &
NG_PID=$!

echo "🔐 Terminating TLS with local-ssl-proxy on port $PROXY_PORT..."
local-ssl-proxy --source "$PROXY_PORT" --target "$APP_PORT" --hostname 0.0.0.0 --cert "$CERT" --key "$KEY" &
PROXY_PID=$!

echo "🚀 Ready → https://MarcBook-Air.local:$PROXY_PORT"

wait
