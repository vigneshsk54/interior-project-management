import os
import sys
from pathlib import Path
from urllib.parse import parse_qsl, urlencode

BACKEND_DIR = Path(__file__).resolve().parents[1] / "backend"
sys.path.insert(0, str(BACKEND_DIR))

from app.main import app as backend_app
from app.production_migration import upgrade_database_schema

if os.getenv("VERCEL"):
    upgrade_database_schema(BACKEND_DIR)


class VercelRewritePathAdapter:
    def __init__(self, wrapped_app):
        self.wrapped_app = wrapped_app

    async def __call__(self, scope, receive, send):
        if scope["type"] not in {"http", "websocket"}:
            await self.wrapped_app(scope, receive, send)
            return

        query_items = parse_qsl(scope.get("query_string", b"").decode(), keep_blank_values=True)
        original_path = next(
            (value for key, value in query_items if key == "__original_path"), None
        )
        if original_path:
            forwarded_scope = dict(scope)
            restored_path = "/" + original_path.lstrip("/")
            forwarded_scope["path"] = restored_path
            forwarded_scope["raw_path"] = restored_path.encode()
            forwarded_scope["query_string"] = urlencode(
                [(key, value) for key, value in query_items if key != "__original_path"]
            ).encode()
            scope = forwarded_scope
        await self.wrapped_app(scope, receive, send)


app = VercelRewritePathAdapter(backend_app)
