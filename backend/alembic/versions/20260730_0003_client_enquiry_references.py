"""Add per-client enquiry references

Revision ID: 20260730_0003
Revises: 20260730_0002
"""

from collections import defaultdict
from datetime import datetime

import sqlalchemy as sa

from alembic import op

revision = "20260730_0003"
down_revision = "20260730_0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "enquiries",
        sa.Column("client_reference", sa.String(length=30), nullable=True),
    )

    connection = op.get_bind()
    rows = connection.execute(
        sa.text(
            """
            SELECT id, customer_id, reference, created_at
            FROM enquiries
            ORDER BY created_at, id
            """
        )
    ).mappings()
    counters: dict[tuple[str, int], int] = defaultdict(int)
    for row in rows:
        created_at = row["created_at"]
        if isinstance(created_at, str):
            created_at = datetime.fromisoformat(created_at)
        year = created_at.year
        customer_key = str(row["customer_id"] or row["id"])
        key = (customer_key, year)
        counters[key] += 1
        connection.execute(
            sa.text(
                """
                UPDATE enquiries
                SET client_reference = :client_reference
                WHERE id = :enquiry_id
                """
            ),
            {
                "client_reference": f"ENQ-{year}-{counters[key]:04d}",
                "enquiry_id": row["id"],
            },
        )

    with op.batch_alter_table("enquiries") as batch_op:
        batch_op.alter_column(
            "client_reference",
            existing_type=sa.String(length=30),
            nullable=False,
        )
        batch_op.create_unique_constraint(
            "uq_enquiries_customer_client_reference",
            ["customer_id", "client_reference"],
        )
        batch_op.create_index(
            "ix_enquiries_client_reference",
            ["client_reference"],
            unique=False,
        )


def downgrade() -> None:
    with op.batch_alter_table("enquiries") as batch_op:
        batch_op.drop_index("ix_enquiries_client_reference")
        batch_op.drop_constraint(
            "uq_enquiries_customer_client_reference",
            type_="unique",
        )
        batch_op.drop_column("client_reference")
