import os

os.environ.setdefault("ADMIN_SECRET_KEY", "ci-test-admin-secret-key-123456789")
os.environ.setdefault("UPLOAD_TOKEN_SECRET", "ci-test-upload-secret-123456789")
os.environ.setdefault("CORS_ORIGINS", "http://localhost:3000")
