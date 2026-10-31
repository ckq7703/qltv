"""indexes: full-text GIN, category/member/status indexes, partial index for open loans

Revision ID: 0004
Revises: 0003
Create Date: 2026-09-22

"""
from typing import Sequence, Union

from alembic import op

revision: str = "0004"
down_revision: Union[str, None] = "0003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# Tạo trigger cập nhật search_vector và các index tăng tốc truy vấn
# (kết quả đo EXPLAIN ANALYZE xem docs/BENCHMARKS.md).
def upgrade() -> None:
    # Trigger to keep books.search_vector in sync with title (full-text search source).
    op.execute(
        """
        CREATE OR REPLACE FUNCTION fn_books_search_vector_update() RETURNS TRIGGER AS $$
        BEGIN
            NEW.search_vector := to_tsvector('simple', coalesce(NEW.title, ''));
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
        """
    )
    op.execute(
        """
        CREATE TRIGGER trg_books_search_vector_update
        BEFORE INSERT OR UPDATE OF title ON books
        FOR EACH ROW EXECUTE FUNCTION fn_books_search_vector_update();
        """
    )

    # GIN: index chuyên cho full-text search trên search_vector
    op.execute("CREATE INDEX idx_books_search ON books USING GIN (search_vector);")
    # Lọc sách theo thể loại
    op.execute("CREATE INDEX idx_books_category ON books (category_id);")
    # Tìm bản sao còn rảnh của một sách (truy vấn ở services/loans.borrow_book)
    op.execute("CREATE INDEX idx_copies_book_status ON book_copies (book_id, status);")
    # Tra phiếu mượn theo độc giả
    op.execute("CREATE INDEX idx_loans_member ON loans (member_id);")
    # Partial index: chỉ index các phiếu chưa trả, nhỏ và nhanh cho truy vấn "đang mượn"
    op.execute(
        "CREATE INDEX idx_loans_open ON loans (book_copy_id) WHERE returned_at IS NULL;"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS idx_loans_open;")
    op.execute("DROP INDEX IF EXISTS idx_loans_member;")
    op.execute("DROP INDEX IF EXISTS idx_copies_book_status;")
    op.execute("DROP INDEX IF EXISTS idx_books_category;")
    op.execute("DROP INDEX IF EXISTS idx_books_search;")
    op.execute("DROP TRIGGER IF EXISTS trg_books_search_vector_update ON books;")
    op.execute("DROP FUNCTION IF EXISTS fn_books_search_vector_update();")
