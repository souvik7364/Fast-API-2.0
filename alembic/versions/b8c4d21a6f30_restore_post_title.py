"""Restore the posts title column expected by the API.

Revision ID: b8c4d21a6f30
Revises: f21a9c3d8b40
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "b8c4d21a6f30"
down_revision: Union[str, Sequence[str], None] = "f21a9c3d8b40"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    columns = {column["name"] for column in inspector.get_columns("posts")}
    if "title" not in columns:
        op.add_column("posts", sa.Column("title", sa.String(), nullable=True))
        # The previous schema stored the post text in content and had no title.
        # Give those existing rows a stable title without changing their content.
        op.execute("UPDATE posts SET title = 'Post ' || id WHERE title IS NULL")
        op.alter_column("posts", "title", existing_type=sa.String(), nullable=False)


def downgrade() -> None:
    # This is a repair migration: do not drop a title column that may have
    # existed before this migration on a fresh database.
    pass
