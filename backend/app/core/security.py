import hashlib
import hmac
import uuid
from datetime import UTC, datetime, timedelta

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError

from app.core.config import settings

hasher = PasswordHasher()


def hash_password(password: str) -> str:
    return hasher.hash(password)


def verify_password(password: str, encoded: str) -> bool:
    try:
        return hasher.verify(encoded, password)
    except VerifyMismatchError:
        return False


def create_token(subject: str, token_type: str, expires_delta: timedelta) -> str:
    now = datetime.now(UTC)
    return jwt.encode(
        {
            "sub": subject,
            "type": token_type,
            "jti": str(uuid.uuid4()),
            "iat": now,
            "exp": now + expires_delta,
        },
        settings.secret_key,
        algorithm="HS256",
    )


def decode_token(token: str, expected_type: str = "access") -> dict:
    payload = jwt.decode(token, settings.secret_key, algorithms=["HS256"])
    if payload.get("type") != expected_type:
        raise jwt.InvalidTokenError("Unexpected token type")
    return payload


def access_token(subject: str) -> str:
    return create_token(subject, "access", timedelta(minutes=settings.access_token_minutes))


def refresh_token(subject: str) -> str:
    return create_token(subject, "refresh", timedelta(days=settings.refresh_token_days))


def token_digest(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def valid_webhook_signature(body: bytes, signature: str | None) -> bool:
    expected = hmac.new(settings.n8n_webhook_secret.encode(), body, hashlib.sha256).hexdigest()
    return bool(signature) and hmac.compare_digest(signature, expected)
