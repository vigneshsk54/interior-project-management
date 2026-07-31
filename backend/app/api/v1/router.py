import json
import uuid
from csv import DictWriter
from datetime import UTC, date, datetime, time, timedelta
from io import StringIO
from pathlib import Path

from fastapi import (
    APIRouter,
    Depends,
    File,
    Header,
    HTTPException,
    Query,
    Request,
    UploadFile,
    status,
)
from fastapi.encoders import jsonable_encoder
from fastapi.responses import StreamingResponse
from sqlalchemy import func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.deps import (
    WORKSPACE_ROLES,
    get_current_user,
    require_permission,
    require_workspace_user,
)
from app.api.v1.auth import credential_service_error
from app.api.v1.auth import router as auth_router
from app.core.config import settings
from app.core.security import hash_password, valid_webhook_signature
from app.db.session import get_db
from app.models import (
    ApplicationSetting,
    Approval,
    AuditLog,
    Communication,
    Customer,
    Design,
    Document,
    Enquiry,
    EnquiryActivity,
    Material,
    Milestone,
    Notification,
    OperationalRecord,
    Project,
    Quotation,
    Task,
    User,
    Vendor,
    WebhookEvent,
    WorkflowExecution,
)
from app.schemas.domain import (
    ApprovalDecision,
    BulkAction,
    ClientAccountCreate,
    ClientEnquiryCreate,
    ClientMessageCreate,
    CommunicationStatusUpdate,
    CustomerCreate,
    CustomerOut,
    DesignCreate,
    EnquiryCreate,
    EnquiryMessageCreate,
    EnquiryOut,
    EnquiryUpdate,
    MaterialCreate,
    OperationalCreate,
    OperationalStatusUpdate,
    ProjectCreate,
    ProjectOut,
    QuotationCreate,
    QuotationOut,
    SettingUpdate,
    TaskCreate,
    TaskOut,
    TaskUpdate,
    TeamAccountCreate,
    UserOut,
    VendorCreate,
    is_valid_phone_number,
)
from app.services.credentials import (
    MONGO_CREDENTIAL_MARKER,
    CredentialAlreadyExists,
    CredentialStore,
    CredentialStoreUnavailable,
    get_credential_store,
)
from app.services.identity import contact_conflict_field
from app.services.quotations import approve_and_convert, create_quotation

api_router = APIRouter()
api_router.include_router(auth_router)


def paginate(db: Session, statement, page: int, page_size: int):
    total = db.scalar(select(func.count()).select_from(statement.order_by(None).subquery())) or 0
    items = db.scalars(statement.offset((page - 1) * page_size).limit(page_size)).all()
    return {"items": items, "total": total, "page": page, "page_size": page_size}


def ensure_unique_contact(
    db: Session,
    email: str,
    phone: str | None,
    *,
    exclude_user_id: uuid.UUID | None = None,
    exclude_customer_id: uuid.UUID | None = None,
) -> None:
    conflict = contact_conflict_field(
        db,
        email,
        phone,
        exclude_user_id=exclude_user_id,
        exclude_customer_id=exclude_customer_id,
    )
    if conflict:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            f"This {conflict} is already used by another account or client profile",
        )


def next_enquiry_reference(db: Session, created_on: date | None = None) -> str:
    year = (created_on or date.today()).year
    prefix = f"ENQ-{year}-"
    references = db.scalars(
        select(Enquiry.reference).where(Enquiry.reference.like(f"{prefix}%"))
    ).all()
    used_numbers = [
        int(reference.removeprefix(prefix))
        for reference in references
        if reference.startswith(prefix)
        and reference.removeprefix(prefix).isdigit()
    ]
    return f"{prefix}{max(used_numbers, default=0) + 1:04d}"


def next_client_enquiry_reference(
    db: Session,
    customer_id: uuid.UUID,
    created_on: date | None = None,
) -> str:
    year = (created_on or date.today()).year
    prefix = f"ENQ-{year}-"
    references = db.scalars(
        select(Enquiry.client_reference).where(
            Enquiry.customer_id == customer_id,
            Enquiry.client_reference.like(f"{prefix}%"),
        )
    ).all()
    used_numbers = [
        int(reference.removeprefix(prefix))
        for reference in references
        if reference.startswith(prefix)
        and reference.removeprefix(prefix).isdigit()
    ]
    return f"{prefix}{max(used_numbers, default=0) + 1:04d}"


def audit(db: Session, user: User, action: str, entity, after: dict | None = None):
    db.add(
        AuditLog(
            user_id=user.id,
            action=action,
            entity_type=entity.__class__.__name__.lower(),
            entity_id=entity.id,
            after=jsonable_encoder(after or entity),
        )
    )


def workspace_users(db: Session) -> list[User]:
    return list(
        db.scalars(
            select(User).where(
                User.role.in_(WORKSPACE_ROLES),
                User.is_active.is_(True),
                User.deleted_at.is_(None),
            )
        ).all()
    )


def enquiry_client(db: Session, enquiry: Enquiry) -> User | None:
    return db.scalar(
        select(User).where(
            func.lower(User.email) == enquiry.email.lower(),
            User.role == "client",
            User.is_active.is_(True),
            User.deleted_at.is_(None),
        )
    )


def notify_new_enquiry(db: Session, enquiry: Enquiry):
    for recipient in workspace_users(db):
        db.add(
            Notification(
                user_id=recipient.id,
                category="enquiry",
                title=f"New enquiry · {enquiry.reference}",
                message=f"{enquiry.contact_name} submitted “{enquiry.title}”.",
                link=f"/enquiries/{enquiry.id}",
            )
        )
    client_user = enquiry_client(db, enquiry)
    if client_user:
        db.add(
            Notification(
                user_id=client_user.id,
                category="enquiry",
                title="Enquiry received",
                message=(
                    f"Your request “{enquiry.title}” was received as "
                    f"{enquiry.client_reference}. "
                    "The studio team has been notified."
                ),
                link=f"/client-enquiries/{enquiry.id}",
            )
        )


def client_owns_enquiry(db: Session, user: User, enquiry: Enquiry) -> bool:
    if user.role != "client":
        return False
    if enquiry.email.lower() != user.email.lower():
        return False
    if not enquiry.customer_id:
        return True
    customer = db.get(Customer, enquiry.customer_id)
    return bool(
        customer
        and not customer.deleted_at
        and customer.email.lower() == user.email.lower()
    )


@api_router.get("/users", response_model=list[UserOut], tags=["Administration"])
def users(db: Session = Depends(get_db), _: User = Depends(require_permission("*"))):
    return db.scalars(select(User).where(User.deleted_at.is_(None)).order_by(User.full_name)).all()


