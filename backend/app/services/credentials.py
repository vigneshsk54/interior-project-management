from __future__ import annotations

from datetime import UTC, datetime
from typing import Protocol

from pymongo import ASCENDING, MongoClient
from pymongo.errors import DuplicateKeyError, PyMongoError

from app.core.config import settings

MONGO_CREDENTIAL_MARKER = "!mongodb-managed!"


class CredentialStoreError(RuntimeError):
    """Base error for credential persistence failures."""


class CredentialAlreadyExists(CredentialStoreError):
    pass


class CredentialStoreUnavailable(CredentialStoreError):
    pass


class CredentialStore(Protocol):
    def ping(self) -> None: ...

    def get_password_hash(self, email: str) -> str | None: ...

    def create(self, user_id: str, email: str, password_hash: str) -> None: ...

    def migrate_legacy(self, user_id: str, email: str, password_hash: str) -> None: ...

    def delete(self, user_id: str, email: str) -> None: ...


class MongoCredentialStore:
    def __init__(self) -> None:
        self.client = MongoClient(
            settings.mongodb_url,
            serverSelectionTimeoutMS=settings.mongodb_timeout_ms,
            connectTimeoutMS=settings.mongodb_timeout_ms,
        )
        self.collection = self.client[settings.mongodb_database]["credentials"]
        self._indexes_ready = False

    @staticmethod
    def _email(email: str) -> str:
        return email.strip().lower()

    def _prepare(self) -> None:
        if self._indexes_ready:
            return
        try:
            self.client.admin.command("ping")
            self.collection.create_index(
                [("user_id", ASCENDING)], unique=True, name="uq_credentials_user_id"
            )
            self._indexes_ready = True
        except PyMongoError as exc:
            raise CredentialStoreUnavailable("MongoDB credential store is unavailable") from exc

    def ping(self) -> None:
        self._prepare()
        try:
            self.client.admin.command("ping")
        except PyMongoError as exc:
            raise CredentialStoreUnavailable("MongoDB credential store is unavailable") from exc

    def get_password_hash(self, email: str) -> str | None:
        self._prepare()
        try:
            document = self.collection.find_one(
                {"_id": self._email(email)}, {"password_hash": 1}
            )
        except PyMongoError as exc:
            raise CredentialStoreUnavailable("MongoDB credential store is unavailable") from exc
        return document.get("password_hash") if document else None

    def create(self, user_id: str, email: str, password_hash: str) -> None:
        self._prepare()
        now = datetime.now(UTC)
        try:
            self.collection.insert_one(
                {
                    "_id": self._email(email),
                    "user_id": str(user_id),
                    "password_hash": password_hash,
                    "created_at": now,
                    "updated_at": now,
                }
            )
        except DuplicateKeyError as exc:
            raise CredentialAlreadyExists("A credential with this email already exists") from exc
        except PyMongoError as exc:
            raise CredentialStoreUnavailable("MongoDB credential store is unavailable") from exc

    def migrate_legacy(self, user_id: str, email: str, password_hash: str) -> None:
        self._prepare()
        normalized_email = self._email(email)
        now = datetime.now(UTC)
        try:
            existing = self.collection.find_one({"_id": normalized_email}, {"user_id": 1})
            if existing:
                if existing.get("user_id") != str(user_id):
                    raise CredentialAlreadyExists(
                        "The login email belongs to a different MongoDB credential"
                    )
                return
            self.collection.insert_one(
                {
                    "_id": normalized_email,
                    "user_id": str(user_id),
                    "password_hash": password_hash,
                    "created_at": now,
                    "updated_at": now,
                    "migrated_from_sql": True,
                }
            )
        except CredentialAlreadyExists:
            raise
        except DuplicateKeyError as exc:
            raise CredentialAlreadyExists("A credential with this email already exists") from exc
        except PyMongoError as exc:
            raise CredentialStoreUnavailable("MongoDB credential store is unavailable") from exc

    def delete(self, user_id: str, email: str) -> None:
        self._prepare()
        try:
            self.collection.delete_one(
                {"_id": self._email(email), "user_id": str(user_id)}
            )
        except PyMongoError as exc:
            raise CredentialStoreUnavailable("MongoDB credential store is unavailable") from exc


class MemoryCredentialStore:
    """Mongo-shaped test double; production and development always use MongoDB."""

    def __init__(self) -> None:
        self.documents: dict[str, dict[str, str]] = {}

    @staticmethod
    def _email(email: str) -> str:
        return email.strip().lower()

    def ping(self) -> None:
        return None

    def get_password_hash(self, email: str) -> str | None:
        document = self.documents.get(self._email(email))
        return document["password_hash"] if document else None

    def create(self, user_id: str, email: str, password_hash: str) -> None:
        normalized_email = self._email(email)
        if normalized_email in self.documents or any(
            item["user_id"] == str(user_id) for item in self.documents.values()
        ):
            raise CredentialAlreadyExists("A credential with this email already exists")
        self.documents[normalized_email] = {
            "user_id": str(user_id),
            "password_hash": password_hash,
        }

    def migrate_legacy(self, user_id: str, email: str, password_hash: str) -> None:
        normalized_email = self._email(email)
        existing = self.documents.get(normalized_email)
        if existing:
            if existing["user_id"] != str(user_id):
                raise CredentialAlreadyExists(
                    "The login email belongs to a different credential"
                )
            return
        self.create(user_id, normalized_email, password_hash)

    def delete(self, user_id: str, email: str) -> None:
        normalized_email = self._email(email)
        existing = self.documents.get(normalized_email)
        if existing and existing["user_id"] == str(user_id):
            self.documents.pop(normalized_email)


credential_store: CredentialStore
if settings.app_env == "test":
    credential_store = MemoryCredentialStore()
else:
    credential_store = MongoCredentialStore()


def get_credential_store() -> CredentialStore:
    return credential_store
