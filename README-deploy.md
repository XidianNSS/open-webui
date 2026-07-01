# Open WebUI Screen 部署指南

## 一、前置准备

在服务器上安装依赖：

```bash
sudo apt update
sudo apt install -y python3 python3-venv python3-pip nodejs npm screen git

python3 --version
node --version
npm --version
screen --version
```

建议版本：

- Python: 3.11 或 3.12
- Node.js: 18.13.0 到 22.x

项目根目录提供 `.nvmrc`，`deploy.sh` 会在检测 Node 前自动加载 `~/.nvm/nvm.sh` 并优先使用 `.nvmrc` 指定的 Node 22；如果服务器默认 Node 高于 22，请不要直接用默认 Node 运行前端构建。

## 二、获取代码

示例：

```bash
git clone https://github.com/XidianNSS/open-webui.git
cd open-webui
```

如果代码已经在服务器上，直接进入项目根目录即可。

## 三、执行部署

```bash
chmod +x deploy.sh start-screen.sh stop-screen.sh
./deploy.sh
```

`deploy.sh` 会完成：

1. 检查 python3、node、npm、screen
2. 创建或复用 `.venv`
3. 安装后端 Python 依赖
4. 执行 `npm install`
5. 执行 `npm run build`
6. 通过 `screen` 启动后端服务

脚本默认使用自身所在目录作为 `PROJECT_DIR`，通常不需要手动改路径。

如果项目根目录存在 `.env`，`deploy.sh` 和 `start-screen.sh` 会先加载 `.env`，再启动服务。

## 四、常用命令

```bash
# 查看 screen 会话
screen -list

# 进入 Open WebUI 会话查看日志
screen -r open-webui

# 从 screen 会话中退出但不停止服务
# 按 Ctrl+A，然后按 D

# 停止服务
./stop-screen.sh

# 只重启服务，不重新安装依赖或 build
./start-screen.sh
```

## 五、配置项

可以通过环境变量覆盖默认配置：

```bash
PORT=18080 HOST=0.0.0.0 ./deploy.sh
```

常用变量：

| 变量 | 说明 | 默认值 |
| --- | --- | --- |
| `PROJECT_DIR` | 项目根目录 | 脚本所在目录 |
| `SCREEN_NAME` | screen 会话名 | `open-webui` |
| `PORT` | 服务端口 | `18080` |
| `HOST` | 监听地址 | `0.0.0.0` |
| `FRONTEND_BUILD_DIR` | 前端构建目录 | `$PROJECT_DIR/build` |
| `OLLAMA_BASE_URL` | Ollama 地址 | `http://localhost:11434` |
| `OPENAI_API_BASE_URL` | OpenAI 兼容 API 地址 | 空 |
| `OPENAI_API_KEY` | API Key | 空 |

示例：

```bash
OLLAMA_BASE_URL=http://127.0.0.1:11434 PORT=18080 ./deploy.sh
```

也可以写入项目根目录 `.env`：

```bash
PORT=18080
HOST=0.0.0.0
OLLAMA_BASE_URL=http://127.0.0.1:11434
OPENAI_API_BASE_URL=
OPENAI_API_KEY=
```

## 六、前端构建说明

`npm run build` 会输出到项目根目录的 `build/`。

脚本不会删除或覆盖 `backend/open_webui/static`。后端启动时会设置：

```bash
FRONTEND_BUILD_DIR=$PROJECT_DIR/build
```

这样 FastAPI 会直接加载前端构建产物，同时保留后端自带的静态资源。

## 七、Nginx 反向代理示例

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://127.0.0.1:18080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## 八、目录结构

```text
open-webui/
├── backend/
│   ├── open_webui/
│   │   └── static/
│   ├── requirements.txt
│   └── start.sh
├── build/
├── .venv/
├── deploy.sh
├── start-screen.sh
└── stop-screen.sh
```
