# Danh sách sách phải chứa dữ liệu seed (có "Foundation").
def test_list_books_returns_seed_data(client):
    resp = client.get("/books", params={"page_size": 100})
    assert resp.status_code == 200
    body = resp.json()
    assert any(b["title"] == "Foundation" for b in body["items"])
    assert body["total"] >= 1


# Tìm kiếm full-text theo tên phải trả về đúng sách.
def test_search_books_full_text(client):
    resp = client.get("/books", params={"search": "Foundation"})
    assert resp.status_code == 200
    titles = [b["title"] for b in resp.json()["items"]]
    assert "Foundation" in titles


# Chưa đăng nhập mà tạo sách phải bị từ chối (401/403).
def test_create_book_requires_admin(client):
    resp = client.post(
        "/books",
        json={"title": "Test Book", "isbn": "978-9999999999", "copies_count": 1},
    )
    assert resp.status_code in (401, 403)


# Admin tạo sách 2 bản sao -> tổng và số bản sao rảnh đều bằng 2.
def test_create_book_as_admin(client, admin_headers):
    import uuid

    isbn = f"978-{uuid.uuid4().int % 10**10:010d}"
    resp = client.post(
        "/books",
        json={"title": "Clean Architecture", "isbn": isbn, "copies_count": 2},
        headers=admin_headers,
    )
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["total_copies"] == 2
    assert body["available_copies"] == 2
