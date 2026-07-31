# ruff: noqa: E402
import os
from pathlib import Path

TEST_DB = Path("/tmp/atelier_flow_test.db")
if TEST_DB.exists():
    TEST_DB.unlink()
os.environ["DATABASE_URL"] = f"sqlite:///{TEST_DB}"
os.environ["SECRET_KEY"] = "test-secret-key-that-is-long-enough"
os.environ["N8N_WEBHOOK_SECRET"] = "test-webhook-secret"
os.environ["APP_ENV"] = "test"

import pytest
from fastapi.testclient import TestClient

from app.core.rate_limit import RateLimitMiddleware
from app.core.security import hash_password
from app.db.base import Base
from app.db.session import SessionLocal, engine, get_db
from app.main import app
from app.models import User

Base.metadata.create_all(engine)


def override_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_db


@pytest.fixture(autouse=True)
def reset_rate_limits():
    RateLimitMiddleware.windows.clear()


@pytest.fixture(scope="session")
def client():
    with SessionLocal() as db:
        if not db.query(User).first():
            db.add_all(
                [
                    User(
                        email="admin@example.com",
                        full_name="Admin User",
                        role="admin",
                        password_hash=hash_password("Password@123"),
                    ),
                    User(
                        email="sales@example.com",
                        full_name="Sales User",
                        role="sales_manager",
                        password_hash=hash_password("Password@123"),
                    ),
                    User(
                        email="client@example.com",
                        full_name="Client User",
                        role="client",
                        password_hash=hash_password("Password@123"),
                    ),
                ]
            )
            db.commit()
    return TestClient(app)


@pytest.fixture
def admin_headers(client):
    response = client.post(
        "/api/v1/auth/login", json={"email": "admin@example.com", "password": "Password@123"}
    )
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


@pytest.fixture
def sales_headers(client):
    response = client.post(
        "/api/v1/auth/login", json={"email": "sales@example.com", "password": "Password@123"}
    )
    return {"Authorization": f"Bearer {response.json()['access_token']}"}
