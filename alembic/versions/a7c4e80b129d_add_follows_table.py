"""add follows table

Revision ID: a7c4e80b129d
Revises: f4c838bb1360
Create Date: 2026-10-07

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "a7c4e80b129d"
down_revision: Union[str, Sequence[str], None] = "f4c838bb1360"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "follows",
        sa.Column("follower_id", sa.Integer(), nullable=False),
        sa.Column("followed_id", sa.Integer(), nullable=False),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "follower_id <> followed_id",
            name="ck_follows_no_self_follow",
        ),
        sa.ForeignKeyConstraint(
            ["follower_id"], ["users.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["followed_id"], ["users.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("follower_id", "followed_id"),
    )
    op.create_index("ix_follows_followed_id", "follows", ["followed_id"])


def downgrade() -> None:
    op.drop_index("ix_follows_followed_id", table_name="follows")
    op.drop_table("follows")