@api_router.get("/profile/activity", tags=["Profile"])
def my_work_activity(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    enquiry_items = db.scalars(
        select(EnquiryActivity)
        .where(EnquiryActivity.user_id == user.id)
        .order_by(EnquiryActivity.created_at.desc())
        .limit(100)
    ).all()
    audit_items = db.scalars(
        select(AuditLog)
        .where(
            AuditLog.user_id == user.id,
            AuditLog.entity_type != "enquiry",
        )
        .order_by(AuditLog.created_at.desc())
        .limit(100)
    ).all()
    communication_statement = select(Communication)
    if user.role == "client":
        communication_statement = communication_statement.where(
            Communication.client_id == user.id
        )
    elif user.role not in WORKSPACE_ROLES:
        communication_statement = communication_statement.where(
            Communication.sender_id == user.id
        )
    communications = db.scalars(
        communication_statement.order_by(Communication.updated_at.desc()).limit(100)
    ).all()
    activities = []
    for item in enquiry_items:
        enquiry = db.get(Enquiry, item.enquiry_id)
        reference = (
            enquiry.client_reference
            if enquiry and user.role == "client"
            else enquiry.reference
            if enquiry
            else "Enquiry"
        )
        title = enquiry.title if enquiry else "Archived enquiry"
        activities.append(
            {
                "id": item.id,
                "action": item.activity_type,
                "title": f"{reference} · {title}",
                "description": item.message,
                "entity_type": "enquiry",
                "entity_id": item.enquiry_id,
                "link": (
                    f"/client-enquiries/{item.enquiry_id}"
                    if user.role == "client"
                    else f"/enquiries/{item.enquiry_id}"
                ),
                "details": item.metadata_json,
                "created_at": item.created_at,
            }
        )
    link_prefixes = {
        "customer": "/customers",
        "project": "/projects",
        "quotation": "/quotations",
    }
    for item in audit_items:
        label = item.action.replace(".", " ").replace("_", " ").title()
        prefix = None if user.role == "client" else link_prefixes.get(item.entity_type)
        activities.append(
            {
                "id": item.id,
                "action": item.action,
                "title": label,
                "description": f"{user.full_name} performed {label.lower()}.",
                "entity_type": item.entity_type,
                "entity_id": item.entity_id,
                "link": f"{prefix}/{item.entity_id}" if prefix and item.entity_id else None,
                "details": item.after,
                "created_at": item.created_at,
            }
        )
    activities.sort(key=lambda item: item["created_at"], reverse=True)
    messages = []
    for item in communications:
        sender = db.get(User, item.sender_id)
        client_user = db.get(User, item.client_id)
        updated_by = db.get(User, item.updated_by_id) if item.updated_by_id else None
        enquiry = db.get(Enquiry, item.enquiry_id) if item.enquiry_id else None
        subject = item.subject
        if enquiry:
            reference = (
                enquiry.client_reference if user.role == "client" else enquiry.reference
            )
            subject = f"Message about {reference}"
        messages.append(
            {
                "id": item.id,
                "subject": subject,
                "message": item.message,
                "status": item.status,
                "sender": {
                    "id": sender.id,
                    "full_name": sender.full_name,
                    "role": sender.role,
                }
                if sender
                else None,
                "client": {
                    "id": client_user.id,
                    "full_name": client_user.full_name,
                    "email": client_user.email,
                }
                if client_user
                else None,
                "updated_by": {
                    "id": updated_by.id,
                    "full_name": updated_by.full_name,
                }
                if updated_by
                else None,
                "enquiry_id": item.enquiry_id,
                "project_id": item.project_id,
                "created_at": item.created_at,
                "updated_at": item.updated_at,
                "completed_at": item.completed_at,
            }
        )
    return {
        "user": {
            "id": user.id,
            "full_name": user.full_name,
            "email": user.email,
            "phone": user.phone,
            "role": user.role,
        },
        "summary": {
            "total_actions": len(activities),
            "enquiry_messages": sum(
                item["action"] in {"team_message", "client_message"} for item in activities
            ),
            "status_updates": sum(item["action"] == "updated" for item in activities),
            "open_messages": sum(item.status != "completed" for item in communications),
        },
        "messages": messages,
        "activities": activities[:100],
    }


@api_router.patch("/communications/{communication_id}/status", tags=["Profile"])
def update_communication_status(
    communication_id: uuid.UUID,
    payload: CommunicationStatusUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    communication = db.get(Communication, communication_id)
    if not communication:
        raise HTTPException(404, "Message not found")
    if user.role == "client" and communication.client_id != user.id:
        raise HTTPException(403, "This message is not available to you")
    if user.role not in WORKSPACE_ROLES and user.role != "client":
        raise HTTPException(403, "Message access required")
    communication.status = payload.status
    communication.updated_by_id = user.id
    communication.completed_at = (
        datetime.now(UTC) if payload.status == "completed" else None
    )
    db.flush()
    if user.role == "client":
        recipients = db.scalars(
            select(User).where(
                User.role == "admin",
                User.is_active.is_(True),
                User.deleted_at.is_(None),
            )
        ).all()
        link = f"/profile?message={communication.id}"
    else:
        client_user = db.get(User, communication.client_id)
        recipients = [client_user] if client_user and client_user.is_active else []
        link = f"/client-activity?message={communication.id}"
    for recipient in recipients:
        db.add(
            Notification(
                user_id=recipient.id,
                category="communication_status",
                title=f"Message marked {payload.status.replace('_', ' ')}",
                message=f"{user.full_name} updated “{communication.subject}”.",
                link=link,
            )
        )
    audit(
        db,
        user,
        "communication.status_updated",
        communication,
        {"status": payload.status},
    )
    db.commit()
    db.refresh(communication)
    return communication


@api_router.post(
    "/users/clients",
    response_model=UserOut,
    status_code=status.HTTP_201_CREATED,
    tags=["Administration"],
)
def create_client_account(
    payload: ClientAccountCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_permission("*")),
    credentials: CredentialStore = Depends(get_credential_store),
):
    customer = db.get(Customer, payload.customer_id)
    if not customer or customer.deleted_at:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Customer not found")
    if not is_valid_phone_number(customer.phone):
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "Correct the customer phone number to exactly 10 digits before creating access",
        )

    email = customer.email.lower()
    ensure_unique_contact(
        db,
        email,
        customer.phone,
        exclude_customer_id=customer.id,
    )
    existing = db.scalar(select(User).where(User.email == email))
    if existing:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "A sign-in account already exists for this customer email",
        )

    account = User(
        email=email,
        full_name=customer.name,
        phone=customer.phone,
        password_hash=MONGO_CREDENTIAL_MARKER,
        role="client",
        is_active=True,
        is_verified=True,
    )
    db.add(account)
    db.flush()
    credential_created = False
    try:
        credentials.create(str(account.id), email, hash_password(payload.password))
        credential_created = True
    except CredentialStoreUnavailable as exc:
        db.rollback()
        raise credential_service_error(exc) from exc
    except CredentialAlreadyExists:
        db.rollback()
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "A sign-in credential already exists for this customer email",
        ) from None
    audit(
        db,
        admin,
        "client_account.created",
        account,
        {"id": account.id, "email": account.email, "role": account.role},
    )
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        if credential_created:
            credentials.delete(str(account.id), email)
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "A sign-in account already exists for this customer email",
        ) from None
    except Exception:
        db.rollback()
        if credential_created:
            credentials.delete(str(account.id), email)
        raise
    db.refresh(account)
    return account


@api_router.post(
    "/users/team",
    response_model=UserOut,
    status_code=status.HTTP_201_CREATED,
    tags=["Administration"],
)
def create_team_account(
    payload: TeamAccountCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_permission("*")),
    credentials: CredentialStore = Depends(get_credential_store),
):
    email = payload.email.lower()
    ensure_unique_contact(db, email, payload.phone)
    account = User(
        email=email,
        full_name=payload.full_name,
        phone=payload.phone,
        password_hash=MONGO_CREDENTIAL_MARKER,
        role=payload.role,
        is_active=True,
        is_verified=True,
    )
    db.add(account)
    db.flush()
    credential_created = False
    try:
        credentials.create(str(account.id), email, hash_password(payload.password))
        credential_created = True
    except CredentialStoreUnavailable as exc:
        db.rollback()
        raise credential_service_error(exc) from exc
    except CredentialAlreadyExists:
        db.rollback()
        raise HTTPException(
            status.HTTP_409_CONFLICT, "An account with this email already exists"
        ) from None
    audit(
        db,
        admin,
        "team_account.created",
        account,
        {"id": account.id, "email": account.email, "role": account.role},
    )
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        if credential_created:
            credentials.delete(str(account.id), email)
        raise HTTPException(
            status.HTTP_409_CONFLICT, "An account with this email already exists"
        ) from None
    except Exception:
        db.rollback()
        if credential_created:
            credentials.delete(str(account.id), email)
        raise
    db.refresh(account)
    return account


