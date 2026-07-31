import json
import logging
import os
import sys
import time

import redis
import requests
from flask import Flask, g, jsonify, render_template, request
from prometheus_client import (
    Counter,
    Gauge,
    Histogram,
    generate_latest,
    CONTENT_TYPE_LATEST,
)

app = Flask(__name__)

# Configuracao via variaveis de ambiente
REDIS_HOST = os.environ.get("REDIS_HOST", "localhost")
REDIS_PORT = int(os.environ.get("REDIS_PORT", 6379))
REDIS_PASSWORD = os.environ.get("REDIS_PASSWORD", None)
APP_PORT = int(os.environ.get("APP_PORT", 5000))
CHECK_TIMEOUT = int(os.environ.get("CHECK_TIMEOUT", 5))
HISTORY_LIMIT = int(os.environ.get("HISTORY_LIMIT", 100))
APP_VERSION = os.environ.get("APP_VERSION", "1.0.0-cesar")
LOG_LEVEL = os.environ.get("LOG_LEVEL", "INFO").upper()
LOG_FILE = os.environ.get("LOG_FILE")

# Logging
log_handlers = [logging.StreamHandler(sys.stdout)]
if LOG_FILE:
    log_handlers.append(logging.FileHandler(LOG_FILE))

logging.basicConfig(
    level=getattr(logging, LOG_LEVEL, logging.INFO),
    format="%(asctime)s %(levelname)s %(name)s - %(message)s",
    handlers=log_handlers,
)
log = logging.getLogger("giropops")

# Conexao Redis
r = redis.Redis(
    host=REDIS_HOST,
    port=REDIS_PORT,
    password=REDIS_PASSWORD,
    decode_responses=True,
)

# Metricas Prometheus
CHECKS_TOTAL = Counter(
    "giropops_checks_total",
    "Total de health checks realizados",
    ["service", "status"],
)
CHECK_DURATION = Histogram(
    "giropops_check_duration_seconds",
    "Tempo de resposta dos health checks",
    ["service"],
)
SERVICES_UP = Gauge(
    "giropops_services_up",
    "Quantidade de servicos UP",
)
SERVICES_DOWN = Gauge(
    "giropops_services_down",
    "Quantidade de servicos DOWN",
)
REQUEST_DURATION = Histogram(
    "giropops_request_duration_seconds",
    "Latencia das requisicoes por endpoint",
    ["method", "endpoint"],
)


@app.before_request
def _start_timer():
    g._start = time.time()


@app.after_request
def _observe_request(response):
    start = getattr(g, "_start", None)
    if start is not None:
        endpoint = request.endpoint or "unknown"
        REQUEST_DURATION.labels(method=request.method, endpoint=endpoint).observe(
            time.time() - start
        )
    return response


