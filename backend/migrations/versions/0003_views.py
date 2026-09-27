"""views: v_top_borrowed_books, v_overdue_loans, v_active_members, mv_monthly_stats

Revision ID: 0003
Revises: 0002
Create Date: 2026-09-22

"""
from typing import Sequence, Union

from alembic import op

revision: str = "0003"
down_revision: Union[str, None] = "0002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        CREATE VIEW v_top_borrowed_books AS
        SELECT b.id, b.title, COUNT(l.id) AS times_borrowed,
               RANK() OVER (ORDER BY COUNT(l.id) DESC) AS rank
        FROM books b
        JOIN book_copies bc ON bc.book_id = b.id
        JOIN loans l ON l.book_copy_id = bc.id
        GROUP BY b.id, b.title;
        """
    )

    op.execute(
        """
        CREATE VIEW v_overdue_loans AS
        SELECT l.id, l.member_id, bc.book_id, l.due_date,
               now() - l.due_date AS overdue_by
        FROM loans l
        JOIN book_copies bc ON bc.id = l.book_copy_id
        WHERE l.returned_at IS NULL AND l.due_date < now();
        """
    )

    op.execute(
        """
        CREATE VIEW v_active_members AS
        SELECT m.id, m.full_name, COUNT(l.id) AS total_loans,
               DENSE_RANK() OVER (ORDER BY COUNT(l.id) DESC) AS activity_rank
        FROM members m
        JOIN loans l ON l.member_id = m.id
        GROUP BY m.id, m.full_name;
        """
    )

    op.execute(
        """
        CREATE MATERIALIZED VIEW mv_monthly_stats AS
        SELECT date_trunc('month', borrowed_at) AS month,
               COUNT(*) AS total_loans,
               COUNT(*) FILTER (WHERE returned_at IS NULL) AS still_borrowed
        FROM loans
        GROUP BY 1;
        """
    )


def downgrade() -> None:
    op.execute("DROP MATERIALIZED VIEW IF EXISTS mv_monthly_stats;")
    op.execute("DROP VIEW IF EXISTS v_active_members;")
    op.execute("DROP VIEW IF EXISTS v_overdue_loans;")
    op.execute("DROP VIEW IF EXISTS v_top_borrowed_books;")
