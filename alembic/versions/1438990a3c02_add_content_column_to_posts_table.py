"""add content column to posts table

Revision ID: 1438990a3c02
Revises: 9bdc44a8adf2
Create Date: 2026-09-26 00:12:52.621220

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '1438990a3c02'
down_revision: Union[str, Sequence[str], None] = '9bdc44a8adf2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('posts', sa.Column('content', sa.String(), nullable=False))
    pass


def downgrade() -> None:
    op.drop_column('posts', 'content')
    pass
