"""Kiểm chứng phân quyền tự mượn/trả cho member (khác với admin mượn hộ).
Xem app/routers/loans.py — member_id luôn lấy từ JWT claims khi role=member,
member_id trong body request bị bỏ qua để tránh giả mạo mượn hộ người khác.
"""
import uuid


def _unique_isbn() -> str:
    return f"978-{uuid.uuid4().int % 10**10:010d}"


def test_me_endpoint_returns_linked_member(client, member_headers):
    resp = client.get("/auth/me", headers=member_headers)
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["role"] == "member"
    assert body["member_id"] is not None
    assert body["member_email"] == "vana@example.com"


def test_anonymous_cannot_borrow_or_list_loans(client):
    assert client.get("/loans").status_code in (401, 403)
    assert (
        client.post("/loans/borrow", json={"book_id": 1, "member_id": 1}).status_code
        in (401, 403)
    )


def test_member_self_borrow_ignores_member_id_in_body(client, member_headers, admin_headers):
    me = client.get("/auth/me", headers=member_headers).json()

    book_resp = client.post(
        "/books",
        json={"title": "Self-Service Test Book", "isbn": _unique_isbn(), "copies_count": 1},
        headers=admin_headers,
    )
    assert book_resp.status_code == 201, book_resp.text
    book = book_resp.json()

    # Cố ý gửi member_id=999 (giả mạo) — phải bị bỏ qua, luôn mượn cho chính mình.
    resp = client.post(
        "/loans/borrow",
        json={"book_id": book["id"], "member_id": 999},
        headers=member_headers,
    )
    assert resp.status_code == 201, resp.text
    loan = resp.json()
    assert loan["member_id"] == me["member_id"]

    return_resp = client.post(f"/loans/{loan['id']}/return", headers=member_headers)
    assert return_resp.status_code == 200
    # Không xoá sách test: đã có lịch sử mượn nên API sẽ chặn xoá (409, giữ audit trail) —
    # cùng lý do như test_concurrency.py, chấp nhận để lại vài sách test trong DB demo.


def test_member_cannot_return_another_members_loan(client, member_headers, admin_headers):
    other_member_resp = client.get(
        "/members", params={"search": "thib@example.com"}, headers=admin_headers
    )
    other_member = other_member_resp.json()["items"][0]

    book_resp = client.post(
        "/books",
        json={"title": "Cross-Member Test Book", "isbn": _unique_isbn(), "copies_count": 1},
        headers=admin_headers,
    )
    book = book_resp.json()

    loan_resp = client.post(
        "/loans/borrow",
        json={"book_id": book["id"], "member_id": other_member["id"]},
        headers=admin_headers,
    )
    assert loan_resp.status_code == 201, loan_resp.text
    loan = loan_resp.json()

    forbidden_resp = client.post(f"/loans/{loan['id']}/return", headers=member_headers)
    assert forbidden_resp.status_code == 403

    client.post(f"/loans/{loan['id']}/return", headers=admin_headers)


def test_member_loans_list_only_shows_own(client, member_headers):
    me = client.get("/auth/me", headers=member_headers).json()
    resp = client.get("/loans", params={"status": "borrowed"}, headers=member_headers)
    assert resp.status_code == 200
    for loan in resp.json()["items"]:
        assert loan["member_id"] == me["member_id"]


def test_loan_detail_endpoint(client, member_headers, admin_headers):
    me = client.get("/auth/me", headers=member_headers).json()

    book_resp = client.post(
        "/books",
        json={"title": "Loan Detail Test Book", "isbn": _unique_isbn(), "copies_count": 1},
        headers=admin_headers,
    )
    book = book_resp.json()
    loan = client.post(
        "/loans/borrow", json={"book_id": book["id"]}, headers=member_headers
    ).json()

    # Admin thấy được chi tiết bất kỳ phiếu mượn nào.
    admin_view = client.get(f"/loans/{loan['id']}", headers=admin_headers)
    assert admin_view.status_code == 200, admin_view.text
    body = admin_view.json()
    assert body["status"] == "active"
    assert body["book"]["title"] == "Loan Detail Test Book"
    assert body["member"]["id"] == me["member_id"]

    # Chính chủ xem được.
    assert client.get(f"/loans/{loan['id']}", headers=member_headers).status_code == 200

    # Member khác không xem được phiếu này (403).
    other_username = f"other_{uuid.uuid4().hex[:8]}"
    client.post(
        "/members",
        json={
            "full_name": "Other Member",
            "email": f"{other_username}@example.com",
            "username": other_username,
            "password": "otherpass123",
        },
        headers=admin_headers,
    )
    other_login = client.post(
        "/auth/login", json={"username": other_username, "password": "otherpass123"}
    )
    other_headers = {"Authorization": f"Bearer {other_login.json()['access_token']}"}
    assert client.get(f"/loans/{loan['id']}", headers=other_headers).status_code == 403

    # Không tồn tại → 404.
    assert client.get("/loans/99999999", headers=admin_headers).status_code == 404

    client.post(f"/loans/{loan['id']}/return", headers=member_headers)
