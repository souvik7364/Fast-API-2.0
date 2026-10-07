"""add username and about to users

Revision ID: e31bb9c04f62
Revises: c21a9f6d3e42
Create Date: 2026-10-07

"""
import re
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "e31bb9c04f62"
down_revision: Union[str, Sequence[str], None] = "c21a9f6d3e42"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("username", sa.String(length=30), nullable=True))
    op.add_column(
        "users",
        sa.Column(
            "about",
            sa.String(length=280),
            server_default=sa.text("''"),
            nullable=False,
        ),
    )

    connection = op.get_bind()
    users = connection.execute(
        sa.text("SELECT id, email FROM users ORDER BY id")
    ).all()
    used_usernames = set()

    for user_id, email in users:
        base = re.sub(r"[^a-z0-9_]", "", email.split("@", 1)[0].lower())
        if len(base) < 3:
            base = f"user{user_id}"
        base = base[:30]
        username = base
        suffix = 1
        while username in used_usernames:
            suffix_text = f"_{suffix}"
            username = f"{base[:30 - len(suffix_text)]}{suffix_text}"
            suffix += 1
        used_usernames.add(username)
        connection.execute(
            sa.text("UPDATE users SET username = :username WHERE id = :user_id"),
            {"username": username, "user_id": user_id},
        )

    op.alter_column("users", "username", nullable=False)
    op.create_unique_constraint("uq_users_username", "users", ["username"])


def downgrade() -> None:
    op.drop_constraint("uq_users_username", "users", type_="unique")
    op.drop_column("users", "about")
    op.drop_column("users", "username")
