#!/usr/bin/env bash
set -euo pipefail

# Open WebUI deployment script for a screen-based Linux deployment.
# Usage:
#   chmod +x deploy.sh start-screen.sh stop-screen.sh
#   ./deploy.sh
#
# Optional overrides:
#   PROJECT_DIR=/path/to/open-webui PORT=8080 HOST=0.0.0.0 ./deploy.sh

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="${PROJECT_DIR:-$SCRIPT_DIR}"
SCREEN_NAME="${SCREEN_NAME:-open-webui}"
PORT="${PORT:-8080}"
HOST="${HOST:-0.0.0.0}"
FRONTEND_BUILD_DIR="${FRONTEND_BUILD_DIR:-$PROJECT_DIR/build}"

# Optional environment variables. Export before running, or uncomment here.
export OLLAMA_BASE_URL="${OLLAMA_BASE_URL:-http://localhost:11434}"
# export OPENAI_API_BASE_URL=""
# export OPENAI_API_KEY=""

screen_exists() {
    screen -list | grep -q "[.]${SCREEN_NAME}[[:space:]]"
}

echo "[1/6] Entering project directory: $PROJECT_DIR"
cd "$PROJECT_DIR"

echo "[2/6] Checking required commands..."
command -v python3 >/dev/null || { echo "python3 was not found"; exit 1; }
command -v node >/dev/null || { echo "node was not found"; exit 1; }
command -v npm >/dev/null || { echo "npm was not found"; exit 1; }
command -v screen >/dev/null || { echo "screen was not found"; exit 1; }

python3 --version
node --version
npm --version
screen --version

echo "[3/6] Creating or activating Python virtual environment..."
if [ ! -d "$PROJECT_DIR/.venv" ]; then
    python3 -m venv "$PROJECT_DIR/.venv"
fi
source "$PROJECT_DIR/.venv/bin/activate"

echo "[4/6] Installing Python dependencies..."
python -m pip install --upgrade pip
python -m pip install -r "$PROJECT_DIR/backend/requirements.txt"

echo "[5/6] Installing frontend dependencies and building..."
npm install
npm run build

if [ ! -f "$FRONTEND_BUILD_DIR/index.html" ]; then
    echo "Frontend build was not found at: $FRONTEND_BUILD_DIR"
    exit 1
fi

echo "[6/6] Starting screen session: $SCREEN_NAME"
if screen_exists; then
    echo "Existing screen session detected, stopping it first..."
    screen -S "$SCREEN_NAME" -X quit 2>/dev/null || true
    sleep 1
fi

screen -dmS "$SCREEN_NAME" bash -lc "
    cd '$PROJECT_DIR/backend'
    source '$PROJECT_DIR/.venv/bin/activate'
    export PORT='$PORT'
    export HOST='$HOST'
    export FRONTEND_BUILD_DIR='$FRONTEND_BUILD_DIR'
    export OLLAMA_BASE_URL='$OLLAMA_BASE_URL'
    exec ./start.sh
"

sleep 2
if screen_exists; then
    echo "=============================================="
    echo "Deployment succeeded"
    echo "Screen session: $SCREEN_NAME"
    echo "Listen address: http://$HOST:$PORT"
    echo ""
    echo "Useful commands:"
    echo "  Attach logs:  screen -r $SCREEN_NAME"
    echo "  Detach:       Ctrl+A, D"
    echo "  Stop:         ./stop-screen.sh"
    echo "=============================================="
else
    echo "Startup failed. Attach or inspect screen logs for details."
    exit 1
fi
