#!/usr/bin/env bash
set -e

# =============================================
# Open WebUI 部署脚本（Screen 模式）
# =============================================
# 使用说明：
# 1. 修改下方的 PROJECT_DIR 为你服务器上的实际路径
# 2. 确保已安装 Python 3.11/3.12、Node.js (18-22)、npm、screen
# 3. chmod +x deploy.sh && ./deploy.sh
# =============================================

PROJECT_DIR="/home/nss-marker/open-webui"   # <-- 改成你的实际部署路径
SCREEN_NAME="open-webui"
PORT="8080"
HOST="0.0.0.0"

# 可选环境变量（按需修改）
export OLLAMA_BASE_URL="http://localhost:11434"
# export OPENAI_API_BASE_URL=""
# export OPENAI_API_KEY=""

# --------------- 以下通常无需修改 ---------------

echo "[1/6] 进入项目目录: $PROJECT_DIR"
cd "$PROJECT_DIR"

echo "[2/6] 检查环境..."
python3 --version || { echo "未找到 python3"; exit 1; }
node --version   || { echo "未找到 node"; exit 1; }
npm --version    || { echo "未找到 npm"; exit 1; }
screen --version || { echo "未找到 screen"; exit 1; }

echo "[3/6] 创建/激活 Python 虚拟环境..."
if [ ! -d "$PROJECT_DIR/.venv" ]; then
    python3 -m venv "$PROJECT_DIR/.venv"
fi
source "$PROJECT_DIR/.venv/bin/activate"

echo "[4/6] 安装 Python 依赖..."
pip install --upgrade pip
pip install -r "$PROJECT_DIR/backend/requirements.txt"

echo "[5/6] 安装前端依赖并构建..."
cd "$PROJECT_DIR"
npm install
npm run build

echo "[5.5/6] 将前端构建产物同步到后端 static 目录..."
# 后端默认从 backend/open_webui/static 加载前端文件
if [ -d "$PROJECT_DIR/build" ]; then
    rm -rf "$PROJECT_DIR/backend/open_webui/static"
    cp -r "$PROJECT_DIR/build" "$PROJECT_DIR/backend/open_webui/static"
    echo "已复制 build -> backend/open_webui/static"
else
    echo "警告: build 目录不存在，请检查前端构建是否成功"
    exit 1
fi

echo "[6/6] 启动 screen 会话: $SCREEN_NAME"
# 如果已存在同名 screen，先杀掉
if screen -list | grep -q "$SCREEN_NAME"; then
    echo "检测到已存在的 screen 会话，先停止..."
    screen -S "$SCREEN_NAME" -X quit 2>/dev/null || true
    sleep 1
fi

# 在 screen 中启动后端
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
    echo "=============================================="
    echo "部署成功！"
    echo "Screen 会话名: $SCREEN_NAME"
    echo "访问地址: http://$HOST:$PORT"
    echo ""
    echo "常用命令:"
    echo "  查看日志:  screen -r $SCREEN_NAME"
    echo "   detach:  Ctrl+A, D"
    echo "  停止服务:  ./stop-screen.sh"
    echo "=============================================="
else
    echo "启动失败，请检查日志"
    exit 1
fi
