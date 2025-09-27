#!/usr/bin/env bash
set -e

echo "[backend] Waiting for database..."
python - <<'PY'
import os, time, psycopg
from urllib.parse import urlparse
url = os.environ.get("DATABASE_URL")
if not url:
    print("No DATABASE_URL set; skipping wait.")
    raise SystemExit
p = urlparse(url)
for i in range(30):
    try:
        psycopg.connect(
            dbname=p.path.lstrip('/'),
            user=p.username,
            password=p.password,
            host=p.hostname,
            port=p.port or 5432,
            connect_timeout=3
        ).close()
        print("Database reachable.")
        break
    except Exception as e:
        print(f"DB not ready ({e}); retry {i+1}/30")
        time.sleep(1)
else:
    print("Database not reachable, exiting.")
    raise SystemExit(1)
PY

echo "[backend] Applying migrations..."
python backend/manage.py migrate --noinput || { echo "Migration failed"; exit 1; }

PORT="${PORT:-8000}"
echo "[backend] Starting Uvicorn on 0.0.0.0:${PORT}..."
exec uvicorn backend.asgi:application --host 0.0.0.0 --port "${PORT}"
