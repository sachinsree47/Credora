#!/usr/bin/env bash
# Starts Credora at http://localhost:8000 (macOS / Linux)
set -e
cd "$(dirname "$0")/backend"
[ -d .venv ] || python3 -m venv .venv
source .venv/bin/activate
pip install -q -r requirements.txt
uvicorn app.main:app --port 8000
