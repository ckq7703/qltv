"""initial schema: authors, categories, books, book_authors, book_copies, members, loans, users, audit_log

Revision ID: 0001
Revises:
Create Date: 2026-09-22

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "authors",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("full_name", sa.String(255), nullable=False),
    )

    op.create_table(
        "categories",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(100), nullable=False, unique=True),
        sa.Column("parent_id", sa.Integer(), sa.ForeignKey("categories.id")),
    )

    op.create_table(
        "books",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("isbn", sa.String(20), nullable=False, unique=True),
        sa.Column("category_id", sa.Integer(), sa.ForeignKey("categories.id")),
        sa.Column("cover_url", sa.Text()),
        sa.Column("search_vector", postgresql.TSVECTOR()),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )

    op.create_table(
        "book_authors",
        sa.Column(
            "book_id",
            sa.Integer(),
            sa.ForeignKey("books.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column(
            "author_id",
            sa.Integer(),
            sa.ForeignKey("authors.id", ondelete="CASCADE"),
            primary_key=True,
        ),
    )

    op.create_table(
        "book_copies",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "book_id",
            sa.Integer(),
            sa.ForeignKey("books.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "status",
            sa.String(20),
            nullable=False,
            server_default="available",
        ),
        sa.Column("version", sa.Integer(), nullable=False, server_default="0"),
        sa.CheckConstraint(
            "status IN ('available', 'borrowed', 'lost', 'damaged')",
            name="chk_book_copy_status",
        ),
    )

    op.create_table(
        "members",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("full_name", sa.String(255), nullable=False),
        sa.Column("email", sa.String(255), nullable=False, unique=True),
        sa.Column("phone", sa.String(20)),
        sa.Column(
            "joined_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )

    op.create_table(
        "loans",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "book_copy_id", sa.Integer(), sa.ForeignKey("book_copies.id"), nullable=False
        ),
        sa.Column("member_id", sa.Integer(), sa.ForeignKey("members.id"), nullable=False),
        sa.Column(
            "borrowed_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column("due_date", sa.DateTime(timezone=True), nullable=False),
        sa.Column("returned_at", sa.DateTime(timezone=True)),
        sa.CheckConstraint(
            "returned_at IS NULL OR returned_at >= borrowed_at",
            name="chk_return_after_borrow",
        ),
    )

    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("username", sa.String(100), nullable=False, unique=True),
        sa.Column("password_hash", sa.Text(), nullable=False),
        sa.Column("role", sa.String(20), nullable=False),
        sa.Column("member_id", sa.Integer(), sa.ForeignKey("members.id")),
        sa.CheckConstraint("role IN ('admin', 'member')", name="chk_user_role"),
    )

    op.create_table(
        "audit_log",
        sa.Column("id", sa.BigInteger(), primary_key=True),
        sa.Column("table_name", sa.String(50), nullable=False),
        sa.Column("operation", sa.String(10), nullable=False),
        sa.Column("row_id", sa.Integer()),
        sa.Column("changed_by", sa.String(100)),
        sa.Column(
            "changed_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column("old_data", postgresql.JSONB()),
        sa.Column("new_data", postgresql.JSONB()),
    )


def downgrade() -> None:
    op.drop_table("audit_log")
    op.drop_table("users")
    op.drop_table("loans")
    op.drop_table("members")
    op.drop_table("book_copies")
    op.drop_table("book_authors")
    op.drop_table("books")
    op.drop_table("categories")
    op.drop_table("authors")
