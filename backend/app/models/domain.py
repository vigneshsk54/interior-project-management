import uuid
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import (
    JSON,
    Boolean,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    Uuid,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class SoftDeleteMixin:
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class Role(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "roles"
    name: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    description: Mapped[str] = mapped_column(String(255), default="")


class Permission(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "permissions"
    code: Mapped[str] = mapped_column(String(80), unique=True, index=True)
    description: Mapped[str] = mapped_column(String(255), default="")


class RolePermission(Base):
    __tablename__ = "role_permissions"
    role_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("roles.id", ondelete="CASCADE"), primary_key=True
    )
    permission_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("permissions.id", ondelete="CASCADE"), primary_key=True
    )


class UserRole(Base):
    __tablename__ = "user_roles"
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    role_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("roles.id", ondelete="CASCADE"), primary_key=True
    )


class User(UUIDPrimaryKeyMixin, TimestampMixin, SoftDeleteMixin, Base):
    __tablename__ = "users"
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    full_name: Mapped[str] = mapped_column(String(120))
    password_hash: Mapped[str] = mapped_column(String(255))
    role: Mapped[str] = mapped_column(String(40), index=True, default="client")
    phone: Mapped[str | None] = mapped_column(String(30))
    avatar_url: Mapped[str | None] = mapped_column(String(500))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    is_verified: Mapped[bool] = mapped_column(Boolean, default=True)
    __table_args__ = (
        Index(
            "uq_users_valid_phone",
            "phone",
            unique=True,
            sqlite_where=text(
                "length(phone) = 10 AND phone NOT GLOB '*[^0-9]*'"
            ),
            postgresql_where=text("phone ~ '^[0-9]{10}$'"),
        ),
    )


class RefreshToken(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "refresh_tokens"
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    token_hash: Mapped[str] = mapped_column(String(64), unique=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class Customer(UUIDPrimaryKeyMixin, TimestampMixin, SoftDeleteMixin, Base):
    __tablename__ = "customers"
    name: Mapped[str] = mapped_column(String(140), index=True)
    email: Mapped[str] = mapped_column(String(255), index=True)
    phone: Mapped[str] = mapped_column(String(30))
    company: Mapped[str | None] = mapped_column(String(140))
    billing_address: Mapped[str | None] = mapped_column(Text)
    tags: Mapped[list] = mapped_column(JSON, default=list)
    notes: Mapped[str] = mapped_column(Text, default="")
    owner_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"), index=True)
    __table_args__ = (
        UniqueConstraint("email", name="uq_customers_email"),
        UniqueConstraint("phone", name="uq_customers_phone"),
    )


class CustomerContact(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "customer_contacts"
    customer_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("customers.id", ondelete="CASCADE"), index=True
    )
    name: Mapped[str] = mapped_column(String(140))
    email: Mapped[str | None] = mapped_column(String(255))
    phone: Mapped[str | None] = mapped_column(String(30))
    designation: Mapped[str | None] = mapped_column(String(80))
    is_primary: Mapped[bool] = mapped_column(Boolean, default=False)


class Property(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "properties"
    customer_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("customers.id", ondelete="CASCADE"), index=True
    )
    name: Mapped[str] = mapped_column(String(140))
    property_type: Mapped[str] = mapped_column(String(60))
    address: Mapped[str] = mapped_column(Text)
    city: Mapped[str] = mapped_column(String(80), index=True)
    area_sqft: Mapped[Decimal | None] = mapped_column(Numeric(12, 2))


class Enquiry(UUIDPrimaryKeyMixin, TimestampMixin, SoftDeleteMixin, Base):
    __tablename__ = "enquiries"
    reference: Mapped[str] = mapped_column(String(30), unique=True, index=True)
    client_reference: Mapped[str] = mapped_column(String(30), index=True)
    title: Mapped[str] = mapped_column(String(180), index=True)
    customer_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("customers.id"), index=True)
    contact_name: Mapped[str] = mapped_column(String(140))
    email: Mapped[str] = mapped_column(String(255), index=True)
    phone: Mapped[str] = mapped_column(String(30))
    property_type: Mapped[str] = mapped_column(String(60))
    location: Mapped[str] = mapped_column(String(180), index=True)
    area_sqft: Mapped[Decimal | None] = mapped_column(Numeric(12, 2))
    budget_min: Mapped[Decimal | None] = mapped_column(Numeric(14, 2))
    budget_max: Mapped[Decimal | None] = mapped_column(Numeric(14, 2))
    expected_start_date: Mapped[date | None] = mapped_column(Date)
    requirements: Mapped[str] = mapped_column(Text, default="")
    source: Mapped[str] = mapped_column(String(60), default="Website", index=True)
    status: Mapped[str] = mapped_column(String(40), default="new", index=True)
    assigned_to_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"), index=True)
    last_contacted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    __table_args__ = (
        Index("ix_enquiries_status_assignee", "status", "assigned_to_id"),
        UniqueConstraint(
            "customer_id",
            "client_reference",
            name="uq_enquiries_customer_client_reference",
        ),
    )


class EnquiryActivity(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "enquiry_activities"
    enquiry_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("enquiries.id", ondelete="CASCADE"), index=True
    )
    user_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"))
    activity_type: Mapped[str] = mapped_column(String(60))
    message: Mapped[str] = mapped_column(Text)
    metadata_json: Mapped[dict] = mapped_column(JSON, default=dict)


class FollowUp(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "follow_ups"
    enquiry_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("enquiries.id", ondelete="CASCADE"), index=True
    )
    assigned_to_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), index=True)
    due_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    note: Mapped[str] = mapped_column(Text, default="")
    status: Mapped[str] = mapped_column(String(30), default="pending", index=True)


