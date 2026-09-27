"""Seed dữ liệu mẫu cho phát triển/test cục bộ. Chạy: python -m app.seed
Idempotent: kiểm tra tồn tại trước khi insert, an toàn khi chạy lại nhiều lần.
"""
from datetime import datetime, timedelta, timezone

from sqlalchemy import select

from app.db import SessionLocal
from app.models.author import Author
from app.models.book import Book, BookAuthor
from app.models.book_copy import BookCopy
from app.models.category import Category
from app.models.loan import Loan
from app.models.member import Member
from app.models.user import User
from app.security import hash_password


def get_or_create(db, model, defaults=None, **kwargs):
    instance = db.scalar(select(model).filter_by(**kwargs))
    if instance:
        return instance, False
    params = {**kwargs, **(defaults or {})}
    instance = model(**params)
    db.add(instance)
    db.flush()
    return instance, True


def run():
    db = SessionLocal()
    try:
        fiction, _ = get_or_create(db, Category, name="Tiểu thuyết")
        scifi, _ = get_or_create(db, Category, name="Khoa học viễn tưởng", defaults={"parent_id": fiction.id})
        tech, _ = get_or_create(db, Category, name="Công nghệ")

        authors = {}
        for name in [
            "Nguyễn Nhật Ánh",
            "Tô Hoài",
            "Isaac Asimov",
            "Martin Kleppmann",
            "Robert C. Martin",
            "Andrew Hunt",
            "David Thomas",
            "Thomas H. Cormen",
            "James F. Kurose",
            "Abraham Silberschatz",
            "Henry F. Korth",
            "Stuart Russell",
            "Brian W. Kernighan",
            "Dennis M. Ritchie",
            "Eric Freeman",
            "Gayle Laakmann McDowell",
        ]:
            author, _ = get_or_create(db, Author, full_name=name)
            authors[name] = author

        books_data = [
            ("Cho tôi xin một vé đi tuổi thơ", "978-0000000001", fiction, ["Nguyễn Nhật Ánh"], 3),
            ("Dế Mèn phiêu lưu ký", "978-0000000002", fiction, ["Tô Hoài"], 2),
            ("Foundation", "978-0000000003", scifi, ["Isaac Asimov"], 1),  # chỉ 1 bản: dùng cho concurrency-test
            ("Designing Data-Intensive Applications", "978-0000000004", tech, ["Martin Kleppmann"], 2),
        ]

        books = {}
        for title, isbn, category, author_names, copies_count in books_data:
            book, created = get_or_create(
                db, Book, isbn=isbn, defaults={"title": title, "category_id": category.id}
            )
            books[title] = book
            if created:
                for name in author_names:
                    db.add(BookAuthor(book_id=book.id, author_id=authors[name].id))
                for _ in range(copies_count):
                    db.add(BookCopy(book_id=book.id, status="available"))

        # 10 sách CNTT dùng chung ảnh bìa của "Cho tôi xin một vé đi tuổi thơ" (theo yêu cầu) —
        # lấy cover_url động từ book đó thay vì hardcode tên file, để không phụ thuộc 1 lần upload cụ thể.
        shared_cover_url = books["Cho tôi xin một vé đi tuổi thơ"].cover_url

        it_books_data = [
            ("Clean Code", "978-0132350884", ["Robert C. Martin"], 2),
            ("The Pragmatic Programmer", "978-0135957059", ["Andrew Hunt", "David Thomas"], 2),
            ("Introduction to Algorithms", "978-0262046305", ["Thomas H. Cormen"], 2),
            ("Computer Networking: A Top-Down Approach", "978-0136681557", ["James F. Kurose"], 2),
            ("Operating System Concepts", "978-1119800361", ["Abraham Silberschatz"], 2),
            ("Database System Concepts", "978-0078022159", ["Henry F. Korth"], 2),
            ("Artificial Intelligence: A Modern Approach", "978-0134610993", ["Stuart Russell"], 2),
            ("The C Programming Language", "978-0131103627", ["Brian W. Kernighan", "Dennis M. Ritchie"], 2),
            ("Head First Design Patterns", "978-1492078005", ["Eric Freeman"], 2),
            ("Cracking the Coding Interview", "978-0984782857", ["Gayle Laakmann McDowell"], 2),
        ]

        for title, isbn, author_names, copies_count in it_books_data:
            book, created = get_or_create(
                db,
                Book,
                isbn=isbn,
                defaults={
                    "title": title,
                    "category_id": tech.id,
                    "cover_url": shared_cover_url,
                },
            )
            if book.cover_url != shared_cover_url:
                book.cover_url = shared_cover_url
            books[title] = book
            if created:
                for name in author_names:
                    db.add(BookAuthor(book_id=book.id, author_id=authors[name].id))
                for _ in range(copies_count):
                    db.add(BookCopy(book_id=book.id, status="available"))

        # avatar_url dùng pravatar.cc — ảnh khuôn mặt người thật được cấp phép sẵn
        # chuyên cho mục đích placeholder/demo avatar (không phải ảnh tự ý lấy của người
        # thật ngoài đời, tránh vấn đề quyền hình ảnh/riêng tư khi dùng cho dữ liệu seed).
        members_data = [
            ("Nguyễn Văn A", "vana@example.com", "0900000001", 1, "vana"),
            ("Trần Thị B", "thib@example.com", "0900000002", 5, "thib"),
            ("Lê Văn C", "vanc@example.com", "0900000003", 12, "vanc"),
            ("Phạm Thị D", "phamd@example.com", "0900000004", 9, "phamd"),
            ("Hoàng Văn E", "hoange@example.com", "0900000005", 13, "hoange"),
            ("Vũ Thị F", "vuf@example.com", "0900000006", 20, "vuf"),
            ("Đặng Văn G", "dangg@example.com", "0900000007", 14, "dangg"),
            ("Bùi Thị H", "buih@example.com", "0900000008", 23, "buih"),
            ("Đỗ Văn I", "doi@example.com", "0900000009", 15, "doi"),
            ("Ngô Thị K", "ngok@example.com", "0900000010", 25, "ngok"),
        ]
        members = {}
        for full_name, email, phone, avatar_img, username in members_data:
            member, _ = get_or_create(
                db,
                Member,
                email=email,
                defaults={
                    "full_name": full_name,
                    "phone": phone,
                    "avatar_url": f"https://i.pravatar.cc/300?img={avatar_img}",
                },
            )
            if not member.avatar_url:
                # Backfill cho các member đã tồn tại từ trước (seed cũ chưa có avatar).
                member.avatar_url = f"https://i.pravatar.cc/300?img={avatar_img}"
            members[email] = member
            get_or_create(
                db,
                User,
                username=username,
                defaults={
                    "password_hash": hash_password("member123"),
                    "role": "member",
                    "member_id": member.id,
                },
            )

        get_or_create(
            db,
            User,
            username="admin",
            defaults={"password_hash": hash_password("admin123"), "role": "admin"},
        )

        db.flush()

        existing_loans = db.scalar(select(Loan).limit(1))
        if existing_loans is None:
            dme_copy = db.scalar(
                select(BookCopy).where(BookCopy.book_id == books["Dế Mèn phiêu lưu ký"].id).limit(1)
            )
            if dme_copy:
                overdue_loan = Loan(
                    book_copy_id=dme_copy.id,
                    member_id=members["vana@example.com"].id,
                    borrowed_at=datetime.now(timezone.utc) - timedelta(days=20),
                    due_date=datetime.now(timezone.utc) - timedelta(days=6),
                )
                db.add(overdue_loan)
                # Không set dme_copy.status tay: trigger trg_after_loan_insert (migration 0002)
                # tự động chuyển bản sao sang 'borrowed' khi INSERT vào loans.

        db.commit()
        print("Seed hoàn tất.")
    finally:
        db.close()


if __name__ == "__main__":
    run()
