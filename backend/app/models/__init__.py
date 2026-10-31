# Import mọi model ở đây để chúng đều được đăng ký vào Base.metadata
# (Alembic cần để nhận ra các bảng).
from app.models.author import Author
from app.models.book import Book, BookAuthor
from app.models.book_copy import BookCopy
from app.models.category import Category
from app.models.loan import Loan
from app.models.member import Member
from app.models.user import User
from app.models.audit_log import AuditLog

__all__ = [
    "Author",
    "Book",
    "BookAuthor",
    "BookCopy",
    "Category",
    "Loan",
    "Member",
    "User",
    "AuditLog",
]
