"""audit_log: record who made the change (changed_by) + index for listing

Revision ID: 0006
Revises: 0005
Create Date: 2026-10-31

"""
from typing import Sequence, Union

from alembic import op

revision: str = "0006"
down_revision: Union[str, None] = "0005"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# Tạo lại 2 hàm audit để điền changed_by từ biến phiên 'app.user_id'.
# Backend gán biến này bằng set_config('app.user_id', <id>, true) (chỉ sống trong transaction
# hiện tại, xem app/deps.py). Không có biến (seed, SQL tay) thì changed_by = NULL.
# NULLIF(..., '') vì Postgres trả chuỗi rỗng thay vì NULL sau khi biến local hết hạn.
def _audit_function(table: str) -> str:
    return f"""
        CREATE OR REPLACE FUNCTION fn_audit_{table}() RETURNS TRIGGER AS $$
        DECLARE
            actor TEXT := NULLIF(current_setting('app.user_id', true), '');
        BEGIN
            IF TG_OP = 'INSERT' THEN
                INSERT INTO audit_log (table_name, operation, row_id, changed_by, new_data)
                VALUES ('{table}', 'INSERT', NEW.id, actor, to_jsonb(NEW));
            ELSIF TG_OP = 'UPDATE' THEN
                INSERT INTO audit_log (table_name, operation, row_id, changed_by, old_data, new_data)
                VALUES ('{table}', 'UPDATE', NEW.id, actor, to_jsonb(OLD), to_jsonb(NEW));
            ELSIF TG_OP = 'DELETE' THEN
                INSERT INTO audit_log (table_name, operation, row_id, changed_by, old_data)
                VALUES ('{table}', 'DELETE', OLD.id, actor, to_jsonb(OLD));
            END IF;
            RETURN NULL;
        END;
        $$ LANGUAGE plpgsql;
        """


# Bản gốc của migration 0002 (không có changed_by), dùng cho downgrade.
def _legacy_audit_function(table: str) -> str:
    return f"""
        CREATE OR REPLACE FUNCTION fn_audit_{table}() RETURNS TRIGGER AS $$
        BEGIN
            IF TG_OP = 'INSERT' THEN
                INSERT INTO audit_log (table_name, operation, row_id, new_data)
                VALUES ('{table}', 'INSERT', NEW.id, to_jsonb(NEW));
            ELSIF TG_OP = 'UPDATE' THEN
                INSERT INTO audit_log (table_name, operation, row_id, old_data, new_data)
                VALUES ('{table}', 'UPDATE', NEW.id, to_jsonb(OLD), to_jsonb(NEW));
            ELSIF TG_OP = 'DELETE' THEN
                INSERT INTO audit_log (table_name, operation, row_id, old_data)
                VALUES ('{table}', 'DELETE', OLD.id, to_jsonb(OLD));
            END IF;
            RETURN NULL;
        END;
        $$ LANGUAGE plpgsql;
        """


def upgrade() -> None:
    for table in ("books", "loans"):
        op.execute(_audit_function(table))
    # Trang Audit Log luôn sắp xếp theo thời gian mới nhất và lọc theo bảng.
    op.execute("CREATE INDEX idx_audit_log_changed_at ON audit_log (changed_at DESC, id DESC);")
    op.execute("CREATE INDEX idx_audit_log_table_row ON audit_log (table_name, row_id);")


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS idx_audit_log_table_row;")
    op.execute("DROP INDEX IF EXISTS idx_audit_log_changed_at;")
    for table in ("books", "loans"):
        op.execute(_legacy_audit_function(table))
