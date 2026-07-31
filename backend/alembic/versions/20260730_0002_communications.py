"""Add shared client and studio communications

Revision ID: 20260730_0002
Revises: 20260725_0001
"""

import sqlalchemy as sa

from alembic import op

revision = "20260730_0002"
down_revision = "20260725_0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "communications",
        sa.Column("sender_id", sa.Uuid(), nullable=False),
        sa.Column("client_id", sa.Uuid(), nullable=False),
        sa.Column("enquiry_id", sa.Uuid(), nullable=True),
        sa.Column("project_id", sa.Uuid(), nullable=True),
        sa.Column("subject", sa.String(length=180), nullable=False),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("status", sa.String(length=30), nullable=False, server_default="open"),
        sa.Column("updated_by_id", sa.Uuid(), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["client_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["enquiry_id"], ["enquiries.id"]),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"]),
        sa.ForeignKeyConstraint(["sender_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["updated_by_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_communications_client_id", "communications", ["client_id"])
    op.create_index("ix_communications_completed_at", "communications", ["completed_at"])
    op.create_index("ix_communications_created_at", "communications", ["created_at"])
    op.create_index("ix_communications_enquiry_id", "communications", ["enquiry_id"])
    op.create_index("ix_communications_project_id", "communications", ["project_id"])
    op.create_index("ix_communications_sender_id", "communications", ["sender_id"])
    op.create_index("ix_communications_status", "communications", ["status"])
    op.create_index("ix_communications_updated_by_id", "communications", ["updated_by_id"])


def downgrade() -> None:
    op.drop_table("communications")
