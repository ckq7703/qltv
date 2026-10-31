# Tạo rồi sửa một sách bằng admin -> audit_log phải có 2 dòng, changed_by là admin.
def test_book_changes_record_actor(client, admin_headers):
    created = client.post(
        "/books",
        json={"title": "Test Book Audit", "isbn": "TEST-AUDIT-0001", "copies_count": 1},
        headers=admin_headers,
    )
    assert created.status_code == 201, created.text
    book_id = created.json()["id"]

    updated = client.put(
        f"/books/{book_id}", json={"title": "Test Book Audit v2"}, headers=admin_headers
    )
    assert updated.status_code == 200, updated.text

    resp = client.get(
        "/audit-logs",
        params={"table_name": "books", "row_id": book_id},
        headers=admin_headers,
    )
    assert resp.status_code == 200, resp.text
    items = resp.json()["items"]
    # Mới nhất trước: UPDATE rồi tới INSERT.
    assert [i["operation"] for i in items] == ["UPDATE", "INSERT"]
    assert all(i["changed_by_username"] == "admin" for i in items)
    assert items[0]["old_data"]["title"] == "Test Book Audit"
    assert items[0]["new_data"]["title"] == "Test Book Audit v2"
    assert items[1]["old_data"] is None


# Member tự mượn sách -> dòng audit của loans phải ghi đúng member đó, không bị lẫn với admin.
def test_member_borrow_records_member_as_actor(client, admin_headers, member_headers):
    books = client.get("/books", params={"search": "Foundation"}).json()["items"]
    book = next(b for b in books if b["title"] == "Foundation")

    borrow = client.post("/loans/borrow", json={"book_id": book["id"]}, headers=member_headers)
    assert borrow.status_code == 201, borrow.text
    loan_id = borrow.json()["id"]
    client.post(f"/loans/{loan_id}/return", headers=member_headers)

    resp = client.get(
        "/audit-logs",
        params={"table_name": "loans", "row_id": loan_id},
        headers=admin_headers,
    )
    items = resp.json()["items"]
    assert [i["operation"] for i in items] == ["UPDATE", "INSERT"]
    assert all(i["changed_by_username"] == "vana" for i in items)


# Chỉ admin được xem audit log.
def test_audit_logs_admin_only(client, member_headers):
    assert client.get("/audit-logs").status_code in (401, 403)
    assert client.get("/audit-logs", headers=member_headers).status_code == 403
