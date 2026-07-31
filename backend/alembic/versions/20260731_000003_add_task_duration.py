"""add duration_minutes to tasks"""

from alembic import op
import sqlalchemy as sa


revision = "20260731_000003"
down_revision = "20260720_000002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("tasks", sa.Column("duration_minutes", sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column("tasks", "duration_minutes")
