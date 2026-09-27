"""Thông báo realtime cho admin qua Redis Pub/Sub + WebSocket.

Luồng: khi member tự mượn sách (không phải admin mượn hộ), backend publish 1
message JSON vào kênh Redis NOTIFY_CHANNEL. Mọi admin đang mở WebSocket
(routers/notifications.py) nhận được message này gần như ngay lập tức, không
cần polling. Đây là ví dụ minh hoạ Redis dùng cho pub/sub, khác với vai trò
cache-aside đã dùng ở app/cache/books_cache.py.
"""
import json
from datetime import datetime, timezone

from app.cache.redis_client import redis_client

NOTIFY_CHANNEL = "notifications:admin"


def notify_book_borrowed(
    *, loan_id: int, book_title: str, member_name: str, due_date: datetime
) -> None:
    payload = {
        "type": "book_borrowed",
        "loan_id": loan_id,
        "book_title": book_title,
        "member_name": member_name,
        "due_date": due_date.isoformat(),
        "occurred_at": datetime.now(timezone.utc).isoformat(),
    }
    # publish() là lệnh sync nhanh (fire-and-forget) — an toàn gọi trực tiếp
    # trong route handler sync, FastAPI đã chạy handler đó trong threadpool riêng.
    redis_client.publish(NOTIFY_CHANNEL, json.dumps(payload))
