from collections import defaultdict, deque
from time import monotonic

from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Per-process protection for sensitive routes; use Redis for multi-instance limits."""

    windows: dict[str, deque[float]] = defaultdict(deque)
    limits = {
        "/api/v1/auth/login": 10,
        "/api/v1/auth/register": 5,
        "/api/v1/auth/refresh": 20,
        "/api/v1/portal/client/enquiries": 10,
        "/api/v1/webhooks/n8n": 120,
    }

    async def dispatch(self, request: Request, call_next):
        limit = self.limits.get(request.url.path)
        if limit and request.method == "POST":
            client = request.client.host if request.client else "unknown"
            key = f"{client}:{request.url.path}"
            now = monotonic()
            window = self.windows[key]
            while window and now - window[0] >= 60:
                window.popleft()
            if len(window) >= limit:
                return JSONResponse(
                    status_code=429,
                    content={
                        "error": {"code": "rate_limited", "message": "Please try again later."}
                    },
                    headers={"Retry-After": "60"},
                )
            window.append(now)
        return await call_next(request)
