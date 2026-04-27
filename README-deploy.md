# Open WebUI Screen 部署指南

## 一、前置准备

在服务器上安装以下依赖：

```bash
# Ubuntu/Debian 示例
sudo apt update
sudo apt install -y python3 python3-venv python3-pip nodejs npm screen git

# 验证版本
python3 --version   # 要求 3.11 或 3.12
node --version      # 要求 18.13.0 ~ 22.x.x
```

## 二、上传代码

将项目上传到服务器，例如 `/home/nss-marker/open-webui`：

```bash
git clone <你的仓库地址> /opt/open-webui
cd /opt/open-webui
```

## 三、修改脚本中的路径

编辑以下 3 个文件，把 `PROJECT_DIR` 改成你的实际路径：

- `deploy.sh`
- `start-screen.sh`

```bash
PROJECT_DIR="/opt/open-webui"   # 改成你的路径
```

## 四、执行部署

```bash
cd /opt/open-webui
chmod +x deploy.sh start-screen.sh stop-screen.sh
./deploy.sh
```

`deploy.sh` 会完成：
1. 创建 Python 虚拟环境（`.venv`）
2. 安装后端依赖
3. 前端 `npm install && npm run build`
4. 将 `build/` 复制到 `backend/open_webui/static`
5. 在 screen 会话中启动后端

## 五、日常管理命令

```bash
# 查看运行状态
screen -list

# 进入日志窗口（看实时输出）
screen -r open-webui

# 从 screen 中 detach（不停止服务）
# 在 screen 窗口内按: Ctrl+A, 然后按 D

# 停止服务
./stop-screen.sh

# 只重启（不重新 build）
./start-screen.sh
```

## 六、关键配置（可选）

在 `deploy.sh` 或 `start-screen.sh` 中修改环境变量：

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `PORT` | 服务端口 | `8080` |
| `HOST` | 监听地址 | `0.0.0.0` |
| `OLLAMA_BASE_URL` | Ollama 地址 | `http://localhost:11434` |
| `OPENAI_API_BASE_URL` | OpenAI 兼容 API 地址 | - |
| `OPENAI_API_KEY` | API Key | - |
| `WEBUI_SECRET_KEY` | JWT 密钥（留空会自动生成） | - |

你也可以直接在服务器上创建 `.env` 文件放在项目根目录，`start.sh` 会自动读取。

## 七、Nginx 反向代理（推荐）

如果要用域名访问，在 Nginx 中加一段：

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://127.0.0.1:8080;
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

然后配 HTTPS（certbot）。

## 八、目录结构说明

```
/opt/open-webui/
├── backend/
│   ├── open_webui/
│   │   └── static/          # 前端构建产物会复制到这里
│   ├── requirements.txt
│   └── start.sh             # 后端启动脚本
├── build/                   # 前端 npm run build 的输出
├── .venv/                   # Python 虚拟环境
├── deploy.sh                # 完整部署脚本
├── start-screen.sh          # 仅启动（不 build）
└── stop-screen.sh           # 停止 screen 会话
```