def check_service(name, url):
    """Verifica se um servico esta respondendo e registra o resultado."""
    start = time.time()
    try:
        resp = requests.get(url, timeout=CHECK_TIMEOUT)
        duration = time.time() - start
        status = "UP" if resp.status_code < 400 else "DOWN"
        status_code = resp.status_code
    except requests.RequestException as exc:
        duration = time.time() - start
        status = "DOWN"
        status_code = 0
        log.warning("check falhou para %s (%s): %s", name, url, exc)

    CHECK_DURATION.labels(service=name).observe(duration)
    CHECKS_TOTAL.labels(service=name, status=status).inc()

    result = {
        "name": name,
        "url": url,
        "status": status,
        "status_code": status_code,
        "response_time_ms": round(duration * 1000, 2),
        "checked_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }

    r.hset(f"service:{name}", "last_check", json.dumps(result))
    r.lpush(f"history:{name}", json.dumps(result))
    r.ltrim(f"history:{name}", 0, HISTORY_LIMIT - 1)

    log.info("check %s status=%s code=%s duration_ms=%s", name, status, status_code, result["response_time_ms"])
    return result


def update_gauges():
    """Atualiza os gauges de servicos UP e DOWN."""
    services = r.smembers("services")
    up = 0
    down = 0
    for name in services:
        last = r.hget(f"service:{name}", "last_check")
        if last:
            data = json.loads(last)
            if data.get("status") == "UP":
                up += 1
            else:
                down += 1
    SERVICES_UP.set(up)
    SERVICES_DOWN.set(down)


# --- Rotas ---


@app.route("/")
def index():
    """Dashboard principal."""
    services = []
    for name in sorted(r.smembers("services")):
        url = r.hget(f"service:{name}", "url")
        last = r.hget(f"service:{name}", "last_check")
        service_data = {"name": name, "url": url, "status": "UNKNOWN", "response_time_ms": 0}
        if last:
            service_data.update(json.loads(last))
        services.append(service_data)
    return render_template("index.html", services=services, version=APP_VERSION)


@app.route("/api/services", methods=["GET"])
def list_services():
    """Lista todos os servicos e seus status."""
    services = []
    for name in sorted(r.smembers("services")):
        url = r.hget(f"service:{name}", "url")
        last = r.hget(f"service:{name}", "last_check")
        service_data = {"name": name, "url": url, "status": "UNKNOWN"}
        if last:
            service_data.update(json.loads(last))
        services.append(service_data)
    return jsonify(services)


@app.route("/api/services", methods=["POST"])
def add_service():
    """Cadastra um novo servico para monitorar."""
    data = request.get_json(silent=True)
    if not data or "name" not in data or "url" not in data:
        return jsonify({"error": "campos 'name' e 'url' sao obrigatorios"}), 400

    name = data["name"].strip().lower().replace(" ", "-")
    url = data["url"].strip()

    if not name:
        return jsonify({"error": "campo 'name' nao pode ser vazio"}), 400

    if not url.startswith(("http://", "https://")):
        return jsonify({"error": "url deve comecar com http:// ou https://"}), 400

    r.sadd("services", name)
    r.hset(f"service:{name}", "url", url)
    log.info("servico cadastrado: %s -> %s", name, url)

    return jsonify({"message": f"servico '{name}' cadastrado", "name": name, "url": url}), 201


@app.route("/api/services/<name>", methods=["DELETE"])
def remove_service(name):
    """Remove um servico do monitoramento."""
    if not r.sismember("services", name):
        return jsonify({"error": f"servico '{name}' nao encontrado"}), 404

    r.srem("services", name)
    r.delete(f"service:{name}")
    r.delete(f"history:{name}")
    log.info("servico removido: %s", name)

    return jsonify({"message": f"servico '{name}' removido"})


@app.route("/api/check", methods=["POST"])
def check_all():
    """Dispara verificacao de todos os servicos."""
    results = []
    for name in r.smembers("services"):
        url = r.hget(f"service:{name}", "url")
        if url:
            result = check_service(name, url)
            results.append(result)

    update_gauges()
    return jsonify(results)


@app.route("/api/check/<name>", methods=["POST"])
def check_one(name):
    """Dispara verificacao de um servico especifico."""
    if not r.sismember("services", name):
        return jsonify({"error": f"servico '{name}' nao encontrado"}), 404

    url = r.hget(f"service:{name}", "url")
    result = check_service(name, url)
    update_gauges()
    return jsonify(result)


@app.route("/api/history/<name>", methods=["GET"])
def get_history(name):
    """Retorna o historico de checks de um servico."""
    if not r.sismember("services", name):
        return jsonify({"error": f"servico '{name}' nao encontrado"}), 404

    limit = request.args.get("limit", 20, type=int)
    history = r.lrange(f"history:{name}", 0, limit - 1)
    return jsonify([json.loads(h) for h in history])


@app.route("/health", methods=["GET"])
def health():
    """Health check da aplicacao."""
    try:
        r.ping()
        redis_status = "connected"
    except redis.ConnectionError:
        log.error("Redis indisponivel em %s:%s", REDIS_HOST, REDIS_PORT)
        return jsonify({"status": "unhealthy", "redis": "disconnected"}), 503

    return jsonify({"status": "healthy", "redis": redis_status, "version": APP_VERSION})


@app.route("/metrics", methods=["GET"])
def metrics():
    """Metricas no formato Prometheus."""
    update_gauges()
    return generate_latest(), 200, {"Content-Type": CONTENT_TYPE_LATEST}


@app.route("/version", methods=["GET"])
def version():
    """Informacoes de build."""
    return jsonify({
        "version": APP_VERSION,
        "python": sys.version,
        "redis_host": REDIS_HOST,
        "editado_por": "Cesar Santos",
    })


if __name__ == "__main__":
    log.info("Giropops Status v%s iniciando em :%s (redis=%s:%s)", APP_VERSION, APP_PORT, REDIS_HOST, REDIS_PORT)
    app.run(host="0.0.0.0", port=APP_PORT, debug=os.environ.get("FLASK_DEBUG", "false").lower() == "true")
