"""Enforce account and customer contact uniqueness

Revision ID: 20260731_0004
Revises: 20260730_0003
"""

import sqlalchemy as sa

from alembic import op

revision = "20260731_0004"
down_revision = "20260730_0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_index(
        "uq_users_valid_phone",
        "users",
        ["phone"],
        unique=True,
        sqlite_where=sa.text(
            "length(phone) = 10 AND phone NOT GLOB '*[^0-9]*'"
        ),
        postgresql_where=sa.text("phone ~ '^[0-9]{10}$'"),
    )
    with op.batch_alter_table("customers") as batch_op:
        batch_op.create_unique_constraint("uq_customers_email", ["email"])
        batch_op.create_unique_constraint("uq_customers_phone", ["phone"])


def downgrade() -> None:
    with op.batch_alter_table("customers") as batch_op:
        batch_op.drop_constraint("uq_customers_phone", type_="unique")
        batch_op.drop_constraint("uq_customers_email", type_="unique")
    op.drop_index("uq_users_valid_phone", table_name="users")
