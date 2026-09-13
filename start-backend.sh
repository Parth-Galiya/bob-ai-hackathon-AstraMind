#!/usr/bin/env bash
# PortFlow AI – Start Backend (bash/macOS/Linux)
set -e
cd "$(dirname "$0")/backend"

if [ ! -d ".venv" ]; then
  echo "Creating virtual environment..."
  python3 -m venv .venv
fi

source .venv/bin/activate
echo "Installing dependencies..."
pip install -r requirements.txt -q

echo ""
echo "========================================"
echo "  PortFlow AI Backend starting..."
echo "  API:  http://localhost:8000"
echo "  Docs: http://localhost:8000/docs"
echo "========================================"
echo ""

uvicorn main:app --host 0.0.0.0 --port 8000 --reload
