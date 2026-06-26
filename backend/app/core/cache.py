"""Tiny TTL cache for external API calls (rate-limit / cost relief).
ponytail: in-process dict, fine for one Render instance. Swap for Redis if we
ever run multiple backend replicas."""
import time
from functools import wraps

_store: dict = {}


def ttl_cache(seconds: int):
    def deco(fn):
        @wraps(fn)
        def wrap(*args, **kwargs):
            key = (fn.__name__, args, tuple(sorted(kwargs.items())))
            hit = _store.get(key)
            if hit and hit[0] > time.time():
                return hit[1]
            val = fn(*args, **kwargs)
            _store[key] = (time.time() + seconds, val)
            return val
        return wrap
    return deco
