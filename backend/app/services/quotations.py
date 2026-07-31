from datetime import UTC, date, datetime, timedelta
from decimal import ROUND_HALF_UP, Decimal

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import (
    Customer,
    Enquiry,
    Milestone,
    Project,
    ProjectStage,
    Quotation,
    QuotationItem,
    QuotationVersion,
    Task,
    User,
)
from app.schemas.domain import QuotationCreate

MONEY = Decimal("0.01")


def calculate(items, discount: Decimal):
    subtotal = sum(
        (
            item.quantity * item.rate * (Decimal("1") + item.margin_rate / Decimal("100"))
            for item in items
        ),
        Decimal("0"),
    )
    tax = sum(
        (
            item.quantity
            * item.rate
            * (Decimal("1") + item.margin_rate / Decimal("100"))
            * item.tax_rate
            / Decimal("100")
            for item in items
        ),
        Decimal("0"),
    )
    subtotal = subtotal.quantize(MONEY, rounding=ROUND_HALF_UP)
    tax = tax.quantize(MONEY, rounding=ROUND_HALF_UP)
    total = max(Decimal("0"), subtotal + tax - discount).quantize(MONEY, rounding=ROUND_HALF_UP)
    return subtotal, tax, total


def create_quotation(db: Session, payload: QuotationCreate) -> Quotation:
    enquiry = db.get(Enquiry, payload.enquiry_id)
    if not enquiry:
        raise ValueError("Enquiry not found")
    count = db.scalar(select(func.count()).select_from(Quotation)) or 0
    subtotal, tax, total = calculate(payload.items, payload.discount)
    quote = Quotation(
        number=f"QT-{date.today().year}-{count + 1:04d}",
        enquiry_id=enquiry.id,
        customer_id=enquiry.customer_id,
        title=payload.title,
        valid_until=payload.valid_until,
        discount=payload.discount,
        subtotal=subtotal,
        tax=tax,
        total=total,
    )
    db.add(quote)
    db.flush()
    db.add(
        QuotationVersion(
            quotation_id=quote.id,
            version=1,
            subtotal=subtotal,
            tax=tax,
            discount=payload.discount,
            total=total,
        )
    )
    for item in payload.items:
        db.add(QuotationItem(quotation_id=quote.id, version=1, **item.model_dump()))
    enquiry.status = "quotation_sent"
    db.commit()
    db.refresh(quote)
    return quote


def approve_and_convert(db: Session, quote: Quotation) -> Project:
    existing = db.scalar(select(Project).where(Project.quotation_id == quote.id))
    if existing:
        return existing
    enquiry = db.get(Enquiry, quote.enquiry_id)
    if not enquiry:
        raise ValueError("Enquiry not found")
    customer = db.get(Customer, enquiry.customer_id) if enquiry.customer_id else None
    if not customer:
        customer = Customer(
            name=enquiry.contact_name,
            email=enquiry.email,
            phone=enquiry.phone,
            notes="Created automatically from approved quotation",
        )
        db.add(customer)
        db.flush()
        enquiry.customer_id = customer.id
        quote.customer_id = customer.id
    manager = db.scalar(
        select(User).where(User.role == "project_manager", User.is_active.is_(True))
    )
    count = db.scalar(select(func.count()).select_from(Project)) or 0
    start = date.today()
    project = Project(
        code=f"PRJ-{date.today().year}-{count + 1:04d}",
        name=enquiry.title,
        customer_id=customer.id,
        enquiry_id=enquiry.id,
        quotation_id=quote.id,
        project_manager_id=manager.id if manager else None,
        start_date=start,
        expected_completion_date=start + timedelta(days=120),
        contract_value=quote.total,
        budget=(quote.subtotal * Decimal("0.85")).quantize(MONEY),
        location=enquiry.location,
    )
    db.add(project)
    db.flush()
    stages = [
        "Planning",
        "Measurement",
        "Design",
        "Client Approval",
        "Procurement",
        "Execution",
        "Quality Check",
        "Handover",
    ]
    for sequence, name in enumerate(stages, 1):
        db.add(
            ProjectStage(
                project_id=project.id,
                name=name,
                sequence=sequence,
                status="active" if sequence == 1 else "pending",
            )
        )
    milestone_specs = [
        ("Design sign-off", 21),
        ("Procurement complete", 50),
        ("Execution complete", 105),
        ("Handover", 120),
    ]
    milestones = []
    for title, days in milestone_specs:
        milestone = Milestone(
            project_id=project.id, title=title, due_date=start + timedelta(days=days)
        )
        db.add(milestone)
        milestones.append(milestone)
    db.flush()
    task_specs = [
        ("Kick-off and requirement validation", 2, "high", milestones[0]),
        ("Complete site measurements", 5, "high", milestones[0]),
        ("Prepare concept and mood board", 12, "medium", milestones[0]),
        ("Build procurement schedule", 28, "medium", milestones[1]),
        ("Prepare site mobilization plan", 55, "medium", milestones[2]),
    ]
    for title, days, priority, milestone in task_specs:
        db.add(
            Task(
                project_id=project.id,
                milestone_id=milestone.id,
                title=title,
                priority=priority,
                assignee_id=manager.id if manager else None,
                start_date=start,
                due_date=start + timedelta(days=days),
            )
        )
    quote.status = "approved"
    quote.approved_at = datetime.now(UTC)
    enquiry.status = "won"
    db.commit()
    db.refresh(project)
    return project
