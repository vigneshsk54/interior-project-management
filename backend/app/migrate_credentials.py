from sqlalchemy import select

from app.db.session import SessionLocal
from app.models import User
from app.services.credentials import (
    MONGO_CREDENTIAL_MARKER,
    CredentialAlreadyExists,
    get_credential_store,
)


def run() -> None:
    store = get_credential_store()
    store.ping()
    migrated = 0
    with SessionLocal() as db:
        users = db.scalars(select(User)).all()
        for user in users:
            if not user.password_hash or user.password_hash == MONGO_CREDENTIAL_MARKER:
                continue
            try:
                store.migrate_legacy(str(user.id), user.email, user.password_hash)
            except CredentialAlreadyExists as exc:
                raise RuntimeError(
                    f"Could not migrate credential for {user.email}: {exc}"
                ) from exc
            user.password_hash = MONGO_CREDENTIAL_MARKER
            migrated += 1
        db.commit()
    print(f"Migrated {migrated} credential(s) from SQL to MongoDB.")


if __name__ == "__main__":
    run()