@api_router.get("/dashboard", tags=["Dashboard"])
def dashboard(
    db: Session = Depends(get_db),
    _: User = Depends(require_permission("dashboard:view")),
    date_from: date | None = None,
    date_to: date | None = None,
    team: str | None = None,
    location: str | None = None,
    project_manager: uuid.UUID | None = None,
    project_status: str | None = Query(None, alias="status"),
):
    today = datetime.now(UTC).date()
    period_start = date_from or today - timedelta(days=29)
    period_end = date_to or today
    if period_start > period_end:
        raise HTTPException(422, "date_from must be before or equal to date_to")

    start_at = datetime.combine(period_start, time.min, tzinfo=UTC)
    end_at = datetime.combine(period_end + timedelta(days=1), time.min, tzinfo=UTC)
    project_filters = [Project.deleted_at.is_(None)]
    enquiry_filters = [
        Enquiry.deleted_at.is_(None),
        Enquiry.created_at >= start_at,
        Enquiry.created_at < end_at,
    ]
    if project_status:
        project_filters.append(Project.status == project_status)
    if location:
        project_filters.append(Project.location.ilike(f"%{location}%"))
        enquiry_filters.append(Enquiry.location.ilike(f"%{location}%"))
    if project_manager:
        project_filters.append(Project.project_manager_id == project_manager)
        enquiry_filters.append(Enquiry.assigned_to_id == project_manager)

    filtered_project_ids = select(Project.id).where(*project_filters)
    task_filters = [Task.deleted_at.is_(None)]
    if project_status or location or project_manager:
        task_filters.append(Task.project_id.in_(filtered_project_ids))
    if team:
        assignee_ids = select(User.id).where(User.role == team, User.deleted_at.is_(None))
        task_filters.append(Task.assignee_id.in_(assignee_ids))

    active_projects = (
        db.scalar(
            select(func.count()).select_from(Project).where(
                *project_filters, Project.status == "active"
            )
        )
        or 0
    )
    new_enquiries = (
        db.scalar(
            select(func.count()).select_from(Enquiry).where(
                *enquiry_filters, Enquiry.status == "new"
            )
        )
        or 0
    )
    won = (
        db.scalar(
            select(func.count()).select_from(Enquiry).where(
                *enquiry_filters, Enquiry.status == "won"
            )
        )
        or 0
    )
    enquiries = (
        db.scalar(select(func.count()).select_from(Enquiry).where(*enquiry_filters)) or 0
    )
    client_schedule_filters = [
        Enquiry.deleted_at.is_(None),
        Enquiry.source == "Client portal",
        Enquiry.status.notin_(["won", "lost"]),
    ]
    if location:
        client_schedule_filters.append(Enquiry.location.ilike(f"%{location}%"))
    if project_manager:
        client_schedule_filters.append(
            Enquiry.assigned_to_id == project_manager
        )
    client_scheduled_projects = (
        db.scalar(
            select(func.count()).select_from(Enquiry).where(*client_schedule_filters)
        )
        or 0
    )
    overdue = (
        db.scalar(
            select(func.count()).select_from(Task).where(
                *task_filters, Task.due_date < today, Task.status != "completed"
            )
        )
        or 0
    )
    quoted = (
        db.scalar(
            select(func.coalesce(func.sum(Quotation.total), 0)).where(
                Quotation.deleted_at.is_(None),
                Quotation.created_at >= start_at,
                Quotation.created_at < end_at,
            )
        )
        or 0
    )
    confirmed = (
        db.scalar(
            select(func.coalesce(func.sum(Project.contract_value), 0)).where(
                *project_filters, Project.status == "active"
            )
        )
        or 0
    )
    at_risk = (
        db.scalar(
            select(func.count()).select_from(Project).where(
                *project_filters, Project.health.in_(["at_risk", "critical"])
            )
        )
        or 0
    )
    pending_approvals = (
        db.scalar(
            select(func.count()).select_from(Approval).where(Approval.status == "pending")
        )
        or 0
    )
    month_start = today.replace(day=1)
    next_month = (
        date(month_start.year + 1, 1, 1)
        if month_start.month == 12
        else date(month_start.year, month_start.month + 1, 1)
    )
    due_this_month = (
        db.scalar(
            select(func.count()).select_from(Project).where(
                *project_filters,
                Project.expected_completion_date >= month_start,
                Project.expected_completion_date < next_month,
            )
        )
        or 0
    )
    due_soon = (
        db.scalar(
            select(func.count()).select_from(Task).where(
                *task_filters,
                Task.status != "completed",
                Task.due_date >= today,
                Task.due_date <= today + timedelta(days=7),
            )
        )
        or 0
    )

    outstanding_statuses = ["pending", "overdue", "due", "invoiced"]
    collected_statuses = ["approved", "completed", "paid", "received"]
    payment_filters = [
        OperationalRecord.module == "payments",
        OperationalRecord.deleted_at.is_(None),
    ]
    if project_status or location or project_manager:
        payment_filters.append(OperationalRecord.project_id.in_(filtered_project_ids))
    outstanding_payments = (
        db.scalar(
            select(func.coalesce(func.sum(OperationalRecord.amount), 0)).where(
                *payment_filters, OperationalRecord.status.in_(outstanding_statuses)
            )
        )
        or 0
    )
    payment_milestones = (
        db.scalar(
            select(func.count()).select_from(OperationalRecord).where(
                *payment_filters, OperationalRecord.status.in_(outstanding_statuses)
            )
        )
        or 0
    )
    funnel = []
    for key in [
        "new",
        "contacted",
        "site_visit_scheduled",
        "requirement_collected",
        "quotation_sent",
        "negotiation",
        "won",
    ]:
        funnel.append(
            {
                "name": key.replace("_", " ").title(),
                "value": db.scalar(
                    select(func.count()).select_from(Enquiry).where(
                        *enquiry_filters, Enquiry.status == key
                    )
                )
                or 0,
            }
        )
    projects = db.scalars(
        select(Project)
        .where(*project_filters)
        .order_by(Project.updated_at.desc())
        .limit(6)
    ).all()
    tasks = db.scalars(
        select(Task)
        .where(*task_filters, Task.status != "completed")
        .order_by(Task.due_date)
        .limit(7)
    ).all()
    scheduled_projects = db.scalars(
        select(Enquiry)
        .where(*client_schedule_filters)
        .order_by(
            Enquiry.expected_start_date.is_(None),
            Enquiry.expected_start_date,
            Enquiry.created_at.desc(),
        )
        .limit(8)
    ).all()

    def shift_month(value: date, offset: int) -> date:
        month_index = value.year * 12 + value.month - 1 + offset
        return date(month_index // 12, month_index % 12 + 1, 1)

    revenue_months = [shift_month(month_start, offset) for offset in range(-5, 1)]
    revenue_by_month = {value: 0.0 for value in revenue_months}
    revenue_records = db.scalars(
        select(OperationalRecord).where(
            *payment_filters,
            OperationalRecord.status.in_(collected_statuses),
            OperationalRecord.created_at >= datetime.combine(
                revenue_months[0], time.min, tzinfo=UTC
            ),
            OperationalRecord.created_at < datetime.combine(next_month, time.min, tzinfo=UTC),
        )
    ).all()
    for record in revenue_records:
        record_month = record.created_at.date().replace(day=1)
        if record_month in revenue_by_month:
            revenue_by_month[record_month] += float(record.amount or 0) / 100000

    return {
        "metrics": {
            "active_projects": active_projects,
            "projects_due_this_month": due_this_month,
            "new_enquiries": new_enquiries,
            "client_scheduled_projects": client_scheduled_projects,
            "conversion_rate": round(won / enquiries * 100, 1) if enquiries else 0,
            "projects_at_risk": at_risk,
            "pending_approvals": pending_approvals,
            "overdue_tasks": overdue,
            "tasks_due_soon": due_soon,
            "total_quoted_value": quoted,
            "confirmed_project_value": confirmed,
            "outstanding_payments": outstanding_payments,
            "payment_milestones": payment_milestones,
        },
        "funnel": funnel,
        "revenue": [
            {"month": value.strftime("%b"), "value": round(revenue_by_month[value], 2)}
            for value in revenue_months
        ],
        "projects": projects,
        "deadlines": tasks,
        "scheduled_projects": [
            {
                "id": item.id,
                "reference": item.reference,
                "client_reference": item.client_reference,
                "title": item.title,
                "client_name": item.contact_name,
                "email": item.email,
                "property_type": item.property_type,
                "location": item.location,
                "expected_start_date": item.expected_start_date,
                "status": item.status,
                "created_at": item.created_at,
            }
            for item in scheduled_projects
        ],
    }


@api_router.get("/customers", tags=["Customers"])
def list_customers(
    search: str = "",
    page: int = 1,
    page_size: int = Query(20, le=100),
    db: Session = Depends(get_db),
    _: User = Depends(require_permission("customers:manage")),
):
    stmt = select(Customer).where(Customer.deleted_at.is_(None))
    if search:
        stmt = stmt.where(
            or_(Customer.name.ilike(f"%{search}%"), Customer.email.ilike(f"%{search}%"))
        )
    return paginate(db, stmt.order_by(Customer.created_at.desc()), page, page_size)


@api_router.post("/customers", response_model=CustomerOut, status_code=201, tags=["Customers"])
def add_customer(
    payload: CustomerCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("customers:manage")),
):
    data = payload.model_dump()
    ensure_unique_contact(db, str(data["email"]), data["phone"])
    customer = Customer(**data, owner_id=user.id)
    db.add(customer)
    db.flush()
    audit(db, user, "customer.created", customer)
    db.commit()
    db.refresh(customer)
    return customer


