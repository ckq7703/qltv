import hashlib
import json
from typing import Any, Callable

from app.cache.redis_client import redis_client

SEARCH_CACHE_TTL_SECONDS = 60
SEARCH_CACHE_PREFIX = "books:search:"
HIT_COUNTER_KEY = "cache:books_search:hits"
MISS_COUNTER_KEY = "cache:books_search:misses"


def _cache_key(params: dict[str, Any]) -> str:
    raw = "&".join(f"{k}={params[k] if params[k] is not None else ''}" for k in sorted(params))
    digest = hashlib.sha256(raw.encode()).hexdigest()
    return f"{SEARCH_CACHE_PREFIX}{digest}"


def get_or_set_search_cache(params: dict[str, Any], loader: Callable[[], dict]) -> dict:
    """Cache-aside pattern: đọc cache trước, miss thì query DB rồi set lại cache với TTL.
    `params` gồm mọi tham số ảnh hưởng kết quả (search, filter, sort, phân trang)
    để tránh trả nhầm kết quả đã cache của một tổ hợp tham số khác.
    """
    key = _cache_key(params)
    cached = redis_client.get(key)
    if cached is not None:
        redis_client.incr(HIT_COUNTER_KEY)
        return json.loads(cached)

    redis_client.incr(MISS_COUNTER_KEY)
    result = loader()
    redis_client.set(key, json.dumps(result, default=str), ex=SEARCH_CACHE_TTL_SECONDS)
    return result


def invalidate_book_search_cache() -> None:
    """Gọi khi books/book_copies thay đổi để tránh trả kết quả tìm kiếm cũ."""
    cursor = 0
    while True:
        cursor, keys = redis_client.scan(cursor, match=f"{SEARCH_CACHE_PREFIX}*", count=100)
        if keys:
            redis_client.delete(*keys)
        if cursor == 0:
            break


def get_cache_stats() -> dict:
    hits = int(redis_client.get(HIT_COUNTER_KEY) or 0)
    misses = int(redis_client.get(MISS_COUNTER_KEY) or 0)
    total = hits + misses
    ratio = hits / total if total else 0.0
    return {"hits": hits, "misses": misses, "hit_ratio": round(ratio, 4)}
