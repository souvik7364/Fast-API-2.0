"""Retain the feature-schema revision in the migration chain.

Revision ID: f21a9c3d8b40
Revises: e31bb9c04f62
"""

from typing import Sequence, Union


revision: str = "f21a9c3d8b40"
down_revision: Union[str, Sequence[str], None] = "e31bb9c04f62"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # This revision was already applied to existing databases. Its feature
    # changes are being rolled back by the application code; keep its ID so
    # Alembic can upgrade those databases to the corrective migration.
    pass


def downgrade() -> None:
    pass
