#!/usr/bin/env bash
set -euo pipefail
PORT=58050
LOG=/tmp/lintai_ui_test.log

echo "🚀  starting server on :$PORT …"
uvicorn lintai.ui.server:app --port $PORT --log-level warning >"$LOG" 2>&1 &
PID=$!

# ---- wait until /api/health is ready (max 5 s) ----
for i in {1..50}; do
  if curl -sf http://localhost:$PORT/api/health >/dev/null; then break; fi
  sleep 0.1
done

echo "✅  server up, running checks …"

curl -sf http://localhost:$PORT/api/health | jq .
curl -sf http://localhost:$PORT/api/fs | jq .
curl -sf -X POST http://localhost:$PORT/api/config \
     -H 'Content-Type: application/json' \
     -d '{"source_path":".","ai_call_depth":1,"log_level":"INFO"}' | jq .

echo "🎉  all curls succeeded"

kill $PID
wait $PID 2>/dev/null || true