class SiteVisit(UUIDPrimaryKeyMixin, TimestampMixin, SoftDeleteMixin, Base):
    __tablename__ = "site_visits"
    enquiry_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("enquiries.id"), index=True)
    project_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("projects.id"), index=True)
    assigned_to_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"), index=True)
    scheduled_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    address: Mapped[str] = mapped_column(Text)
    contact_person: Mapped[str] = mapped_column(String(140))
    status: Mapped[str] = mapped_column(String(30), default="scheduled", index=True)
    checklist: Mapped[list] = mapped_column(JSON, default=list)
    measurements: Mapped[dict] = mapped_column(JSON, default=dict)
    notes: Mapped[str] = mapped_column(Text, default="")


class Quotation(UUIDPrimaryKeyMixin, TimestampMixin, SoftDeleteMixin, Base):
    __tablename__ = "quotations"
    number: Mapped[str] = mapped_column(String(30), unique=True, index=True)
    enquiry_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("enquiries.id"), index=True)
    customer_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("customers.id"), index=True)
    title: Mapped[str] = mapped_column(String(180))
    status: Mapped[str] = mapped_column(String(30), default="draft", index=True)
    current_version: Mapped[int] = mapped_column(Integer, default=1)
    subtotal: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=0)
    tax: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=0)
    discount: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=0)
    total: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=0)
    valid_until: Mapped[date | None] = mapped_column(Date, index=True)
    approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class QuotationVersion(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "quotation_versions"
    quotation_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("quotations.id", ondelete="CASCADE"), index=True
    )
    version: Mapped[int] = mapped_column(Integer)
    notes: Mapped[str] = mapped_column(Text, default="")
    subtotal: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=0)
    tax: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=0)
    discount: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=0)
    total: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=0)
    __table_args__ = (UniqueConstraint("quotation_id", "version"),)


class QuotationItem(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "quotation_items"
    quotation_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("quotations.id", ondelete="CASCADE"), index=True
    )
    version: Mapped[int] = mapped_column(Integer, default=1)
    room: Mapped[str] = mapped_column(String(80))
    category: Mapped[str] = mapped_column(String(80))
    description: Mapped[str] = mapped_column(Text)
    quantity: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    unit: Mapped[str] = mapped_column(String(30))
    rate: Mapped[Decimal] = mapped_column(Numeric(14, 2))
    tax_rate: Mapped[Decimal] = mapped_column(Numeric(6, 2), default=18)
    margin_rate: Mapped[Decimal] = mapped_column(Numeric(6, 2), default=0)


class Project(UUIDPrimaryKeyMixin, TimestampMixin, SoftDeleteMixin, Base):
    __tablename__ = "projects"
    code: Mapped[str] = mapped_column(String(30), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(180), index=True)
    customer_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("customers.id"), index=True)
    enquiry_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("enquiries.id"), index=True)
    quotation_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("quotations.id"), unique=True)
    project_manager_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"), index=True)
    status: Mapped[str] = mapped_column(String(30), default="active", index=True)
    stage: Mapped[str] = mapped_column(String(40), default="planning", index=True)
    health: Mapped[str] = mapped_column(String(20), default="on_track", index=True)
    progress: Mapped[int] = mapped_column(Integer, default=0)
    start_date: Mapped[date | None] = mapped_column(Date)
    expected_completion_date: Mapped[date | None] = mapped_column(Date, index=True)
    contract_value: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=0)
    budget: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=0)
    location: Mapped[str] = mapped_column(String(180), default="")


