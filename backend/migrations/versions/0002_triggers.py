"""triggers: sync book_copies status on loan insert/return, audit_log triggers

Revision ID: 0002
Revises: 0001
Create Date: 2026-09-22

"""
from typing import Sequence, Union

from alembic import op

revision: str = "0002"
down_revision: Union[str, None] = "0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        CREATE OR REPLACE FUNCTION fn_after_loan_insert() RETURNS TRIGGER AS $$
        BEGIN
            UPDATE book_copies SET status = 'borrowed', version = version + 1
            WHERE id = NEW.book_copy_id;
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
        """
    )
    op.execute(
        """
        CREATE TRIGGER trg_after_loan_insert
        AFTER INSERT ON loans
        FOR EACH ROW EXECUTE FUNCTION fn_after_loan_insert();
        """
    )

    op.execute(
        """
        CREATE OR REPLACE FUNCTION fn_after_loan_return() RETURNS TRIGGER AS $$
        BEGIN
            IF NEW.returned_at IS NOT NULL AND OLD.returned_at IS NULL THEN
                UPDATE book_copies SET status = 'available', version = version + 1
                WHERE id = NEW.book_copy_id;
            END IF;
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
        """
    )
    op.execute(
        """
        CREATE TRIGGER trg_after_loan_return
        AFTER UPDATE ON loans
        FOR EACH ROW EXECUTE FUNCTION fn_after_loan_return();
        """
    )

    op.execute(
        """
        CREATE OR REPLACE FUNCTION fn_audit_books() RETURNS TRIGGER AS $$
        BEGIN
            IF TG_OP = 'INSERT' THEN
                INSERT INTO audit_log (table_name, operation, row_id, new_data)
                VALUES ('books', 'INSERT', NEW.id, to_jsonb(NEW));
            ELSIF TG_OP = 'UPDATE' THEN
                INSERT INTO audit_log (table_name, operation, row_id, old_data, new_data)
                VALUES ('books', 'UPDATE', NEW.id, to_jsonb(OLD), to_jsonb(NEW));
            ELSIF TG_OP = 'DELETE' THEN
                INSERT INTO audit_log (table_name, operation, row_id, old_data)
                VALUES ('books', 'DELETE', OLD.id, to_jsonb(OLD));
            END IF;
            RETURN NULL;
        END;
        $$ LANGUAGE plpgsql;
        """
    )
    op.execute(
        """
        CREATE TRIGGER trg_audit_books
        AFTER INSERT OR UPDATE OR DELETE ON books
        FOR EACH ROW EXECUTE FUNCTION fn_audit_books();
        """
    )

    op.execute(
        """
        CREATE OR REPLACE FUNCTION fn_audit_loans() RETURNS TRIGGER AS $$
        BEGIN
            IF TG_OP = 'INSERT' THEN
                INSERT INTO audit_log (table_name, operation, row_id, new_data)
                VALUES ('loans', 'INSERT', NEW.id, to_jsonb(NEW));
            ELSIF TG_OP = 'UPDATE' THEN
                INSERT INTO audit_log (table_name, operation, row_id, old_data, new_data)
                VALUES ('loans', 'UPDATE', NEW.id, to_jsonb(OLD), to_jsonb(NEW));
            ELSIF TG_OP = 'DELETE' THEN
                INSERT INTO audit_log (table_name, operation, row_id, old_data)
                VALUES ('loans', 'DELETE', OLD.id, to_jsonb(OLD));
            END IF;
            RETURN NULL;
        END;
        $$ LANGUAGE plpgsql;
        """
    )
    op.execute(
        """
        CREATE TRIGGER trg_audit_loans
        AFTER INSERT OR UPDATE OR DELETE ON loans
        FOR EACH ROW EXECUTE FUNCTION fn_audit_loans();
        """
    )


def downgrade() -> None:
    op.execute("DROP TRIGGER IF EXISTS trg_audit_loans ON loans;")
    op.execute("DROP FUNCTION IF EXISTS fn_audit_loans();")
    op.execute("DROP TRIGGER IF EXISTS trg_audit_books ON books;")
    op.execute("DROP FUNCTION IF EXISTS fn_audit_books();")
    op.execute("DROP TRIGGER IF EXISTS trg_after_loan_return ON loans;")
    op.execute("DROP FUNCTION IF EXISTS fn_after_loan_return();")
    op.execute("DROP TRIGGER IF EXISTS trg_after_loan_insert ON loans;")
    op.execute("DROP FUNCTION IF EXISTS fn_after_loan_insert();")
