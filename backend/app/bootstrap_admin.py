from sqlalchemy import select

from app.core.config import settings
from app.core.security import hash_password
from app.db.session import SessionLocal
from app.models import User
from app.services.credentials import MONGO_CREDENTIAL_MARKER, get_credential_store


def run() -> None:
    email = settings.initial_admin_email.strip().lower()
    password = settings.initial_admin_password
    if not email and not password:
        print("Initial administrator is not configured; skipping bootstrap.")
        return
    if not email or not password:
        raise RuntimeError(
            "INITIAL_ADMIN_EMAIL and INITIAL_ADMIN_PASSWORD must both be configured."
        )
    if len(password) < 12:
        raise RuntimeError("INITIAL_ADMIN_PASSWORD must contain at least 12 characters.")

    credentials = get_credential_store()
    credentials.ping()
    with SessionLocal() as db:
        existing = db.scalar(select(User).where(User.email == email))
        if existing:
            if existing.password_hash != MONGO_CREDENTIAL_MARKER:
                credentials.migrate_legacy(
                    str(existing.id), existing.email, existing.password_hash
                )
                existing.password_hash = MONGO_CREDENTIAL_MARKER
                db.commit()
            print(f"Administrator bootstrap skipped; {email} already exists.")
            return
        admin = User(
            email=email,
            full_name=settings.initial_admin_name.strip() or "Workspace Administrator",
            role="admin",
            password_hash=MONGO_CREDENTIAL_MARKER,
            is_active=True,
            is_verified=True,
        )
        db.add(admin)
        db.flush()
        credentials.create(str(admin.id), email, hash_password(password))
        try:
            db.commit()
        except Exception:
            db.rollback()
            credentials.delete(str(admin.id), email)
            raise
        print(f"Created initial administrator {email}.")


if __name__ == "__main__":
    run()
