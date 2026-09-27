def _find_book(client, title):
    books = client.get("/books", params={"search": title, "page_size": 100}).json()["items"]
    return next(b for b in books if b["title"] == title)


def _find_member(client, admin_headers, email):
    members = client.get("/members", params={"search": email, "page_size": 100}).json()["items"]
    return next(m for m in members if m["email"] == email)


def test_borrow_and_return_flow(client, admin_headers):
    book = _find_book(client, "Dế Mèn phiêu lưu ký")
    member = _find_member(client, admin_headers, "thib@example.com")

    borrow_resp = client.post(
        "/loans/borrow",
        json={"book_id": book["id"], "member_id": member["id"]},
        headers=admin_headers,
    )
    assert borrow_resp.status_code == 201, borrow_resp.text
    loan = borrow_resp.json()
    assert loan["returned_at"] is None

    return_resp = client.post(f"/loans/{loan['id']}/return", headers=admin_headers)
    assert return_resp.status_code == 200
    assert return_resp.json()["returned_at"] is not None


def test_overdue_loans_endpoint(client, admin_headers):
    resp = client.get("/loans", params={"status": "overdue"}, headers=admin_headers)
    assert resp.status_code == 200
    # Seed data tạo sẵn 1 loan quá hạn cho "Dế Mèn phiêu lưu ký".
    assert resp.json()["total"] >= 1


def test_loans_requires_auth(client):
    resp = client.get("/loans")
    assert resp.status_code in (401, 403)


def test_borrow_limit_enforced(client, admin_headers):
    member = _find_member(client, admin_headers, "vanc@example.com")
    titles = [
        "Cho tôi xin một vé đi tuổi thơ",
        "Dế Mèn phiêu lưu ký",
        "Designing Data-Intensive Applications",
    ]
    borrowed_loan_ids = []
    for title in titles:
        book = _find_book(client, title)
        resp = client.post(
            "/loans/borrow",
            json={"book_id": book["id"], "member_id": member["id"]},
            headers=admin_headers,
        )
        assert resp.status_code == 201, resp.text
        borrowed_loan_ids.append(resp.json()["id"])

    # Mượn cuốn thứ 4 phải bị chặn vì giới hạn tối đa 3 cuốn/độc giả.
    extra_book = _find_book(client, "Foundation")
    resp = client.post(
        "/loans/borrow",
        json={"book_id": extra_book["id"], "member_id": member["id"]},
        headers=admin_headers,
    )
    assert resp.status_code == 409

    for loan_id in borrowed_loan_ids:
        client.post(f"/loans/{loan_id}/return", headers=admin_headers)
