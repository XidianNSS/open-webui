#!/usr/bin/env bash
set -e

# =============================================
# Open WebUI Screen 启动脚本
# =============================================
# 用法: ./start-screen.sh
# =============================================

PROJECT_DIR="/home/nss-marker/open-webui"   # <-- 改成你的实际部署路径
SCREEN_NAME="open-webui"
PORT="8080"
HOST="0.0.0.0"

export OLLAMA_BASE_URL="http://localhost:11434"
# export OPENAI_API_BASE_URL=""
# export OPENAI_API_KEY=""

cd "$PROJECT_DIR"
source "$PROJECT_DIR/.venv/bin/activate"

# 如果已存在同名 screen，先杀掉
if screen -list | grep -q "$SCREEN_NAME"; then
    echo "停止已存在的 screen 会话: $SCREEN_NAME"
    screen -S "$SCREEN_NAME" -X quit 2>/dev/null || true
    sleep 1
fi

echo "启动 screen 会话: $SCREEN_NAME"
screen -dmS "$SCREEN_NAME" bash -c "
    cd $PROJECT_DIR/backend
    source $PROJECT_DIR/.venv/bin/activate
    export PORT=$PORT
    export HOST=$HOST
    export OLLAMA_BASE_URL=$OLLAMA_BASE_URL
    ./start.sh
"

sleep 2
if screen -list | grep -q "$SCREEN_NAME"; then
    echo "启动成功！访问: http://$HOST:$PORT"
    echo "查看日志: screen -r $SCREEN_NAME"
else
    echo "启动失败"
    exit 1
fi
