export CORS_ALLOW_ORIGIN="http://10.144.144.3:5173;http://localhost:5173;http://127.0.0.1:5173;http://10.144.144.3:8080;http://localhost:8080"
PORT="${PORT:-8080}"
uvicorn open_webui.main:app --port $PORT --host 0.0.0.0 --forwarded-allow-ips '*' --reload