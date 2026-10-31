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


# Tạo 3 view và 1 materialized view phục vụ thống kê (router stats.py, loans.py).
def upgrade() -> None:
    # Xếp hạng sách theo số lần được mượn (RANK: đồng hạng thì cùng thứ hạng, có nhảy bậc)
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

    # Các phiếu quá hạn: chưa trả và due_date đã qua; overdue_by = thời gian đã quá hạn
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

    # Xếp hạng độc giả theo số lần mượn (DENSE_RANK: đồng hạng thì không nhảy bậc)
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

    # Thống kê mượn theo tháng. Materialized view lưu sẵn kết quả nên truy vấn nhanh,
    # nhưng phải REFRESH thủ công (POST /stats/refresh-monthly) mới thấy số liệu mới.
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