@api_router.get("/customers/{customer_id}", tags=["Customers"])
def customer_detail(
    customer_id: uuid.UUID,
    db: Session = Depends(get_db),
    _: User = Depends(require_permission("customers:manage")),
):
    customer = db.get(Customer, customer_id)
    if not customer or customer.deleted_at:
        raise HTTPException(404, "Customer not found")
    return {
        "customer": customer,
        "enquiries": db.scalars(select(Enquiry).where(Enquiry.customer_id == customer_id)).all(),
        "projects": db.scalars(select(Project).where(Project.customer_id == customer_id)).all(),
    }


@api_router.get("/enquiries", tags=["CRM"])
def list_enquiries(
    search: str = "",
    enquiry_status: str | None = Query(None, alias="status"),
    assigned_to: uuid.UUID | None = None,
    page: int = 1,
    page_size: int = Query(20, le=100),
    sort: str = "-created_at",
    db: Session = Depends(get_db),
    _: User = Depends(require_workspace_user),
):
    stmt = select(Enquiry).where(Enquiry.deleted_at.is_(None))
    if search:
        stmt = stmt.where(
            or_(
                Enquiry.title.ilike(f"%{search}%"),
                Enquiry.contact_name.ilike(f"%{search}%"),
                Enquiry.reference.ilike(f"%{search}%"),
                Enquiry.client_reference.ilike(f"%{search}%"),
            )
        )
    if enquiry_status:
        stmt = stmt.where(Enquiry.status == enquiry_status)
    if assigned_to:
        stmt = stmt.where(Enquiry.assigned_to_id == assigned_to)
    order = Enquiry.created_at.asc() if sort == "created_at" else Enquiry.created_at.desc()
    return paginate(db, stmt.order_by(order), page, page_size)


@api_router.post("/enquiries", response_model=EnquiryOut, status_code=201, tags=["CRM"])
def add_enquiry(
    payload: EnquiryCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_workspace_user),
):
    data = payload.model_dump()
    email = str(data["email"]).lower()
    customer = db.scalars(
        select(Customer).where(
            func.lower(Customer.email) == email,
            Customer.deleted_at.is_(None),
        )
    ).first()
    linked_user = db.scalar(
        select(User).where(func.lower(User.email) == email)
    )
    ensure_unique_contact(
        db,
        email,
        data["phone"],
        exclude_user_id=linked_user.id if linked_user else None,
        exclude_customer_id=customer.id if customer else None,
    )
    if not customer:
        customer = Customer(
            name=data["contact_name"],
            email=email,
            phone=data["phone"],
            owner_id=user.id,
        )
        db.add(customer)
        db.flush()
    data["email"] = email
    enquiry = Enquiry(
        reference=next_enquiry_reference(db),
        client_reference=next_client_enquiry_reference(db, customer.id),
        customer_id=customer.id,
        **data,
    )
    db.add(enquiry)
    db.flush()
    db.add(
        EnquiryActivity(
            enquiry_id=enquiry.id,
            user_id=user.id,
            activity_type="created",
            message="Enquiry created",
            metadata_json={
                "sender_name": user.full_name,
                "sender_role": user.role,
            },
        )
    )
    db.add(
        WorkflowExecution(
            workflow_name="new-enquiry",
            entity_type="enquiry",
            entity_id=enquiry.id,
            status="queued",
            payload={"email": enquiry.email},
        )
    )
    notify_new_enquiry(db, enquiry)
    audit(db, user, "enquiry.created", enquiry)
    db.commit()
    db.refresh(enquiry)
    return enquiry


@api_router.get("/enquiries/{enquiry_id}", tags=["CRM"])
def enquiry_detail(
    enquiry_id: uuid.UUID,
    db: Session = Depends(get_db),
    _: User = Depends(require_workspace_user),
):
    enquiry = db.get(Enquiry, enquiry_id)
    if not enquiry or enquiry.deleted_at:
        raise HTTPException(404, "Enquiry not found")
    return {
        "enquiry": enquiry,
        "activities": db.scalars(
            select(EnquiryActivity)
            .where(EnquiryActivity.enquiry_id == enquiry_id)
            .order_by(EnquiryActivity.created_at.desc())
        ).all(),
        "quotations": db.scalars(select(Quotation).where(Quotation.enquiry_id == enquiry_id)).all(),
    }


@api_router.post(
    "/enquiries/{enquiry_id}/messages",
    status_code=status.HTTP_201_CREATED,
    tags=["CRM"],
)
def send_enquiry_question(
    enquiry_id: uuid.UUID,
    payload: EnquiryMessageCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_workspace_user),
):
    enquiry = db.get(Enquiry, enquiry_id)
    if not enquiry or enquiry.deleted_at:
        raise HTTPException(404, "Enquiry not found")
    recipient = enquiry_client(db, enquiry)
    if not recipient:
        raise HTTPException(
            409,
            "This client does not have portal access yet. Create client access before messaging.",
        )
    communication = Communication(
        sender_id=user.id,
        client_id=recipient.id,
        enquiry_id=enquiry.id,
        subject=f"Question about {enquiry.reference}",
        message=payload.message,
    )
    db.add(communication)
    db.flush()
    activity = EnquiryActivity(
        enquiry_id=enquiry.id,
        user_id=user.id,
        activity_type="team_message",
        message=payload.message,
        metadata_json={
            "audience": "client",
            "sender_name": user.full_name,
            "sender_role": user.role,
        },
    )
    db.add(activity)
    db.flush()
    db.add(
        Notification(
            user_id=recipient.id,
            category="enquiry_message",
            title=f"Question about {enquiry.client_reference}",
            message=f"{user.full_name}: {payload.message}",
            link=f"/client-activity?message={communication.id}",
        )
    )
    audit(db, user, "enquiry.message_sent", enquiry, {"recipient_user_id": recipient.id})
    db.commit()
    db.refresh(activity)
    return activity


@api_router.patch("/enquiries/{enquiry_id}", response_model=EnquiryOut, tags=["CRM"])
def edit_enquiry(
    enquiry_id: uuid.UUID,
    payload: EnquiryUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(require_workspace_user),
):
    enquiry = db.get(Enquiry, enquiry_id)
    if not enquiry or enquiry.deleted_at:
        raise HTTPException(404, "Enquiry not found")
    data = payload.model_dump(exclude_unset=True)
    if user.role != "admin" and set(data) - {"status"}:
        raise HTTPException(403, "Team members can update only the enquiry status")
    if not data:
        raise HTTPException(422, "Provide at least one enquiry update")
    required_fields = {
        "title",
        "contact_name",
        "email",
        "phone",
        "property_type",
        "location",
        "requirements",
        "source",
        "status",
    }
    if any(data.get(key) is None for key in required_fields.intersection(data)):
        raise HTTPException(422, "Required enquiry fields cannot be empty")

    resulting_budget_min = data.get("budget_min", enquiry.budget_min)
    resulting_budget_max = data.get("budget_max", enquiry.budget_max)
    if (
        resulting_budget_min is not None
        and resulting_budget_max is not None
        and resulting_budget_min > resulting_budget_max
    ):
        raise HTTPException(422, "Minimum budget must not exceed maximum budget")

    old_email = enquiry.email.lower()
    if "email" in data:
        data["email"] = str(data["email"]).lower()
    new_email = data.get("email", old_email)
    customer = db.get(Customer, enquiry.customer_id) if enquiry.customer_id else None
    target_customer = customer
    if new_email != old_email:
        target_customer = db.scalars(
            select(Customer).where(
                func.lower(Customer.email) == new_email,
                Customer.deleted_at.is_(None),
            )
        ).first()
    linked_user = db.scalar(
        select(User).where(func.lower(User.email) == new_email)
    )
    ensure_unique_contact(
        db,
        new_email,
        data.get("phone", enquiry.phone),
        exclude_user_id=linked_user.id if linked_user else None,
        exclude_customer_id=target_customer.id if target_customer else None,
    )
    if new_email != old_email:
        if not target_customer:
            target_customer = Customer(
                name=data.get("contact_name", enquiry.contact_name),
                email=new_email,
                phone=data.get("phone", enquiry.phone),
                owner_id=user.id,
            )
            db.add(target_customer)
            db.flush()
        enquiry.customer_id = target_customer.id
        customer = target_customer
    if customer and customer.email.lower() == new_email:
        if "contact_name" in data:
            customer.name = data["contact_name"]
        if "phone" in data:
            customer.phone = data["phone"]

    for key, value in data.items():
        setattr(enquiry, key, value)
    changed = ", ".join(key.replace("_", " ") for key in data) or "details"
    db.add(
        EnquiryActivity(
            enquiry_id=enquiry.id,
            user_id=user.id,
            activity_type="updated",
            message=f"Enquiry updated: {changed}",
            metadata_json={
                "sender_name": user.full_name,
                "sender_role": user.role,
                "changed_fields": list(data),
            },
        )
    )
    if "status" in data:
        recipient = enquiry_client(db, enquiry)
        if recipient:
            db.add(
                Notification(
                    user_id=recipient.id,
                    category="enquiry",
                    title=f"Enquiry status updated · {enquiry.reference}",
                    message=(
                        f"{user.full_name} changed your enquiry status to "
                        f"{str(data['status']).replace('_', ' ')}."
                    ),
                    link=f"/client-enquiries/{enquiry.id}",
                )
            )
    audit(db, user, "enquiry.updated", enquiry, data)
    db.commit()
    db.refresh(enquiry)
    return enquiry


