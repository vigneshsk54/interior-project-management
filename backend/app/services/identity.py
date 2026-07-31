import uuid

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import Customer, User


def contact_conflict_field(
    db: Session,
    email: str,
    phone: str | None,
    *,
    exclude_user_id: uuid.UUID | None = None,
    exclude_customer_id: uuid.UUID | None = None,
) -> str | None:
    normalized_email = email.strip().lower()

    user_email = select(User.id).where(func.lower(User.email) == normalized_email)
    customer_email = select(Customer.id).where(
        func.lower(Customer.email) == normalized_email
    )
    if exclude_user_id:
        user_email = user_email.where(User.id != exclude_user_id)
    if exclude_customer_id:
        customer_email = customer_email.where(Customer.id != exclude_customer_id)
    if db.scalar(user_email) or db.scalar(customer_email):
        return "email"

    if phone:
        user_phone = select(User.id).where(User.phone == phone)
        customer_phone = select(Customer.id).where(Customer.phone == phone)
        if exclude_user_id:
            user_phone = user_phone.where(User.id != exclude_user_id)
        if exclude_customer_id:
            customer_phone = customer_phone.where(Customer.id != exclude_customer_id)
        if db.scalar(user_phone) or db.scalar(customer_phone):
            return "phone"

    return None
