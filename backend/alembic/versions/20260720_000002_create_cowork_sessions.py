"""create cowork sessions"""

from alembic import op
import sqlalchemy as sa


revision = "20260720_000002"
down_revision = "20260424_000001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "cowork_sessions",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("slug", sa.String(length=32), nullable=False),
        sa.Column("host_user_id", sa.String(length=36), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("ended_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["host_user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_cowork_sessions_slug"), "cowork_sessions", ["slug"], unique=True)
    op.create_index(op.f("ix_cowork_sessions_host_user_id"), "cowork_sessions", ["host_user_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_cowork_sessions_host_user_id"), table_name="cowork_sessions")
    op.drop_index(op.f("ix_cowork_sessions_slug"), table_name="cowork_sessions")
    op.drop_table("cowork_sessions")
