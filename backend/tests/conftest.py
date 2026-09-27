"""Fixtures dùng chung cho test suite.

Test chạy trực tiếp vào DB của stack docker-compose (đã migrate + seed) —
đây là integration test, không mock DB, vì mục tiêu đồ án là kiểm chứng hành vi
thật của transaction/trigger/constraint ở tầng Postgres. Yêu cầu trước khi chạy
`pytest`: stack đang chạy (skill db-stack) và đã seed dữ liệu (skill db-seed).
"""
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text

from app.db import SessionLocal
from app.main import app

# Pattern khớp với dữ liệu do chính test suite này tạo ra (test_concurrency.py,
# test_member_self_service.py, test_books.py...) — KHÔNG khớp dữ liệu seed thật
# (vana/thib/vanc/phamd/...) hay dữ liệu người dùng tự tạo qua UI.
_TEST_MEMBER_EMAIL_PATTERNS = ["concurrency_tester%", "other_%", "%proxytest%", "%testuser%"]
_TEST_BOOK_TITLE_PATTERNS = ["%Test Book%", "Clean Architecture"]


def _cleanup_test_artifacts() -> None:
    """Xoá sạch dữ liệu do test suite tạo ra, theo đúng thứ tự FK.
    Chạy sau khi toàn bộ test kết thúc để DB demo không bị tích luỹ rác qua mỗi lần
    chạy `pytest` — trước đây từng phải dọn tay bằng SQL nhiều lần vì thiếu bước này.
    """
    db = SessionLocal()
    try:
        member_filter = " OR ".join("email LIKE :m" + str(i) for i in range(len(_TEST_MEMBER_EMAIL_PATTERNS)))
        book_filter = " OR ".join("title LIKE :b" + str(i) for i in range(len(_TEST_BOOK_TITLE_PATTERNS)))
        member_params = {f"m{i}": p for i, p in enumerate(_TEST_MEMBER_EMAIL_PATTERNS)}
        book_params = {f"b{i}": p for i, p in enumerate(_TEST_BOOK_TITLE_PATTERNS)}

        db.execute(text(f"CREATE TEMP TABLE test_member_ids AS SELECT id FROM members WHERE {member_filter}"), member_params)
        db.execute(text(f"CREATE TEMP TABLE test_book_ids AS SELECT id FROM books WHERE {book_filter}"), book_params)

        db.execute(text(
            "DELETE FROM loans WHERE member_id IN (SELECT id FROM test_member_ids) "
            "OR book_copy_id IN (SELECT id FROM book_copies WHERE book_id IN (SELECT id FROM test_book_ids))"
        ))
        db.execute(text("DELETE FROM book_copies WHERE book_id IN (SELECT id FROM test_book_ids)"))
        db.execute(text("DELETE FROM book_authors WHERE book_id IN (SELECT id FROM test_book_ids)"))
        db.execute(text("DELETE FROM users WHERE member_id IN (SELECT id FROM test_member_ids)"))
        db.execute(text("DELETE FROM audit_log WHERE table_name = 'books' AND row_id IN (SELECT id FROM test_book_ids)"))
        db.execute(text("DELETE FROM members WHERE id IN (SELECT id FROM test_member_ids)"))
        db.execute(text("DELETE FROM books WHERE id IN (SELECT id FROM test_book_ids)"))
        db.commit()
    finally:
        db.close()


@pytest.fixture(scope="session", autouse=True)
def _cleanup_after_session():
    yield
    _cleanup_test_artifacts()


@pytest.fixture(scope="session")
def client():
    return TestClient(app)


@pytest.fixture(scope="session")
def admin_token(client):
    resp = client.post("/auth/login", json={"username": "admin", "password": "admin123"})
    assert resp.status_code == 200, resp.text
    return resp.json()["access_token"]


@pytest.fixture(scope="session")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


@pytest.fixture(scope="session")
def member_token(client):
    # Seed tạo sẵn user "vana" (role=member) gắn với member "vana@example.com".
    resp = client.post("/auth/login", json={"username": "vana", "password": "member123"})
    assert resp.status_code == 200, resp.text
    return resp.json()["access_token"]


@pytest.fixture(scope="session")
def member_headers(member_token):
    return {"Authorization": f"Bearer {member_token}"}
