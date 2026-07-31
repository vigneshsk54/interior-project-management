import uuid
from collections.abc import Callable

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.security import decode_token
from app.db.session import get_db
from app.models import User

bearer = HTTPBearer(auto_error=False)

ROLE_PERMISSIONS = {
    "admin": {"*"},
    "sales_manager": {"dashboard:view", "crm:manage", "quotations:manage", "customers:manage"},
    "interior_designer": {
        "dashboard:view",
        "crm:view",
        "designs:manage",
        "projects:view",
        "tasks:manage",
    },
    "project_manager": {
        "dashboard:view",
        "crm:view",
        "projects:manage",
        "tasks:manage",
        "vendors:manage",
        "finance:view",
        "site:manage",
    },
    "site_supervisor": {
        "dashboard:view",
        "crm:view",
        "projects:view",
        "tasks:manage",
        "site:manage",
        "materials:manage",
    },
    "client": {"portal:client", "approvals:decide"},
    "vendor": {"portal:vendor", "work_orders:update"},
}

WORKSPACE_ROLES = {
    "admin",
    "sales_manager",
    "interior_designer",
    "project_manager",
    "site_supervisor",
}


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer),
    db: Session = Depends(get_db),
) -> User:
    if not credentials:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Authentication required")
    try:
        user_id = uuid.UUID(decode_token(credentials.credentials)["sub"])
    except (jwt.InvalidTokenError, ValueError, KeyError):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or expired token") from None
    user = db.get(User, user_id)
    if not user or not user.is_active or user.deleted_at:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "User is inactive")
    return user


def require_permission(permission: str) -> Callable:
    def check(user: User = Depends(get_current_user)) -> User:
        allowed = ROLE_PERMISSIONS.get(user.role, set())
        if "*" not in allowed and permission not in allowed:
            raise HTTPException(status.HTTP_403_FORBIDDEN, f"Permission required: {permission}")
        return user

    return check


def require_workspace_user(user: User = Depends(get_current_user)) -> User:
    if user.role not in WORKSPACE_ROLES:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Studio workspace access required")
    return user
