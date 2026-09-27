import redis
import redis.asyncio as redis_async

from app.config import settings

redis_client = redis.Redis.from_url(settings.redis_url, decode_responses=True)

# Client async riêng cho WebSocket pub/sub (notifications.py) — dùng client sync ở đây
# sẽ block event loop của FastAPI khi lắng nghe kênh Redis liên tục.
async_redis_client = redis_async.Redis.from_url(settings.redis_url, decode_responses=True)
