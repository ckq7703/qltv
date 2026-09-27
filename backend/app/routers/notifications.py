import asyncio

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.cache.redis_client import async_redis_client
from app.notifications import NOTIFY_CHANNEL
from app.security import decode_access_token

router = APIRouter(tags=["notifications"])


@router.websocket("/ws/notifications")
async def ws_notifications(websocket: WebSocket, token: str):
    """WebSocket cho admin nhận thông báo realtime (VD: member vừa tự mượn sách).

    Trình duyệt (WebSocket API gốc) không gửi được header Authorization, nên
    access token được truyền qua query param — đủ dùng cho quy mô đồ án, không
    phục vụ mục đích production thật (token có thể lộ qua log truy cập).
    """
    try:
        claims = decode_access_token(token)
    except ValueError:
        await websocket.close(code=4401)
        return
    if claims.get("role") != "admin":
        await websocket.close(code=4403)
        return

    await websocket.accept()
    pubsub = async_redis_client.pubsub()
    await pubsub.subscribe(NOTIFY_CHANNEL)

    async def forward_messages() -> None:
        async for message in pubsub.listen():
            if message["type"] != "message":
                continue
            await websocket.send_text(message["data"])

    async def watch_disconnect() -> None:
        # pubsub.listen() ở trên chỉ GỬI, không bao giờ tự phát hiện client đóng kết nối.
        # Không có task riêng canh receive() thì handler treo vĩnh viễn ngay cả khi trình
        # duyệt đã đóng tab — khiến uvicorn không bao giờ shutdown/reload xong (từng gây
        # treo cả server trong lúc phát triển). Task này chỉ tồn tại để bắt sự kiện đó.
        try:
            while True:
                await websocket.receive_text()
        except WebSocketDisconnect:
            pass

    forward_task = asyncio.create_task(forward_messages())
    disconnect_task = asyncio.create_task(watch_disconnect())
    try:
        await asyncio.wait(
            {forward_task, disconnect_task}, return_when=asyncio.FIRST_COMPLETED
        )
    finally:
        forward_task.cancel()
        disconnect_task.cancel()
        for task in (forward_task, disconnect_task):
            try:
                await task
            except (asyncio.CancelledError, WebSocketDisconnect, Exception):
                pass
        await pubsub.unsubscribe(NOTIFY_CHANNEL)
        await pubsub.aclose()