class ProjectMember(Base):
    __tablename__ = "project_members"
    project_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"), primary_key=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    role: Mapped[str] = mapped_column(String(50), default="member")


class ProjectStage(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "project_stages"
    project_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"), index=True
    )
    name: Mapped[str] = mapped_column(String(80))
    sequence: Mapped[int] = mapped_column(Integer)
    status: Mapped[str] = mapped_column(String(30), default="pending")
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class Milestone(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "milestones"
    project_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"), index=True
    )
    title: Mapped[str] = mapped_column(String(180))
    status: Mapped[str] = mapped_column(String(30), default="pending", index=True)
    due_date: Mapped[date] = mapped_column(Date, index=True)
    progress: Mapped[int] = mapped_column(Integer, default=0)


class Task(UUIDPrimaryKeyMixin, TimestampMixin, SoftDeleteMixin, Base):
    __tablename__ = "tasks"
    project_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("projects.id"), index=True)
    enquiry_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("enquiries.id"), index=True)
    milestone_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("milestones.id"), index=True)
    vendor_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("vendors.id"), index=True)
    title: Mapped[str] = mapped_column(String(180), index=True)
    description: Mapped[str] = mapped_column(Text, default="")
    assignee_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"), index=True)
    status: Mapped[str] = mapped_column(String(30), default="to_do", index=True)
    priority: Mapped[str] = mapped_column(String(20), default="medium", index=True)
    start_date: Mapped[date | None] = mapped_column(Date)
    due_date: Mapped[date | None] = mapped_column(Date, index=True)
    estimated_hours: Mapped[Decimal | None] = mapped_column(Numeric(8, 2))
    actual_hours: Mapped[Decimal | None] = mapped_column(Numeric(8, 2))
    __table_args__ = (Index("ix_tasks_status_due", "status", "due_date"),)


class TaskDependency(Base):
    __tablename__ = "task_dependencies"
    task_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("tasks.id", ondelete="CASCADE"), primary_key=True
    )
    depends_on_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("tasks.id", ondelete="CASCADE"), primary_key=True
    )


class TaskComment(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "task_comments"
    task_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("tasks.id", ondelete="CASCADE"), index=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    body: Mapped[str] = mapped_column(Text)


class TaskChecklist(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "task_checklists"
    task_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("tasks.id", ondelete="CASCADE"), index=True
    )
    label: Mapped[str] = mapped_column(String(180))
    is_complete: Mapped[bool] = mapped_column(Boolean, default=False)


class Vendor(UUIDPrimaryKeyMixin, TimestampMixin, SoftDeleteMixin, Base):
    __tablename__ = "vendors"
    name: Mapped[str] = mapped_column(String(180), index=True)
    category: Mapped[str] = mapped_column(String(80), index=True)
    email: Mapped[str] = mapped_column(String(255))
    phone: Mapped[str] = mapped_column(String(30))
    tax_id: Mapped[str | None] = mapped_column(String(50))
    rating: Mapped[Decimal] = mapped_column(Numeric(3, 2), default=0)
    on_time_rate: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[str] = mapped_column(String(30), default="active", index=True)


class Material(UUIDPrimaryKeyMixin, TimestampMixin, SoftDeleteMixin, Base):
    __tablename__ = "materials"
    sku: Mapped[str] = mapped_column(String(60), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(180), index=True)
    category: Mapped[str] = mapped_column(String(80), index=True)
    brand: Mapped[str | None] = mapped_column(String(100))
    unit: Mapped[str] = mapped_column(String(30))
    unit_price: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=0)
    stock_quantity: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=0)
    reorder_level: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=0)
    vendor_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("vendors.id"), index=True)


class Design(UUIDPrimaryKeyMixin, TimestampMixin, SoftDeleteMixin, Base):
    __tablename__ = "designs"
    project_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("projects.id"), index=True)
    room: Mapped[str] = mapped_column(String(80), index=True)
    stage: Mapped[str] = mapped_column(String(60), index=True)
    title: Mapped[str] = mapped_column(String(180))
    current_version: Mapped[int] = mapped_column(Integer, default=1)
    status: Mapped[str] = mapped_column(String(30), default="draft", index=True)


