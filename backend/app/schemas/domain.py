import re
import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Annotated, Any, Literal

from pydantic import (
    AfterValidator,
    BaseModel,
    BeforeValidator,
    ConfigDict,
    EmailStr,
    Field,
    field_validator,
    model_validator,
)


def normalize_email(value):
    return value.strip().lower() if isinstance(value, str) else value


COMMON_EMAIL_DOMAIN_TYPOS = {
    "gmail.co": "gmail.com",
    "gmail.con": "gmail.com",
    "gamil.com": "gmail.com",
    "gmial.com": "gmail.com",
    "hotmal.com": "hotmail.com",
    "outlook.co": "outlook.com",
    "yahoo.co": "yahoo.com",
}


def reject_common_email_domain_typo(value: EmailStr) -> EmailStr:
    domain = str(value).rsplit("@", 1)[-1]
    suggestion = COMMON_EMAIL_DOMAIN_TYPOS.get(domain)
    if suggestion:
        raise ValueError(f"Email domain looks incorrect; did you mean {suggestion}?")
    return value


EmailAddress = Annotated[
    EmailStr,
    BeforeValidator(normalize_email),
    AfterValidator(reject_common_email_domain_typo),
]


def is_valid_phone_number(value: str) -> bool:
    return bool(re.fullmatch(r"[0-9]{10}", value.strip()))


def normalize_phone(value):
    if not isinstance(value, str) or not is_valid_phone_number(value):
        raise ValueError("Phone number must contain exactly 10 digits")
    return value.strip()


PhoneNumber = Annotated[str, BeforeValidator(normalize_phone)]


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class LoginRequest(BaseModel):
    email: EmailAddress
    password: str = Field(min_length=12, max_length=128)
    account_type: Literal["client", "workspace"] | None = None


class SignupRequest(BaseModel):
    full_name: str = Field(min_length=2, max_length=120)
    email: EmailAddress
    phone: PhoneNumber
    password: str = Field(min_length=12, max_length=128)

    @field_validator("full_name", "phone", mode="before")
    @classmethod
    def strip_identity_fields(cls, value: str) -> str:
        return value.strip()


class RefreshRequest(BaseModel):
    refresh_token: str


