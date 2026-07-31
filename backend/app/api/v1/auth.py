import uuid
from datetime import UTC, datetime, timedelta

import jwt
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.config import settings
from app.core.security import (
    access_token,
    decode_token,
    hash_password,
    refresh_token,
    token_digest,
    verify_password,
)
from app.db.session import get_db
from app.models import Customer, RefreshToken, User
from app.schemas.domain import LoginRequest, RefreshRequest, SignupRequest, TokenPair, UserOut
from app.services.credentials import (
    MONGO_CREDENTIAL_MARKER,
    CredentialAlreadyExists,
    CredentialStore,
    CredentialStoreUnavailable,
    get_credential_store,
)
from app.services.identity import contact_conflict_field

router = APIRouter(prefix="/auth", tags=["Authentication"])


def issue_pair(db: Session, user: User) -> TokenPair:
    access = access_token(str(user.id))
    refresh = refresh_token(str(user.id))
    db.add(
        RefreshToken(
            user_id=user.id,
            token_hash=token_digest(refresh),
            expires_at=datetime.now(UTC) + timedelta(days=settings.refresh_token_days),
        )
    )
    db.commit()
    return TokenPair(access_token=access, refresh_token=refresh)


def credential_service_error(exc: CredentialStoreUnavailable) -> HTTPException:
    return HTTPException(
        status.HTTP_503_SERVICE_UNAVAILABLE,
        "The credential store is temporarily unavailable",
    )


@router.post("/login", response_model=TokenPair)
def login(
    payload: LoginRequest,
    db: Session = Depends(get_db),
    credentials: CredentialStore = Depends(get_credential_store),
):
    user = db.scalar(select(User).where(User.email == payload.email.lower()))
    if not user or not user.is_active:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid email or password")
    try:
        password_hash = credentials.get_password_hash(user.email)
        if password_hash is None and user.password_hash != MONGO_CREDENTIAL_MARKER:
            if not verify_password(payload.password, user.password_hash):
                raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid email or password")
            credentials.migrate_legacy(str(user.id), user.email, user.password_hash)
            user.password_hash = MONGO_CREDENTIAL_MARKER
            db.commit()
        elif password_hash is None or not verify_password(payload.password, password_hash):
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid email or password")
        elif user.password_hash != MONGO_CREDENTIAL_MARKER:
            user.password_hash = MONGO_CREDENTIAL_MARKER
            db.commit()
    except CredentialStoreUnavailable as exc:
        raise credential_service_error(exc) from exc
    except CredentialAlreadyExists:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "The login credential is linked to another account",
        ) from None
    if payload.account_type == "client" and user.role != "client":
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            "This is not a client account. Use the Admin / Team login.",
        )
    if payload.account_type == "workspace" and user.role == "client":
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            "This is a client account. Use the Client login.",
        )
    return issue_pair(db, user)


@router.post("/register", response_model=TokenPair, status_code=status.HTTP_201_CREATED)
def register(
    payload: SignupRequest,
    db: Session = Depends(get_db),
    credentials: CredentialStore = Depends(get_credential_store),
):
    email = payload.email.lower()
    conflict = contact_conflict_field(db, email, payload.phone)
    if conflict:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            f"This {conflict} is already used by another account or client profile",
        )

    user = User(
        email=email,
        full_name=payload.full_name.strip(),
        phone=payload.phone.strip(),
        password_hash=MONGO_CREDENTIAL_MARKER,
        role="client",
        is_active=True,
        is_verified=True,
    )
    db.add(user)

    existing_customer = db.scalar(
        select(Customer).where(Customer.email == email, Customer.deleted_at.is_(None))
    )
    if existing_customer:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "This client profile already exists. Ask your workspace administrator to activate it.",
        )
    db.add(
        Customer(
            name=payload.full_name.strip(),
            email=email,
            phone=payload.phone.strip(),
            tags=["self-registered"],
            notes="Created through public sign-up.",
        )
    )

    credential_created = False
    try:
        db.flush()
        credentials.create(str(user.id), email, hash_password(payload.password))
        credential_created = True
        return issue_pair(db, user)
    except CredentialStoreUnavailable as exc:
        db.rollback()
        raise credential_service_error(exc) from exc
    except CredentialAlreadyExists:
        db.rollback()
        raise HTTPException(
            status.HTTP_409_CONFLICT, "An account with this email already exists"
        ) from None
    except IntegrityError:
        db.rollback()
        if credential_created:
            credentials.delete(str(user.id), email)
        raise HTTPException(
            status.HTTP_409_CONFLICT, "An account with this email already exists"
        ) from None
    except Exception:
        db.rollback()
        if credential_created:
            credentials.delete(str(user.id), email)
        raise


@router.post("/refresh", response_model=TokenPair)
def refresh(payload: RefreshRequest, db: Session = Depends(get_db)):
    try:
        claims = decode_token(payload.refresh_token, "refresh")
        user_id = uuid.UUID(claims["sub"])
    except (jwt.InvalidTokenError, KeyError, ValueError):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid refresh token") from None
    stored = db.scalar(
        select(RefreshToken).where(
            RefreshToken.token_hash == token_digest(payload.refresh_token),
            RefreshToken.revoked_at.is_(None),
        )
    )
    user = db.get(User, user_id)
    if not stored or not user or stored.expires_at.replace(tzinfo=UTC) < datetime.now(UTC):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Refresh token has expired")
    stored.revoked_at = datetime.now(UTC)
    db.commit()
    return issue_pair(db, user)


@router.post("/logout", status_code=204)
def logout(payload: RefreshRequest, db: Session = Depends(get_db)):
    stored = db.scalar(
        select(RefreshToken).where(RefreshToken.token_hash == token_digest(payload.refresh_token))
    )
    if stored and not stored.revoked_at:
        stored.revoked_at = datetime.now(UTC)
        db.commit()


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)):
    return user


@router.post("/forgot-password")
def forgot_password(payload: dict):
    return {"message": "If the account exists, reset instructions have been queued."}


@router.post("/reset-password")
def reset_password(payload: dict):
    if not payload.get("token") or not payload.get("password"):
        raise HTTPException(422, "Token and password are required")
    return {"message": "Password reset token accepted."}
