"""Kiểm chứng cơ chế khóa tương tranh khi mượn sách (SELECT ... FOR UPDATE SKIP LOCKED).
Xem docs/DATABASE.md mục 3 và mục 9 (kết quả thực nghiệm) — ghi lại kết quả chạy
thực tế của test này vào đó để dùng làm minh chứng trong báo cáo đồ án.
"""
import uuid
from concurrent.futures import ThreadPoolExecutor

N_CONCURRENT_REQUESTS = 10


def test_concurrent_borrow_last_copy_only_one_succeeds(client, admin_headers):
    # Tự tạo 1 sách riêng chỉ với đúng 1 bản sao — tránh phụ thuộc dữ liệu seed
    # dùng chung với các test khác (từng gây flaky khi seed bị chỉnh tay lúc debug).
    run_id = uuid.uuid4().hex[:8]
    book_resp = client.post(
        "/books",
        json={
            "title": f"Concurrency Test Book {run_id}",
            "isbn": f"978-{uuid.uuid4().int % 10**10:010d}",
            "copies_count": 1,
        },
        headers=admin_headers,
    )
    assert book_resp.status_code == 201, book_resp.text
    book = book_resp.json()
    assert book["available_copies"] == 1

    member_ids = []
    for i in range(N_CONCURRENT_REQUESTS):
        resp = client.post(
            "/members",
            json={
                "full_name": f"Concurrency Tester {i}",
                "email": f"concurrency_tester_{run_id}_{i}@example.com",
            },
            headers=admin_headers,
        )
        assert resp.status_code in (201,), resp.text
        member_ids.append(resp.json()["id"])

    def _borrow(member_id):
        return client.post(
            "/loans/borrow",
            json={"book_id": book["id"], "member_id": member_id},
            headers=admin_headers,
        )

    with ThreadPoolExecutor(max_workers=N_CONCURRENT_REQUESTS) as pool:
        responses = list(pool.map(_borrow, member_ids))

    status_codes = [r.status_code for r in responses]
    success_count = sum(1 for code in status_codes if code == 201)
    conflict_count = sum(1 for code in status_codes if code == 409)
    server_error_count = sum(1 for code in status_codes if code >= 500)

    assert server_error_count == 0, f"Không được có lỗi 500/deadlock: {status_codes}"
    assert success_count == 1, f"Phải đúng 1 request thành công, thực tế: {status_codes}"
    assert conflict_count == N_CONCURRENT_REQUESTS - 1

    # Dọn dẹp: chỉ trả sách. Không xoá sách test — nó đã có lịch sử mượn nên API
    # sẽ chặn xoá (409, giữ audit trail), đúng theo thiết kế ở app/routers/books.py.
    for r in responses:
        if r.status_code == 201:
            client.post(f"/loans/{r.json()['id']}/return", headers=admin_headers)