class TokenPair(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class UserOut(ORMModel):
    id: uuid.UUID
    email: EmailAddress
    full_name: str
    role: str
    is_active: bool
    avatar_url: str | None = None


class ClientAccountCreate(BaseModel):
    customer_id: uuid.UUID
    password: str = Field(min_length=12, max_length=128)


class TeamAccountCreate(BaseModel):
    full_name: str = Field(min_length=2, max_length=120)
    email: EmailAddress
    phone: PhoneNumber | None = None
    role: Literal[
        "admin",
        "sales_manager",
        "interior_designer",
        "project_manager",
        "site_supervisor",
    ]
    password: str = Field(min_length=12, max_length=128)

    @field_validator("full_name", "phone", mode="before")
    @classmethod
    def strip_team_fields(cls, value: str | None) -> str | None:
        return value.strip() if value else value


class ClientMessageCreate(BaseModel):
    subject: str = Field(min_length=3, max_length=180)
    message: str = Field(min_length=10, max_length=3000)
    project_id: uuid.UUID | None = None


class CustomerCreate(BaseModel):
    name: str = Field(min_length=2, max_length=140)
    email: EmailAddress
    phone: PhoneNumber
    company: str | None = None
    billing_address: str | None = None
    tags: list[str] = []
    notes: str = ""


class CustomerOut(CustomerCreate, ORMModel):
    phone: str
    id: uuid.UUID
    created_at: datetime


class EnquiryCreate(BaseModel):
    title: str = Field(min_length=3, max_length=180)
    contact_name: str = Field(min_length=2, max_length=140)
    email: EmailAddress
    phone: PhoneNumber
    property_type: str
    location: str
    area_sqft: Decimal | None = Field(default=None, gt=0)
    budget_min: Decimal | None = Field(default=None, ge=0)
    budget_max: Decimal | None = Field(default=None, ge=0)
    expected_start_date: date | None = None
    requirements: str = ""
    source: str = "Website"
    status: str = "new"
    assigned_to_id: uuid.UUID | None = None

    @model_validator(mode="after")
    def validate_budget(self):
        if (
            self.budget_min is not None
            and self.budget_max is not None
            and self.budget_min > self.budget_max
        ):
            raise ValueError("Minimum budget must not exceed maximum budget")
        return self


class ClientEnquiryCreate(BaseModel):
    title: str = Field(min_length=3, max_length=180)
    property_type: str = Field(min_length=2, max_length=60)
    location: str = Field(min_length=2, max_length=180)
    area_sqft: Decimal | None = Field(default=None, gt=0)
    budget_min: Decimal | None = Field(default=None, ge=0)
    budget_max: Decimal | None = Field(default=None, ge=0)
    expected_start_date: date | None = None
    requirements: str = Field(min_length=10, max_length=3000)

    @model_validator(mode="after")
    def validate_budget(self):
        if (
            self.budget_min is not None
            and self.budget_max is not None
            and self.budget_min > self.budget_max
        ):
            raise ValueError("Minimum budget must not exceed maximum budget")
        return self


class EnquiryUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=3, max_length=180)
    contact_name: str | None = Field(default=None, min_length=2, max_length=140)
    email: EmailAddress | None = None
    phone: PhoneNumber | None = None
    property_type: str | None = Field(default=None, min_length=2, max_length=60)
    location: str | None = Field(default=None, min_length=2, max_length=180)
    area_sqft: Decimal | None = Field(default=None, gt=0)
    budget_min: Decimal | None = Field(default=None, ge=0)
    budget_max: Decimal | None = Field(default=None, ge=0)
    expected_start_date: date | None = None
    requirements: str | None = Field(default=None, max_length=3000)
    source: str | None = Field(default=None, min_length=2, max_length=60)
    status: Literal[
        "new",
        "contacted",
        "site_visit_scheduled",
        "requirement_collected",
        "quotation_sent",
        "negotiation",
        "won",
        "lost",
    ] | None = None
    assigned_to_id: uuid.UUID | None = None

    @field_validator(
        "title",
        "contact_name",
        "phone",
        "property_type",
        "location",
        "requirements",
        "source",
        mode="before",
    )
    @classmethod
    def clean_enquiry_fields(cls, value: str | None):
        return value.strip() if isinstance(value, str) else value

    @model_validator(mode="after")
    def validate_budget(self):
        if (
            self.budget_min is not None
            and self.budget_max is not None
            and self.budget_min > self.budget_max
        ):
            raise ValueError("Minimum budget must not exceed maximum budget")
        return self


class EnquiryMessageCreate(BaseModel):
    message: str = Field(min_length=3, max_length=3000)

    @field_validator("message")
    @classmethod
    def clean_message(cls, value: str):
        return value.strip()


class CommunicationStatusUpdate(BaseModel):
    status: Literal["open", "in_progress", "completed"]


class EnquiryOut(ORMModel):
    id: uuid.UUID
    reference: str
    client_reference: str
    title: str
    contact_name: str
    email: str
    phone: str
    property_type: str
    location: str
    area_sqft: Decimal | None
    budget_min: Decimal | None
    budget_max: Decimal | None
    expected_start_date: date | None
    requirements: str
    source: str
    status: str
    assigned_to_id: uuid.UUID | None
    created_at: datetime


class QuotationItemIn(BaseModel):
    room: str
    category: str
    description: str
    quantity: Decimal = Field(gt=0)
    unit: str
    rate: Decimal = Field(ge=0)
    tax_rate: Decimal = Field(default=18, ge=0, le=100)
    margin_rate: Decimal = Field(default=0, ge=0, le=100)


class QuotationCreate(BaseModel):
    enquiry_id: uuid.UUID
    title: str
    valid_until: date | None = None
    discount: Decimal = Field(default=0, ge=0)
    items: list[QuotationItemIn] = Field(min_length=1)


