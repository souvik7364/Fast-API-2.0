"""allow images in replies

Revision ID: 4d9a7c2b1f60
Revises: b8c4d21a6f30
Create Date: 2026-10-08

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "4d9a7c2b1f60"
down_revision: Union[str, Sequence[str], None] = "b8c4d21a6f30"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column(
        "replies",
        "content",
        existing_type=sa.String(length=280),
        type_=sa.Text(),
        existing_nullable=False,
    )


def downgrade() -> None:
    op.alter_column(
        "replies",
        "content",
        existing_type=sa.Text(),
        type_=sa.String(length=280),
        existing_nullable=False,
    )
