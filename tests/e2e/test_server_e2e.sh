#!/usr/bin/env bash
set -uo pipefail
PORT=58050
LOG=/tmp/lintai_ui_test.log

# Kill on any exit
cleanup() {
  if [[ -n "${PID:-}" ]]; then
    kill $PID 2>/dev/null || true
    wait $PID 2>/dev/null || true
  fi
}
trap cleanup EXIT

# Check if port is already in use
if lsof -i tcp:$PORT >/dev/null; then
  PID_IN_USE=$(lsof -t -i tcp:$PORT)
  echo "❌ Port $PORT is already in use by PID $PID_IN_USE. Aborting!"
  exit 1
fi

echo "🚀  starting server on :$PORT …"
uvicorn lintai.ui.server:app --port $PORT --log-level warning >"$LOG" 2>&1 &
PID=$!

# Wait a moment and check if server died
sleep 0.5
if ! ps -p $PID >/dev/null; then
  echo "❌ Failed to start server. Log output:"
  cat "$LOG"
  exit 1
fi

# ---- wait until /api/health is ready (max 5 s) ----
for i in {1..50}; do
  if curl -sf http://localhost:$PORT/api/health >/dev/null; then break; fi
  sleep 0.1
done

echo "✅  server up, running checks …"

run_check() {
  local desc=$1
  local expect_ok=$2
  shift 2

  echo "🔍 $desc"
  RESPONSE=$("$@" 2>&1)
  STATUS=$?

  if [ $STATUS -ne 0 ]; then
    echo "❌ $desc failed with curl error:"
    echo "$RESPONSE"
    exit 1
  fi

  if echo "$RESPONSE" | jq -e 'has("detail")' >/dev/null; then
    echo "❌ $desc failed with API error:"
    echo "$RESPONSE" | jq .
    exit 1
  fi

  if [ "$expect_ok" = true ] && ! echo "$RESPONSE" | jq -e '.status == "ok"' >/dev/null; then
    echo "❌ $desc failed: status is not ok"
    echo "$RESPONSE" | jq .
    exit 1
  fi

  echo "$RESPONSE" | jq . || echo "$RESPONSE"
}

run_check "Health check" true curl -s http://localhost:$PORT/api/health
run_check "List directory (/api/fs)" false curl -s http://localhost:$PORT/api/fs
run_check "Post config (/api/config)" false curl -s -X POST \
     http://localhost:$PORT/api/config \
     -H 'Content-Type: application/json' \
     -d '{"source_path":".","ai_call_depth":1,"log_level":"INFO"}'

echo "🎉  All curl checks succeeded"
