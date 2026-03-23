import os
from pathlib import Path


def _driver():
    try:
        import psycopg2  # type: ignore

        return psycopg2
    except Exception:
        return None


def db_config():
    return {
        "host": os.getenv("POSTGRES_HOST", ""),
        "port": int(os.getenv("POSTGRES_PORT", "5432")),
        "user": os.getenv("POSTGRES_USER", ""),
        "password": os.getenv("POSTGRES_PASSWORD", ""),
        "database": os.getenv("POSTGRES_DB", ""),
        "sslmode": os.getenv("POSTGRES_SSLMODE", "prefer"),
    }


def postgres_enabled():
    cfg = db_config()
    if not _driver():
        return False
    return bool(cfg["host"] and cfg["user"] and cfg["database"])


def get_connection():
    psycopg2 = _driver()
    if not psycopg2:
        raise RuntimeError("psycopg2-binary not installed")
    cfg = db_config()
    return psycopg2.connect(
        host=cfg["host"],
        port=cfg["port"],
        user=cfg["user"],
        password=cfg["password"],
        dbname=cfg["database"],
        sslmode=cfg["sslmode"],
    )


def init_schema():
    if not postgres_enabled():
        return False, "PostgreSQL not configured"
    schema_path = Path(__file__).resolve().parent / "schema_postgres.sql"
    sql_text = schema_path.read_text(encoding="utf-8")
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute(sql_text)
        conn.commit()
        return True, "Schema ready"
    finally:
        cur.close()
        conn.close()
