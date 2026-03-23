import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parents[1]))
from app import app


def test_health_endpoint():
    client = app.test_client()
    res = client.get("/api/health")
    assert res.status_code == 200
    data = res.get_json()
    assert isinstance(data, dict)


def test_db_status_endpoint():
    client = app.test_client()
    res = client.get("/api/db/status")
    assert res.status_code == 200
    data = res.get_json()
    assert isinstance(data, dict)
    assert "enabled" in data
    assert "connected" in data
