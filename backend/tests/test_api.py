from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health_reports_no_storage() -> None:
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "storage": False}


def test_upload_requires_configured_private_storage() -> None:
    response = client.post(
        "/api/uploads",
        files={"file": ("contacts.csv", b"Email\nuser@example.com\n", "text/csv")},
    )
    assert response.status_code == 503


def test_invalid_syntax_short_circuits() -> None:
    response = client.post("/api/verify-batch", json={"emails": ["broken@@example.com"]})
    assert response.status_code == 200
    result = response.json()["results"][0]
    assert result["syntax"] is False
    assert result["status"] == "invalid"
    assert result["domain"] is None


def test_empty_batch_is_rejected() -> None:
    response = client.post("/api/verify-batch", json={"emails": []})
    assert response.status_code == 422
