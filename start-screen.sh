#!/usr/bin/env bash
set -euo pipefail

# Start Open WebUI inside a screen session.
# Optional overrides:
#   PROJECT_DIR=/path/to/open-webui PORT=18080 HOST=0.0.0.0 ./start-screen.sh

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="${PROJECT_DIR:-$SCRIPT_DIR}"

load_env_file() {
    if [ -f "$PROJECT_DIR/.env" ]; then
        echo "Loading environment variables from $PROJECT_DIR/.env"
        set -a
        # shellcheck disable=SC1091
        source "$PROJECT_DIR/.env"
        set +a
    fi
}

load_env_file

SCREEN_NAME="${SCREEN_NAME:-open-webui}"
PORT="${PORT:-18080}"
HOST="${HOST:-0.0.0.0}"
FRONTEND_BUILD_DIR="${FRONTEND_BUILD_DIR:-$PROJECT_DIR/build}"

export OLLAMA_BASE_URL="${OLLAMA_BASE_URL:-http://localhost:11434}"

screen_exists() {
    screen -list | grep -q "[.]${SCREEN_NAME}[[:space:]]"
}

cd "$PROJECT_DIR"

if [ ! -d "$PROJECT_DIR/.venv" ]; then
    echo "Virtual environment not found at $PROJECT_DIR/.venv. Run ./deploy.sh first."
    exit 1
fi

if [ ! -f "$FRONTEND_BUILD_DIR/index.html" ]; then
    echo "Frontend build not found at $FRONTEND_BUILD_DIR. Run ./deploy.sh first."
    exit 1
fi

if screen_exists; then
    echo "Stopping existing screen session: $SCREEN_NAME"
    screen -S "$SCREEN_NAME" -X quit 2>/dev/null || true
    sleep 1
fi

echo "Starting screen session: $SCREEN_NAME"
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
    echo "Started successfully: http://$HOST:$PORT"
    echo "Attach logs: screen -r $SCREEN_NAME"
else
    echo "Startup failed"
    exit 1
fi