@api_router.post("/enquiries/bulk", tags=["CRM"])
def bulk_enquiries(
    payload: BulkAction,
    db: Session = Depends(get_db),
    user: User = Depends(require_workspace_user),
):
    if user.role != "admin" and payload.assigned_to_id:
        raise HTTPException(403, "Team members can update only the enquiry status")
    if not payload.status and not payload.assigned_to_id:
        raise HTTPException(422, "Provide a status or assignee update")
    items = db.scalars(select(Enquiry).where(Enquiry.id.in_(payload.ids))).all()
    for item in items:
        if payload.status:
            item.status = payload.status
            db.add(
                EnquiryActivity(
                    enquiry_id=item.id,
                    user_id=user.id,
                    activity_type="updated",
                    message="Enquiry updated: status",
                    metadata_json={
                        "sender_name": user.full_name,
                        "sender_role": user.role,
                        "changed_fields": ["status"],
                    },
                )
            )
        if payload.assigned_to_id:
            item.assigned_to_id = payload.assigned_to_id
        audit(
            db,
            user,
            "enquiry.updated",
            item,
            {
                "status": payload.status,
                "assigned_to_id": payload.assigned_to_id,
            },
        )
    db.commit()
    return {"updated": len(items)}


@api_router.get("/quotations", tags=["Quotations"])
def quotations(
    quote_status: str | None = Query(None, alias="status"),
    page: int = 1,
    page_size: int = 20,
    db: Session = Depends(get_db),
    _: User = Depends(require_permission("quotations:manage")),
):
    stmt = select(Quotation).where(Quotation.deleted_at.is_(None))
    if quote_status:
        stmt = stmt.where(Quotation.status == quote_status)
    return paginate(db, stmt.order_by(Quotation.created_at.desc()), page, page_size)


@api_router.post("/quotations", response_model=QuotationOut, status_code=201, tags=["Quotations"])
def add_quotation(
    payload: QuotationCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("quotations:manage")),
):
    try:
        quote = create_quotation(db, payload)
    except ValueError as exc:
        raise HTTPException(404, str(exc)) from exc
    audit(db, user, "quotation.created", quote)
    db.commit()
    return quote


@api_router.get("/quotations/{quote_id}", tags=["Quotations"])
def quotation_detail(
    quote_id: uuid.UUID,
    db: Session = Depends(get_db),
    _: User = Depends(require_permission("quotations:manage")),
):
    quote = db.get(Quotation, quote_id)
    if not quote or quote.deleted_at:
        raise HTTPException(404, "Quotation not found")
    from app.models import QuotationItem, QuotationVersion

    return {
        "quotation": quote,
        "items": db.scalars(
            select(QuotationItem).where(
                QuotationItem.quotation_id == quote_id,
                QuotationItem.version == quote.current_version,
            )
        ).all(),
        "versions": db.scalars(
            select(QuotationVersion).where(QuotationVersion.quotation_id == quote_id)
        ).all(),
    }


@api_router.post("/quotations/{quote_id}/approve", response_model=ProjectOut, tags=["Quotations"])
def approve_quotation(
    quote_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("quotations:manage")),
):
    quote = db.get(Quotation, quote_id)
    if not quote:
        raise HTTPException(404, "Quotation not found")
    project = approve_and_convert(db, quote)
    db.add(
        WorkflowExecution(
            workflow_name="quotation-approved",
            entity_type="quotation",
            entity_id=quote.id,
            status="queued",
            payload={"project_id": str(project.id)},
        )
    )
    audit(db, user, "quotation.approved", quote, {"project_id": str(project.id)})
    db.commit()
    return project


@api_router.get("/projects", tags=["Projects"])
def projects(
    project_status: str | None = Query(None, alias="status"),
    health: str | None = None,
    page: int = 1,
    page_size: int = 20,
    db: Session = Depends(get_db),
    _: User = Depends(require_workspace_user),
):
    stmt = select(Project).where(Project.deleted_at.is_(None))
    if project_status:
        stmt = stmt.where(Project.status == project_status)
    if health:
        stmt = stmt.where(Project.health == health)
    return paginate(db, stmt.order_by(Project.updated_at.desc()), page, page_size)


@api_router.post("/projects", response_model=ProjectOut, status_code=201, tags=["Projects"])
def add_project(
    payload: ProjectCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("projects:manage")),
):
    count = db.scalar(select(func.count()).select_from(Project)) or 0
    project = Project(code=f"PRJ-{date.today().year}-{count + 1:04d}", **payload.model_dump())
    db.add(project)
    db.flush()
    audit(db, user, "project.created", project)
    db.commit()
    db.refresh(project)
    return project


@api_router.get("/projects/{project_id}", tags=["Projects"])
def project_detail(
    project_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(require_workspace_user),
):
    project = db.get(Project, project_id)
    if not project or project.deleted_at:
        raise HTTPException(404, "Project not found")
    return {
        "project": project,
        "milestones": db.scalars(
            select(Milestone).where(Milestone.project_id == project_id).order_by(Milestone.due_date)
        ).all(),
        "tasks": db.scalars(
            select(Task)
            .where(Task.project_id == project_id, Task.deleted_at.is_(None))
            .order_by(Task.due_date)
        ).all(),
        "designs": db.scalars(
            select(Design).where(Design.project_id == project_id, Design.deleted_at.is_(None))
        ).all(),
        "documents": db.scalars(
            select(Document).where(Document.project_id == project_id, Document.deleted_at.is_(None))
        ).all(),
    }


@api_router.get("/tasks", tags=["Tasks"])
def tasks(
    task_status: str | None = Query(None, alias="status"),
    project_id: uuid.UUID | None = None,
    mine: bool = False,
    page: int = 1,
    page_size: int = 50,
    db: Session = Depends(get_db),
    user: User = Depends(require_workspace_user),
):
    stmt = select(Task).where(Task.deleted_at.is_(None))
    if task_status:
        stmt = stmt.where(Task.status == task_status)
    if project_id:
        stmt = stmt.where(Task.project_id == project_id)
    if mine:
        stmt = stmt.where(Task.assignee_id == user.id)
    return paginate(db, stmt.order_by(Task.due_date), page, page_size)


@api_router.post("/tasks", response_model=TaskOut, status_code=201, tags=["Tasks"])
def add_task(
    payload: TaskCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("tasks:manage")),
):
    task = Task(**payload.model_dump())
    db.add(task)
    db.flush()
    audit(db, user, "task.created", task)
    db.commit()
    db.refresh(task)
    return task


@api_router.patch("/tasks/{task_id}", response_model=TaskOut, tags=["Tasks"])
def edit_task(
    task_id: uuid.UUID,
    payload: TaskUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("tasks:manage")),
):
    task = db.get(Task, task_id)
    if not task or task.deleted_at:
        raise HTTPException(404, "Task not found")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(task, key, value)
    audit(db, user, "task.updated", task)
    db.commit()
    db.refresh(task)
    return task


