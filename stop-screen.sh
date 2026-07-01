#!/usr/bin/env bash
set -euo pipefail

# Stop the Open WebUI screen session.

SCREEN_NAME="${SCREEN_NAME:-open-webui}"

if screen -list | grep -q "[.]${SCREEN_NAME}[[:space:]]"; then
    echo "Stopping screen session: $SCREEN_NAME"
    screen -S "$SCREEN_NAME" -X quit 2>/dev/null || true
    sleep 1
    echo "Stopped"
else
    echo "Screen session not found: $SCREEN_NAME"
fi
