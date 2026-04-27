#!/usr/bin/env bash

# =============================================
# Open WebUI Screen 停止脚本
# =============================================
# 用法: ./stop-screen.sh
# =============================================

SCREEN_NAME="open-webui"

if screen -list | grep -q "$SCREEN_NAME"; then
    echo "停止 screen 会话: $SCREEN_NAME"
    screen -S "$SCREEN_NAME" -X quit 2>/dev/null || true
    sleep 1
    echo "已停止"
else
    echo "未找到 screen 会话: $SCREEN_NAME"
fi