@api_router.delete("/tasks/{task_id}", status_code=204, tags=["Tasks"])
def delete_task(
    task_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("tasks:manage")),
):
    task = db.get(Task, task_id)
    if not task:
        raise HTTPException(404, "Task not found")
    task.deleted_at = datetime.now(UTC)
    audit(db, user, "task.archived", task)
    db.commit()


MODULE_PATHS = {
    "site-visits": "site_visits",
    "procurement": "procurement",
    "site-reports": "site_reports",
    "budgets": "budgets",
    "invoices": "invoices",
    "payments": "payments",
}


@api_router.get("/site-visits", tags=["Operations"])
@api_router.get("/procurement", tags=["Operations"])
@api_router.get("/site-reports", tags=["Operations"])
@api_router.get("/budgets", tags=["Operations"])
@api_router.get("/invoices", tags=["Operations"])
@api_router.get("/payments", tags=["Operations"])
def operational_list(
    request: Request,
    record_status: str | None = Query(None, alias="status"),
    project_id: uuid.UUID | None = None,
    page: int = 1,
    page_size: int = 20,
    db: Session = Depends(get_db),
    _: User = Depends(require_workspace_user),
):
    module_name = request.url.path.rstrip("/").split("/")[-1]
    module = MODULE_PATHS[module_name]
    stmt = select(OperationalRecord).where(
        OperationalRecord.module == module, OperationalRecord.deleted_at.is_(None)
    )
    if record_status:
        stmt = stmt.where(OperationalRecord.status == record_status)
    if project_id:
        stmt = stmt.where(OperationalRecord.project_id == project_id)
    result = paginate(db, stmt.order_by(OperationalRecord.created_at.desc()), page, page_size)
    current_month = datetime.now(UTC).date().replace(day=1)
    current_month_at = datetime.combine(current_month, time.min, tzinfo=UTC)
    filtered_records = stmt.order_by(None).subquery()
    result["summary"] = {
        "total": result["total"],
        "attention": db.scalar(
            select(func.count()).select_from(filtered_records).where(
                filtered_records.c.status.in_(["overdue", "critical", "blocked", "rejected"])
            )
        )
        or 0,
        "completed": db.scalar(
            select(func.count()).select_from(filtered_records).where(
                filtered_records.c.status.in_(
                    ["approved", "completed", "paid", "received", "delivered"]
                ),
                filtered_records.c.updated_at >= current_month_at,
            )
        )
        or 0,
    }
    return result


@api_router.post("/site-visits", status_code=201, tags=["Operations"])
@api_router.post("/procurement", status_code=201, tags=["Operations"])
@api_router.post("/site-reports", status_code=201, tags=["Operations"])
@api_router.post("/budgets", status_code=201, tags=["Operations"])
@api_router.post("/invoices", status_code=201, tags=["Operations"])
@api_router.post("/payments", status_code=201, tags=["Operations"])
def operational_add(
    request: Request,
    payload: OperationalCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_workspace_user),
):
    module_name = request.url.path.rstrip("/").split("/")[-1]
    module = MODULE_PATHS[module_name]
    data = payload.model_dump()
    data["module"] = module
    record = OperationalRecord(**data, owner_id=user.id)
    db.add(record)
    db.flush()
    audit(db, user, f"{module}.created", record)
    db.commit()
    db.refresh(record)
    return record


@api_router.patch("/site-visits/{record_id}", tags=["Operations"])
@api_router.patch("/procurement/{record_id}", tags=["Operations"])
@api_router.patch("/site-reports/{record_id}", tags=["Operations"])
@api_router.patch("/budgets/{record_id}", tags=["Operations"])
@api_router.patch("/invoices/{record_id}", tags=["Operations"])
@api_router.patch("/payments/{record_id}", tags=["Operations"])
def operational_update(
    request: Request,
    record_id: uuid.UUID,
    payload: OperationalStatusUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(require_workspace_user),
):
    module_name = request.url.path.rstrip("/").split("/")[-2]
    module = MODULE_PATHS[module_name]
    record = db.get(OperationalRecord, record_id)
    if not record or record.module != module or record.deleted_at:
        raise HTTPException(404, "Record not found")
    record.status = payload.status
    audit(db, user, f"{module}.updated", record)
    db.commit()
    db.refresh(record)
    return record


@api_router.get("/vendors/list", tags=["Vendors"])
def vendor_list(
    search: str = "",
    db: Session = Depends(get_db),
    _: User = Depends(require_workspace_user),
):
    stmt = select(Vendor).where(Vendor.deleted_at.is_(None))
    if search:
        stmt = stmt.where(Vendor.name.ilike(f"%{search}%"))
    return db.scalars(stmt.order_by(Vendor.rating.desc())).all()


@api_router.post("/vendors", status_code=201, tags=["Vendors"])
def add_vendor(
    payload: VendorCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("vendors:manage")),
):
    vendor = Vendor(**payload.model_dump())
    db.add(vendor)
    db.flush()
    audit(db, user, "vendor.created", vendor)
    db.commit()
    db.refresh(vendor)
    return vendor


@api_router.get("/materials/list", tags=["Materials"])
def material_list(
    low_stock: bool = False,
    db: Session = Depends(get_db),
    _: User = Depends(require_workspace_user),
):
    stmt = select(Material).where(Material.deleted_at.is_(None))
    if low_stock:
        stmt = stmt.where(Material.stock_quantity <= Material.reorder_level)
    return db.scalars(stmt.order_by(Material.name)).all()


@api_router.post("/materials", status_code=201, tags=["Materials"])
def add_material(
    payload: MaterialCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("materials:manage")),
):
    if db.scalar(select(Material).where(Material.sku == payload.sku)):
        raise HTTPException(409, "A material with this SKU already exists")
    material = Material(**payload.model_dump())
    db.add(material)
    db.flush()
    audit(db, user, "material.created", material)
    db.commit()
    db.refresh(material)
    return material


@api_router.get("/designs/list", tags=["Designs"])
def design_list(
    project_id: uuid.UUID | None = None,
    db: Session = Depends(get_db),
    _: User = Depends(require_workspace_user),
):
    stmt = select(Design).where(Design.deleted_at.is_(None))
    if project_id:
        stmt = stmt.where(Design.project_id == project_id)
    return db.scalars(stmt.order_by(Design.updated_at.desc())).all()


@api_router.post("/designs", status_code=201, tags=["Designs"])
def add_design(
    payload: DesignCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("designs:manage")),
):
    if not db.get(Project, payload.project_id):
        raise HTTPException(404, "Project not found")
    design = Design(**payload.model_dump())
    db.add(design)
    db.flush()
    audit(db, user, "design.created", design)
    db.commit()
    db.refresh(design)
    return design