class DesignVersion(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "design_versions"
    design_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("designs.id", ondelete="CASCADE"), index=True
    )
    version: Mapped[int] = mapped_column(Integer)
    file_url: Mapped[str] = mapped_column(String(500))
    notes: Mapped[str] = mapped_column(Text, default="")
    created_by_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    __table_args__ = (UniqueConstraint("design_id", "version"),)


class Approval(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "approvals"
    entity_type: Mapped[str] = mapped_column(String(30), index=True)
    entity_id: Mapped[uuid.UUID] = mapped_column(Uuid, index=True)
    requested_from_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"), index=True)
    status: Mapped[str] = mapped_column(String(30), default="pending", index=True)
    comment: Mapped[str] = mapped_column(Text, default="")
    decided_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class OperationalRecord(UUIDPrimaryKeyMixin, TimestampMixin, SoftDeleteMixin, Base):
    """Typed operational ledger for procurement, inventory, site, budget, and payment modules."""

    __tablename__ = "operational_records"
    module: Mapped[str] = mapped_column(String(40), index=True)
    record_type: Mapped[str] = mapped_column(String(50), index=True)
    reference: Mapped[str] = mapped_column(String(40), index=True)
    title: Mapped[str] = mapped_column(String(180), index=True)
    project_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("projects.id"), index=True)
    customer_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("customers.id"), index=True)
    vendor_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("vendors.id"), index=True)
    owner_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"), index=True)
    status: Mapped[str] = mapped_column(String(30), default="draft", index=True)
    due_date: Mapped[date | None] = mapped_column(Date, index=True)
    amount: Mapped[Decimal | None] = mapped_column(Numeric(14, 2))
    data: Mapped[dict] = mapped_column(JSON, default=dict)
    __table_args__ = (Index("ix_ops_module_status_due", "module", "status", "due_date"),)


class Document(UUIDPrimaryKeyMixin, TimestampMixin, SoftDeleteMixin, Base):
    __tablename__ = "documents"
    name: Mapped[str] = mapped_column(String(255), index=True)
    file_url: Mapped[str] = mapped_column(String(500))
    mime_type: Mapped[str] = mapped_column(String(100))
    size_bytes: Mapped[int] = mapped_column(Integer)
    category: Mapped[str] = mapped_column(String(60), index=True)
    project_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("projects.id"), index=True)
    customer_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("customers.id"), index=True)
    uploaded_by_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    version: Mapped[int] = mapped_column(Integer, default=1)
    tags: Mapped[list] = mapped_column(JSON, default=list)


class Notification(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "notifications"
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    category: Mapped[str] = mapped_column(String(50), index=True)
    title: Mapped[str] = mapped_column(String(180))
    message: Mapped[str] = mapped_column(Text)
    link: Mapped[str | None] = mapped_column(String(500))
    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), index=True)


class Communication(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "communications"
    sender_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), index=True)
    client_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), index=True)
    enquiry_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("enquiries.id"), index=True)
    project_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("projects.id"), index=True)
    subject: Mapped[str] = mapped_column(String(180))
    message: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(30), default="open", index=True)
    updated_by_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"), index=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), index=True)


class WorkflowExecution(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "workflow_executions"
    workflow_name: Mapped[str] = mapped_column(String(100), index=True)
    entity_type: Mapped[str] = mapped_column(String(40), index=True)
    entity_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, index=True)
    status: Mapped[str] = mapped_column(String(30), index=True)
    external_execution_id: Mapped[str | None] = mapped_column(String(120))
    payload: Mapped[dict] = mapped_column(JSON, default=dict)
    error: Mapped[str | None] = mapped_column(Text)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class WebhookEvent(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "webhook_events"
    idempotency_key: Mapped[str] = mapped_column(String(120), unique=True, index=True)
    event_type: Mapped[str] = mapped_column(String(80), index=True)
    payload: Mapped[dict] = mapped_column(JSON, default=dict)
    processed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    response: Mapped[dict] = mapped_column(JSON, default=dict)


class AuditLog(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "audit_logs"
    user_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"), index=True)
    action: Mapped[str] = mapped_column(String(80), index=True)
    entity_type: Mapped[str] = mapped_column(String(50), index=True)
    entity_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, index=True)
    before: Mapped[dict] = mapped_column(JSON, default=dict)
    after: Mapped[dict] = mapped_column(JSON, default=dict)
    ip_address: Mapped[str | None] = mapped_column(String(50))


class ApplicationSetting(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "application_settings"
    key: Mapped[str] = mapped_column(String(100), unique=True, index=True)
    value: Mapped[dict] = mapped_column(JSON, default=dict)
    is_secret: Mapped[bool] = mapped_column(Boolean, default=False)
