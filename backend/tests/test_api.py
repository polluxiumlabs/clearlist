from fastapi.testclient import TestClient

from app.api import contact, uploads
from app.main import app

client = TestClient(app)


def test_health_reports_service_capabilities() -> None:
    response = client.get("/health")
    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "ok"
    assert isinstance(payload["storage"], bool)
    assert isinstance(payload["database"], bool)
    assert isinstance(payload["admin"], bool)


def test_upload_requires_configured_private_storage(monkeypatch) -> None:
    class DisabledStorage:
        enabled = False

    monkeypatch.setattr(uploads, "b2_storage", DisabledStorage())
    response = client.post(
        "/api/uploads",
        files={"file": ("contacts.csv", b"Email\nuser@example.com\n", "text/csv")},
    )
    assert response.status_code == 503


def test_upload_writes_csv_to_b2_and_only_metadata_to_firestore(monkeypatch) -> None:
    class FakeStorage:
        enabled = True
        body = b""

        @staticmethod
        def object_key(upload_id: str) -> str:
            return f"uploads/{upload_id}.csv"

        @staticmethod
        def deletion_token(upload_id: str) -> str:
            return f"token-{upload_id}"

        def put_csv(self, upload_id: str, body: bytes) -> None:
            self.body = body

        def delete_csv(self, upload_id: str) -> None:
            pass

    class FakeMetadata:
        enabled = True
        record = None

        def create_upload(self, **record) -> None:
            self.record = record

    fake_storage = FakeStorage()
    fake_metadata = FakeMetadata()
    monkeypatch.setattr(uploads, "b2_storage", fake_storage)
    monkeypatch.setattr(uploads, "upload_metadata", fake_metadata)

    response = client.post(
        "/api/uploads",
        files={"file": ("private-contacts.csv", b"Email\nuser@example.com\n", "text/csv")},
    )

    assert response.status_code == 201
    assert fake_storage.body == b"Email\nuser@example.com\n"
    assert fake_metadata.record is not None
    assert fake_metadata.record["size_bytes"] == len(fake_storage.body)
    assert fake_metadata.record["object_key"].startswith("uploads/")
    assert "filename" not in fake_metadata.record
    assert "email" not in fake_metadata.record


def test_upload_rolls_back_b2_when_firestore_fails(monkeypatch) -> None:
    class FakeStorage:
        enabled = True
        deleted_upload_id = None

        @staticmethod
        def object_key(upload_id: str) -> str:
            return f"uploads/{upload_id}.csv"

        def put_csv(self, upload_id: str, body: bytes) -> None:
            pass

        def delete_csv(self, upload_id: str) -> None:
            self.deleted_upload_id = upload_id

    class BrokenMetadata:
        enabled = True

        def create_upload(self, **record) -> None:
            raise RuntimeError("Firestore unavailable")

    fake_storage = FakeStorage()
    monkeypatch.setattr(uploads, "b2_storage", fake_storage)
    monkeypatch.setattr(uploads, "upload_metadata", BrokenMetadata())

    response = client.post(
        "/api/uploads",
        files={"file": ("contacts.csv", b"Email\nuser@example.com\n", "text/csv")},
    )

    assert response.status_code == 503
    assert response.json()["detail"] == "The upload database is temporarily unavailable"
    assert fake_storage.deleted_upload_id is not None


def test_contact_form_stores_message_in_firestore(monkeypatch) -> None:
    class FakeContactStore:
        enabled = True
        record = None

        def create_message(self, **record) -> None:
            self.record = record

    fake_store = FakeContactStore()
    contact._attempts.clear()
    monkeypatch.setattr(contact, "contact_messages", fake_store)

    response = client.post(
        "/api/contact",
        json={
            "name": "Rafiq Islam",
            "email": "RAFIQ@example.com",
            "topic": "support",
            "message": "I need help understanding an unknown verification result.",
            "company_website": "",
            "privacy_accepted": True,
        },
    )

    assert response.status_code == 201
    assert response.json() == {"status": "received"}
    assert fake_store.record is not None
    assert fake_store.record["email"] == "rafiq@example.com"
    assert fake_store.record["topic"] == "support"


def test_contact_honeypot_does_not_write_to_firestore(monkeypatch) -> None:
    class FakeContactStore:
        enabled = True
        called = False

        def create_message(self, **record) -> None:
            self.called = True

    fake_store = FakeContactStore()
    contact._attempts.clear()
    monkeypatch.setattr(contact, "contact_messages", fake_store)

    response = client.post(
        "/api/contact",
        json={
            "name": "Spam Bot",
            "email": "bot@example.com",
            "topic": "other",
            "message": "This is an automated spam message with enough characters.",
            "company_website": "https://spam.example",
            "privacy_accepted": True,
        },
    )

    assert response.status_code == 201
    assert fake_store.called is False


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


def test_admin_verify_unauthorized() -> None:
    response = client.post("/api/admin/verify", headers={"X-Admin-Token": "wrong-token-value"})
    assert response.status_code == 401


def test_admin_verify_success() -> None:
    from app.config import settings

    response = client.post("/api/admin/verify", headers={"X-Admin-Token": settings.admin_secret_key})
    assert response.status_code == 200
    assert response.json() == {"status": "authorized", "message": "Admin token is valid"}


def test_admin_download_original_and_clean(monkeypatch) -> None:
    from app.api import admin
    from app.config import settings

    class FakeStorage:
        enabled = True

        def get_csv(self, upload_id: str) -> bytes:
            return b"Name,Title,Organization,Email\nAlex Morgan,CEO,Northstar,alex.morgan@gmail.com\nBroken,,Test,broken@@example.com\n"

        def get_clean_csv(self, upload_id: str) -> bytes | None:
            return None

        def put_clean_csv(self, upload_id: str, body: bytes) -> None:
            pass

    monkeypatch.setattr(admin, "b2_storage", FakeStorage())

    # Download original
    orig_resp = client.get("/api/admin/uploads/test1234/download-original", headers={"X-Admin-Token": settings.admin_secret_key})
    assert orig_resp.status_code == 200
    assert b"broken@@example.com" in orig_resp.content

    # Download cleanup
    clean_resp = client.get("/api/admin/uploads/test1234/download-clean", headers={"X-Admin-Token": settings.admin_secret_key})
    assert clean_resp.status_code == 200
    assert b"Status" in clean_resp.content
    assert b"Reason" in clean_resp.content


def test_admin_batch_delete() -> None:
    from app.config import settings

    resp = client.post(
        "/api/admin/uploads/batch-delete",
        headers={"X-Admin-Token": settings.admin_secret_key},
        json={"upload_ids": ["id1", "id2"]},
    )
    assert resp.status_code == 200
    assert resp.json()["deleted_count"] == 2


def test_typo_detection() -> None:
    response = client.post("/api/verify-batch", json={"emails": ["john@gmai.com"]})
    assert response.status_code == 200
    result = response.json()["results"][0]
    assert result["status"] in {"invalid", "risky"}
    assert result["suggested_email"] == "john@gmail.com"
    assert "did you mean john@gmail.com" in result["reason"]



