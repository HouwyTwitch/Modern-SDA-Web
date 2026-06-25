#!/usr/bin/env bash
# Modern SDA Web - macOS/Linux launcher.
set -e
cd "$(dirname "$0")"

if command -v python3 >/dev/null 2>&1; then
  PY=python3
elif command -v python >/dev/null 2>&1; then
  PY=python
else
  echo
  echo "  Python 3.10+ is required but was not found."
  echo "  Install it from https://www.python.org/downloads/ (or your package manager)."
  echo
  exit 1
fi

exec "$PY" scripts/launch.py "$@"
