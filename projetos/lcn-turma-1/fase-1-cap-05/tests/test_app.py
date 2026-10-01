import json
import pytest
from unittest.mock import patch, MagicMock

import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


@pytest.fixture
def mock_redis():
    with patch("app.r") as mock_r:
        mock_r.ping.return_value = True
        mock_r.smembers.return_value = set()
        yield mock_r


@pytest.fixture
def client(mock_redis):
    from app import app

    app.config["TESTING"] = True
    with app.test_client() as client:
        yield client


def test_health_check(client, mock_redis):
    """Testa o endpoint /health quando Redis esta conectado."""
    response = client.get("/health")
    data = json.loads(response.data)

    assert response.status_code == 200
    assert data["status"] == "healthy"
    assert data["redis"] == "connected"


def test_health_check_redis_down(client, mock_redis):
    """Testa o endpoint /health quando Redis esta desconectado."""
    import redis as redis_lib

    mock_redis.ping.side_effect = redis_lib.ConnectionError()

    response = client.get("/health")
    data = json.loads(response.data)

    assert response.status_code == 503
    assert data["status"] == "unhealthy"
    assert data["redis"] == "disconnected"


def test_version(client):
    """Testa o endpoint /version."""
    response = client.get("/version")
    data = json.loads(response.data)

    assert response.status_code == 200
    assert "version" in data


def test_list_services_empty(client, mock_redis):
    """Testa listagem sem servicos cadastrados."""
    response = client.get("/api/services")
    data = json.loads(response.data)

    assert response.status_code == 200
    assert data == []


def test_add_service(client, mock_redis):
    """Testa cadastro de novo servico."""
    response = client.post(
        "/api/services",
        data=json.dumps({"name": "minha-api", "url": "https://api.exemplo.com/health"}),
        content_type="application/json",
    )
    data = json.loads(response.data)

    assert response.status_code == 201
    assert data["name"] == "minha-api"
    mock_redis.sadd.assert_called_once_with("services", "minha-api")


def test_add_service_missing_fields(client, mock_redis):
    """Testa cadastro com campos faltando."""
    response = client.post(
        "/api/services",
        data=json.dumps({"name": "teste"}),
        content_type="application/json",
    )
    assert response.status_code == 400


def test_add_service_invalid_url(client, mock_redis):
    """Testa cadastro com URL invalida."""
    response = client.post(
        "/api/services",
        data=json.dumps({"name": "teste", "url": "ftp://invalido"}),
        content_type="application/json",
    )
    assert response.status_code == 400


def test_remove_service(client, mock_redis):
    """Testa remocao de servico existente."""
    mock_redis.sismember.return_value = True

    response = client.delete("/api/services/minha-api")
    data = json.loads(response.data)

    assert response.status_code == 200
    mock_redis.srem.assert_called_once_with("services", "minha-api")


def test_remove_service_not_found(client, mock_redis):
    """Testa remocao de servico inexistente."""
    mock_redis.sismember.return_value = False

    response = client.delete("/api/services/nao-existe")
    assert response.status_code == 404


def test_check_all_empty(client, mock_redis):
    """Testa check com nenhum servico cadastrado."""
    response = client.post("/api/check")
    data = json.loads(response.data)

    assert response.status_code == 200
    assert data == []


def test_dashboard(client, mock_redis):
    """Testa se o dashboard renderiza sem erros."""
    response = client.get("/")
    assert response.status_code == 200
    assert b"Giropops Status" in response.data


def test_metrics(client, mock_redis):
    """Testa se o endpoint /metrics retorna formato Prometheus."""
    response = client.get("/metrics")
    assert response.status_code == 200
    assert b"giropops_" in response.data


def test_request_duration_observed(client, mock_redis):
    """Confirma que o middleware observa REQUEST_DURATION."""
    client.get("/version")
    response = client.get("/metrics")
    assert response.status_code == 200
    assert b"giropops_request_duration_seconds" in response.data


def test_add_service_empty_name(client, mock_redis):
    """Nome vazio (apenas espacos) deve falhar com 400."""
    response = client.post(
        "/api/services",
        data=json.dumps({"name": "   ", "url": "https://api.exemplo.com"}),
        content_type="application/json",
    )
    assert response.status_code == 400


def test_add_service_no_body(client, mock_redis):
    """POST sem corpo deve retornar 400 (nao 500)."""
    response = client.post("/api/services")
    assert response.status_code == 400