@api_router.post("/approvals/{approval_id}/decision", tags=["Approvals"])
def decide_approval(
    approval_id: uuid.UUID,
    payload: ApprovalDecision,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if payload.status not in {"approved", "rejected", "revision_requested"}:
        raise HTTPException(422, "Invalid decision")
    approval = db.get(Approval, approval_id)
    if not approval:
        raise HTTPException(404, "Approval not found")
    if user.role == "client" and approval.requested_from_id != user.id:
        raise HTTPException(403, "This approval is not assigned to you")
    approval.status = payload.status
    approval.comment = payload.comment
    approval.decided_at = datetime.now(UTC)
    audit(db, user, "approval.decided", approval)
    db.commit()
    return approval


@api_router.get("/documents/list", tags=["Documents"])
def documents(
    project_id: uuid.UUID | None = None,
    search: str = "",
    db: Session = Depends(get_db),
    _: User = Depends(require_workspace_user),
):
    stmt = select(Document).where(Document.deleted_at.is_(None))
    if project_id:
        stmt = stmt.where(Document.project_id == project_id)
    if search:
        stmt = stmt.where(Document.name.ilike(f"%{search}%"))
    return db.scalars(stmt.order_by(Document.created_at.desc())).all()


@api_router.post("/documents/upload", status_code=201, tags=["Documents"])
async def upload_document(
    file: UploadFile = File(...),
    project_id: uuid.UUID | None = None,
    category: str = "general",
    db: Session = Depends(get_db),
    user: User = Depends(require_workspace_user),
):
    allowed = {
        "application/pdf",
        "image/jpeg",
        "image/png",
        "image/webp",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }
    if file.content_type not in allowed:
        raise HTTPException(415, "Unsupported file type")
    content = await file.read(settings.max_upload_bytes + 1)
    if len(content) > settings.max_upload_bytes:
        raise HTTPException(413, "File is too large")
    safe_name = f"{uuid.uuid4()}-{Path(file.filename or 'upload').name}"
    upload_dir = Path(settings.upload_dir)
    upload_dir.mkdir(parents=True, exist_ok=True)
    path = upload_dir / safe_name
    path.write_bytes(content)
    doc = Document(
        name=Path(file.filename or "upload").name,
        file_url=f"/uploads/{safe_name}",
        mime_type=file.content_type,
        size_bytes=len(content),
        category=category,
        project_id=project_id,
        uploaded_by_id=user.id,
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)
    return doc


@api_router.get("/notifications/list", tags=["Notifications"])
def notification_list(
    unread_only: bool = False, db: Session = Depends(get_db), user: User = Depends(get_current_user)
):
    stmt = select(Notification).where(Notification.user_id == user.id)
    if unread_only:
        stmt = stmt.where(Notification.read_at.is_(None))
    return db.scalars(stmt.order_by(Notification.created_at.desc()).limit(100)).all()


@api_router.post("/notifications/{notification_id}/read", tags=["Notifications"])
def mark_read(
    notification_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    item = db.get(Notification, notification_id)
    if not item or item.user_id != user.id:
        raise HTTPException(404, "Notification not found")
    item.read_at = datetime.now(UTC)
    db.commit()
    return item


@api_router.post("/notifications/read-all", tags=["Notifications"])
def mark_all_read(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    items = db.scalars(
        select(Notification).where(Notification.user_id == user.id, Notification.read_at.is_(None))
    ).all()
    now = datetime.now(UTC)
    for item in items:
        item.read_at = now
    db.commit()
    return {"updated": len(items)}


@api_router.get("/reports/overview", tags=["Reports"])
def reports(db: Session = Depends(get_db), _: User = Depends(require_permission("dashboard:view"))):
    by_source = [
        {"source": source, "count": count}
        for source, count in db.execute(
            select(Enquiry.source, func.count())
            .where(Enquiry.deleted_at.is_(None))
            .group_by(Enquiry.source)
        ).all()
    ]
    vendor_performance = [
        {"name": name, "rating": float(rating), "on_time_rate": on_time}
        for name, rating, on_time in db.execute(
            select(Vendor.name, Vendor.rating, Vendor.on_time_rate)
            .where(Vendor.deleted_at.is_(None))
            .order_by(Vendor.rating.desc())
            .limit(10)
        ).all()
    ]
    payment_statuses = [
        {"status": payment_status, "count": count, "amount": float(amount or 0)}
        for payment_status, count, amount in db.execute(
            select(
                OperationalRecord.status,
                func.count(),
                func.coalesce(func.sum(OperationalRecord.amount), 0),
            )
            .where(
                OperationalRecord.module == "payments",
                OperationalRecord.deleted_at.is_(None),
            )
            .group_by(OperationalRecord.status)
            .order_by(OperationalRecord.status)
        ).all()
    ]
    return {
        "lead_sources": by_source,
        "vendor_performance": vendor_performance,
        "payment_statuses": payment_statuses,
        "exports": {"csv": "/api/v1/reports/export.csv", "pdf": "/api/v1/reports/export.pdf"},
    }


@api_router.get("/reports/export.csv", tags=["Reports"])
def export_report_csv(
    db: Session = Depends(get_db),
    _: User = Depends(require_permission("dashboard:view")),
):
    output = StringIO()
    writer = DictWriter(
        output,
        fieldnames=[
            "project_code",
            "project_name",
            "status",
            "stage",
            "health",
            "progress",
            "contract_value",
            "budget",
            "expected_completion",
        ],
    )
    writer.writeheader()
    for project in db.scalars(
        select(Project).where(Project.deleted_at.is_(None)).order_by(Project.code)
    ):
        writer.writerow(
            {
                "project_code": project.code,
                "project_name": project.name,
                "status": project.status,
                "stage": project.stage,
                "health": project.health,
                "progress": project.progress,
                "contract_value": project.contract_value,
                "budget": project.budget,
                "expected_completion": project.expected_completion_date or "",
            }
        )
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="atelier-flow-project-report.csv"'},
    )


@api_router.get("/settings/list", tags=["Administration"])
def settings_list(db: Session = Depends(get_db), _: User = Depends(require_permission("*"))):
    return db.scalars(select(ApplicationSetting).order_by(ApplicationSetting.key)).all()


@api_router.put("/settings/{key}", tags=["Administration"])
def save_setting(
    key: str,
    payload: SettingUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("*")),
):
    setting = db.scalar(select(ApplicationSetting).where(ApplicationSetting.key == key))
    if setting:
        setting.value = payload.value
    else:
        setting = ApplicationSetting(key=key, value=payload.value)
        db.add(setting)
    db.flush()
    audit(db, user, "setting.updated", setting, payload.value)
    db.commit()
    db.refresh(setting)
    return setting


@api_router.get("/portal/client", tags=["Portals"])
def client_portal(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    if user.role not in {"client", "admin"}:
        raise HTTPException(403, "Client access required")
    customers = (
        db.scalars(select(Customer).where(Customer.email == user.email)).all()
        if user.role == "client"
        else db.scalars(select(Customer).limit(1)).all()
    )
    customer_ids = [item.id for item in customers]
    enquiries = (
        db.scalars(
            select(Enquiry)
            .where(
                Enquiry.customer_id.in_(customer_ids),
                Enquiry.deleted_at.is_(None),
            )
            .order_by(Enquiry.created_at.desc())
        ).all()
        if customer_ids
        else []
    )
    projects = (
        db.scalars(select(Project).where(Project.customer_id.in_(customer_ids))).all()
        if customer_ids
        else []
    )
    return {
        "customer": customers[0] if customers else None,
        "enquiries": enquiries,
        "projects": projects,
        "approvals": db.scalars(
            select(Approval).where(
                Approval.requested_from_id == user.id, Approval.status == "pending"
            )
        ).all(),
        "notifications": db.scalars(
            select(Notification)
            .where(Notification.user_id == user.id)
            .order_by(Notification.created_at.desc())
            .limit(10)
        ).all(),
    }


@api_router.post(
    "/portal/client/enquiries",
    response_model=EnquiryOut,
    status_code=status.HTTP_201_CREATED,
    tags=["Portals"],
)
def create_client_enquiry(
    payload: ClientEnquiryCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if user.role != "client":
        raise HTTPException(403, "Client access required")
    customer = db.scalar(
        select(Customer).where(
            Customer.email == user.email,
            Customer.deleted_at.is_(None),
        )
    )
    if not customer:
        raise HTTPException(404, "Client profile not found")

    enquiry = Enquiry(
        reference=next_enquiry_reference(db),
        client_reference=next_client_enquiry_reference(db, customer.id),
        customer_id=customer.id,
        contact_name=user.full_name,
        email=user.email,
        phone=user.phone or customer.phone,
        source="Client portal",
        status="new",
        **payload.model_dump(),
    )
    db.add(enquiry)
    db.flush()
    db.add(
        EnquiryActivity(
            enquiry_id=enquiry.id,
            user_id=user.id,
            activity_type="created",
            message="Project request submitted through the client portal",
            metadata_json={
                "sender_name": user.full_name,
                "sender_role": user.role,
            },
        )
    )
    db.add(
        WorkflowExecution(
            workflow_name="new-enquiry",
            entity_type="enquiry",
            entity_id=enquiry.id,
            status="queued",
            payload={"email": enquiry.email, "source": "client-portal"},
        )
    )
    notify_new_enquiry(db, enquiry)
    audit(db, user, "enquiry.client_submitted", enquiry)
    db.commit()
    db.refresh(enquiry)
    return enquiry


@api_router.get("/portal/client/enquiries/{enquiry_id}", tags=["Portals"])
def client_enquiry_detail(
    enquiry_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    enquiry = db.get(Enquiry, enquiry_id)
    if not enquiry or enquiry.deleted_at:
        raise HTTPException(404, "Enquiry not found")
    if not client_owns_enquiry(db, user, enquiry):
        raise HTTPException(403, "You can only view your own enquiries")
    messages = db.scalars(
        select(EnquiryActivity)
        .where(
            EnquiryActivity.enquiry_id == enquiry.id,
            EnquiryActivity.activity_type.in_(("client_message", "team_message")),
        )
        .order_by(EnquiryActivity.created_at)
    ).all()
    return {"enquiry": enquiry, "messages": messages}


@api_router.post(
    "/portal/client/enquiries/{enquiry_id}/messages",
    status_code=status.HTTP_201_CREATED,
    tags=["Portals"],
)
def send_client_enquiry_message(
    enquiry_id: uuid.UUID,
    payload: EnquiryMessageCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    enquiry = db.get(Enquiry, enquiry_id)
    if not enquiry or enquiry.deleted_at:
        raise HTTPException(404, "Enquiry not found")
    if not client_owns_enquiry(db, user, enquiry):
        raise HTTPException(403, "You can only message about your own enquiries")
    activity = EnquiryActivity(
        enquiry_id=enquiry.id,
        user_id=user.id,
        activity_type="client_message",
        message=payload.message,
        metadata_json={
            "audience": "workspace",
            "sender_name": user.full_name,
            "sender_role": "client",
        },
    )
    db.add(activity)
    db.flush()
    communication = Communication(
        sender_id=user.id,
        client_id=user.id,
        enquiry_id=enquiry.id,
        subject=f"Reply about {enquiry.reference}",
        message=payload.message,
    )
    db.add(communication)
    db.flush()
    for recipient in workspace_users(db):
        db.add(
            Notification(
                user_id=recipient.id,
                category="enquiry_message",
                title=f"Client replied · {enquiry.reference}",
                message=f"{user.full_name}: {payload.message}",
                link=f"/profile?message={communication.id}",
            )
        )
    audit(db, user, "enquiry.client_message_sent", enquiry)
    db.commit()
    db.refresh(activity)
    return activity


@api_router.get("/portal/client/projects/{project_id}", tags=["Portals"])
def client_project_progress(
    project_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if user.role not in {"client", "admin"}:
        raise HTTPException(403, "Client access required")
    project = db.get(Project, project_id)
    if not project or project.deleted_at:
        raise HTTPException(404, "Project not found")
    if user.role == "client":
        customer = db.scalar(
            select(Customer).where(
                Customer.id == project.customer_id,
                Customer.email == user.email,
                Customer.deleted_at.is_(None),
            )
        )
        if not customer:
            raise HTTPException(403, "This project is not available to you")
    milestones = db.scalars(
        select(Milestone).where(Milestone.project_id == project_id).order_by(Milestone.due_date)
    ).all()
    designs = db.scalars(
        select(Design).where(
            Design.project_id == project_id,
            Design.deleted_at.is_(None),
            Design.status.in_(["pending_approval", "approved", "revision_requested"]),
        )
    ).all()
    return {
        "project": {
            "id": project.id,
            "code": project.code,
            "name": project.name,
            "status": project.status,
            "stage": project.stage,
            "health": project.health,
            "progress": project.progress,
            "location": project.location,
            "start_date": project.start_date,
            "expected_completion_date": project.expected_completion_date,
        },
        "milestones": [
            {
                "id": item.id,
                "title": item.title,
                "status": item.status,
                "due_date": item.due_date,
                "progress": item.progress,
            }
            for item in milestones
        ],
        "designs": [
            {
                "id": item.id,
                "title": item.title,
                "room": item.room,
                "stage": item.stage,
                "status": item.status,
            }
            for item in designs
        ],
    }


@api_router.post("/portal/client/messages", status_code=201, tags=["Portals"])
def create_client_message(
    payload: ClientMessageCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if user.role != "client":
        raise HTTPException(403, "Client access required")
    customer = db.scalar(
        select(Customer).where(
            Customer.email == user.email,
            Customer.deleted_at.is_(None),
        )
    )
    if not customer:
        raise HTTPException(404, "Client profile not found")
    if payload.project_id:
        project = db.get(Project, payload.project_id)
        if not project or project.customer_id != customer.id or project.deleted_at:
            raise HTTPException(403, "This project is not available to you")

    admins = db.scalars(
        select(User).where(
            User.role == "admin",
            User.is_active.is_(True),
            User.deleted_at.is_(None),
        )
    ).all()
    communication = Communication(
        sender_id=user.id,
        client_id=user.id,
        project_id=payload.project_id,
        subject=payload.subject,
        message=payload.message,
    )
    db.add(communication)
    db.flush()
    for admin in admins:
        db.add(
            Notification(
                user_id=admin.id,
                category="client_message",
                title=f"Client message: {payload.subject}",
                message=f"{user.full_name}: {payload.message}",
                link=f"/profile?message={communication.id}",
            )
        )
    db.flush()
    db.add(
        AuditLog(
            user_id=user.id,
            action="client.message_sent",
            entity_type="customer",
            entity_id=customer.id,
            after={
                "subject": payload.subject,
                "message": payload.message,
                "project_id": str(payload.project_id) if payload.project_id else None,
                "recipient_count": len(admins),
            },
        )
    )
    db.commit()
    return {"message": "Your message has been sent to the studio", "recipients": len(admins)}


@api_router.get("/portal/vendor", tags=["Portals"])
def vendor_portal(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    if user.role not in {"vendor", "admin"}:
        raise HTTPException(403, "Vendor access required")
    vendor = (
        db.scalar(select(Vendor).where(Vendor.email == user.email))
        if user.role == "vendor"
        else db.scalar(select(Vendor))
    )
    records = (
        db.scalars(select(OperationalRecord).where(OperationalRecord.vendor_id == vendor.id)).all()
        if vendor
        else []
    )
    return {"vendor": vendor, "work_orders": records}


@api_router.patch("/portal/vendor/work-orders/{record_id}", tags=["Portals"])
def vendor_work_order_update(
    record_id: uuid.UUID,
    payload: OperationalStatusUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if user.role not in {"vendor", "admin"}:
        raise HTTPException(403, "Vendor access required")
    vendor = (
        db.scalar(select(Vendor).where(Vendor.email == user.email))
        if user.role == "vendor"
        else None
    )
    record = db.get(OperationalRecord, record_id)
    if not record or (vendor and record.vendor_id != vendor.id):
        raise HTTPException(404, "Work order not found")
    if payload.status not in {
        "pending",
        "accepted",
        "in_progress",
        "dispatched",
        "delivered",
        "completed",
    }:
        raise HTTPException(422, "Invalid work-order status")
    record.status = payload.status
    audit(db, user, "vendor.work_order.updated", record)
    db.commit()
    db.refresh(record)
    return record


@api_router.post("/webhooks/n8n", tags=["Automation"])
async def n8n_webhook(
    request: Request,
    x_webhook_signature: str | None = Header(None),
    idempotency_key: str = Header(..., alias="Idempotency-Key"),
    db: Session = Depends(get_db),
):
    body = await request.body()
    if not valid_webhook_signature(body, x_webhook_signature):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid webhook signature")
    existing = db.scalar(
        select(WebhookEvent).where(WebhookEvent.idempotency_key == idempotency_key)
    )
    if existing:
        return {"duplicate": True, **existing.response}
    try:
        payload = json.loads(body)
    except json.JSONDecodeError as exc:
        raise HTTPException(400, "Invalid JSON") from exc
    event = WebhookEvent(
        idempotency_key=idempotency_key,
        event_type=payload.get("event_type", "unknown"),
        payload=payload,
    )
    db.add(event)
    db.flush()
    response = {"accepted": True, "event_id": str(event.id)}
    event.processed_at = datetime.now(UTC)
    event.response = response
    raw_entity_id = payload.get("entity_id")
    try:
        entity_id = uuid.UUID(raw_entity_id) if raw_entity_id else None
    except (TypeError, ValueError):
        entity_id = None
    db.add(
        WorkflowExecution(
            workflow_name=payload.get("workflow", "n8n-callback"),
            entity_type=payload.get("entity_type", "unknown"),
            entity_id=entity_id,
            status=payload.get("status", "completed"),
            payload=payload,
            completed_at=datetime.now(UTC),
        )
    )
    db.commit()
    return response
