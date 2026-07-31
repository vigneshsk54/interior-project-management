import base64
import json
import sqlite3
import uuid
from datetime import date, datetime
from pathlib import Path
from typing import Any

import sqlalchemy as sa
from alembic.config import Config
from alembic.runtime.migration import MigrationContext
from sqlalchemy.dialects.postgresql import insert as postgres_insert

from alembic import command
from app import models  # noqa: F401
from app.db.base import Base
from app.db.session import engine
from app.services.credentials import get_credential_store

MIGRATION_LOCK_ID = 2_026_073_101


def upgrade_database_schema(backend_dir: Path) -> None:
    """Apply Alembic migrations, serializing concurrent Vercel cold starts."""
    alembic_config = Config(str(backend_dir / "alembic.ini"))
    alembic_config.set_main_option("script_location", str(backend_dir / "alembic"))

    if engine.dialect.name != "postgresql":
        command.upgrade(alembic_config, "head")
        return

    with engine.connect() as lock_connection:
        lock_connection.execute(
            sa.text("SELECT pg_advisory_lock(:lock_id)"),
            {"lock_id": MIGRATION_LOCK_ID},
        )
        try:
            current_revision = MigrationContext.configure(
                lock_connection
            ).get_current_revision()
            if current_revision is None:
                Base.metadata.create_all(bind=lock_connection)
                lock_connection.commit()
                command.stamp(alembic_config, "head")
            else:
                command.upgrade(alembic_config, "head")
        finally:
            lock_connection.execute(
                sa.text("SELECT pg_advisory_unlock(:lock_id)"),
                {"lock_id": MIGRATION_LOCK_ID},
            )


def _serialize(value: Any) -> Any:
    if isinstance(value, (date, datetime)):
        return value.isoformat()
    if isinstance(value, uuid.UUID):
        return str(value)
    if isinstance(value, bytes):
        return {"__base64__": base64.b64encode(value).decode()}
    raise TypeError(f"Unsupported migration value: {type(value).__name__}")


def export_local_data(sqlite_path: Path, output_path: Path) -> dict[str, int]:
    """Export local SQL rows and MongoDB credential hashes to a JSON payload."""
    table_names = {table.name for table in Base.metadata.sorted_tables}
    tables: dict[str, list[dict[str, Any]]] = {}
    with sqlite3.connect(sqlite_path) as connection:
        connection.row_factory = sqlite3.Row
        for table_name in sorted(table_names):
            rows = connection.execute(f'SELECT * FROM "{table_name}"').fetchall()
            tables[table_name] = [dict(row) for row in rows]

    credential_store = get_credential_store()
    credential_store.ping()
    credentials = list(credential_store.collection.find({}))
    payload = {"version": 1, "tables": tables, "credentials": credentials}
    output_path.write_text(json.dumps(payload, default=_serialize, separators=(",", ":")))
    return {
        "sql_rows": sum(len(rows) for rows in tables.values()),
        "credentials": len(credentials),
    }


def _convert_value(column: sa.Column[Any], value: Any) -> Any:
    if value is None:
        return None
    if isinstance(column.type, sa.Uuid):
        return value if isinstance(value, uuid.UUID) else uuid.UUID(value)
    if isinstance(column.type, sa.DateTime):
        return value if isinstance(value, datetime) else datetime.fromisoformat(value)
    if isinstance(column.type, sa.Date):
        return value if isinstance(value, date) else date.fromisoformat(value)
    if isinstance(column.type, sa.JSON) and isinstance(value, str):
        return json.loads(value)
    if isinstance(column.type, sa.Boolean):
        return bool(value)
    if isinstance(column.type, sa.LargeBinary) and isinstance(value, dict):
        return base64.b64decode(value["__base64__"])
    return value


def import_production_data(payload: dict[str, Any]) -> dict[str, int]:
    """Idempotently import the one-time production migration payload."""
    if payload.get("version") != 1:
        raise ValueError("Unsupported migration payload version")

    table_payload = payload.get("tables")
    credential_payload = payload.get("credentials")
    if not isinstance(table_payload, dict) or not isinstance(credential_payload, list):
        raise ValueError("Invalid migration payload")

    with engine.begin() as connection:
        for table in Base.metadata.sorted_tables:
            source_rows = table_payload.get(table.name, [])
            if not source_rows:
                continue
            rows = [
                {
                    column.name: _convert_value(column, source_row[column.name])
                    for column in table.columns
                    if column.name in source_row
                }
                for source_row in source_rows
            ]
            statement = postgres_insert(table).values(rows).on_conflict_do_nothing()
            connection.execute(statement)

        verified_rows = sum(
            connection.scalar(sa.select(sa.func.count()).select_from(table)) or 0
            for table in Base.metadata.sorted_tables
        )

    credential_store = get_credential_store()
    credential_store.ping()
    for source_document in credential_payload:
        document = dict(source_document)
        credential_id = document.pop("_id")
        for key in ("created_at", "updated_at"):
            if isinstance(document.get(key), str):
                document[key] = datetime.fromisoformat(document[key])
        credential_store.collection.update_one(
            {"_id": credential_id},
            {"$setOnInsert": document},
            upsert=True,
        )

    credential_ids = [document["_id"] for document in credential_payload]
    verified_credentials = credential_store.collection.count_documents(
        {"_id": {"$in": credential_ids}}
    )

    return {"sql_rows": verified_rows, "credentials": verified_credentials}