class QuotationOut(ORMModel):
    id: uuid.UUID
    number: str
    enquiry_id: uuid.UUID
    title: str
    status: str
    current_version: int
    subtotal: Decimal
    tax: Decimal
    discount: Decimal
    total: Decimal
    valid_until: date | None
    created_at: datetime


class ProjectCreate(BaseModel):
    name: str
    customer_id: uuid.UUID | None = None
    project_manager_id: uuid.UUID | None = None
    start_date: date | None = None
    expected_completion_date: date | None = None
    contract_value: Decimal = 0
    budget: Decimal = 0
    location: str = ""


class ProjectOut(ORMModel):
    id: uuid.UUID
    code: str
    name: str
    customer_id: uuid.UUID | None
    project_manager_id: uuid.UUID | None
    status: str
    stage: str
    health: str
    progress: int
    start_date: date | None
    expected_completion_date: date | None
    contract_value: Decimal
    budget: Decimal
    location: str
    created_at: datetime


class TaskCreate(BaseModel):
    title: str = Field(min_length=2, max_length=180)
    project_id: uuid.UUID | None = None
    enquiry_id: uuid.UUID | None = None
    milestone_id: uuid.UUID | None = None
    assignee_id: uuid.UUID | None = None
    description: str = ""
    status: str = "to_do"
    priority: str = "medium"
    start_date: date | None = None
    due_date: date | None = None
    estimated_hours: Decimal | None = Field(default=None, ge=0)


class TaskUpdate(BaseModel):
    title: str | None = None
    status: str | None = None
    priority: str | None = None
    assignee_id: uuid.UUID | None = None
    due_date: date | None = None
    actual_hours: Decimal | None = Field(default=None, ge=0)


class TaskOut(TaskCreate, ORMModel):
    id: uuid.UUID
    actual_hours: Decimal | None = None
    created_at: datetime


class OperationalCreate(BaseModel):
    module: str = ""
    record_type: str
    reference: str
    title: str
    project_id: uuid.UUID | None = None
    customer_id: uuid.UUID | None = None
    vendor_id: uuid.UUID | None = None
    status: str = "draft"
    due_date: date | None = None
    amount: Decimal | None = None
    data: dict[str, Any] = {}


class VendorCreate(BaseModel):
    name: str = Field(min_length=2, max_length=180)
    category: str = Field(min_length=2, max_length=80)
    email: EmailAddress
    phone: PhoneNumber
    tax_id: str | None = None
    rating: Decimal = Field(default=Decimal("0"), ge=0, le=5)
    on_time_rate: int = Field(default=0, ge=0, le=100)


class MaterialCreate(BaseModel):
    sku: str = Field(min_length=2, max_length=60)
    name: str = Field(min_length=2, max_length=180)
    category: str = Field(min_length=2, max_length=80)
    brand: str | None = None
    unit: str = Field(min_length=1, max_length=30)
    unit_price: Decimal = Field(default=Decimal("0"), ge=0)
    stock_quantity: Decimal = Field(default=Decimal("0"), ge=0)
    reorder_level: Decimal = Field(default=Decimal("0"), ge=0)
    vendor_id: uuid.UUID | None = None


class DesignCreate(BaseModel):
    project_id: uuid.UUID
    room: str = Field(min_length=2, max_length=80)
    stage: str = Field(min_length=2, max_length=60)
    title: str = Field(min_length=2, max_length=180)
    status: str = "draft"


class OperationalStatusUpdate(BaseModel):
    status: str


class SettingUpdate(BaseModel):
    value: dict[str, Any]


class ApprovalDecision(BaseModel):
    status: str
    comment: str = ""


class BulkAction(BaseModel):
    ids: list[uuid.UUID] = Field(min_length=1, max_length=100)
    status: str | None = None
    assigned_to_id: uuid.UUID | None = None


class WebhookPayload(BaseModel):
    event_type: str
    entity_id: uuid.UUID | None = None
    data: dict[str, Any] = {}


class Paginated(BaseModel):
    items: list[Any]
    total: int
    page: int
    page_size: int
