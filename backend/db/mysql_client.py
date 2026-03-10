import os
from pathlib import Path


def _driver():
    try:
        import mysql.connector  # type: ignore

        return mysql.connector
    except Exception:
        return None


def db_config():
    return {
        "host": os.getenv("MYSQL_HOST", ""),
        "port": int(os.getenv("MYSQL_PORT", "3306")),
        "user": os.getenv("MYSQL_USER", ""),
        "password": os.getenv("MYSQL_PASSWORD", ""),
        "database": os.getenv("MYSQL_DATABASE", ""),
    }


def mysql_enabled():
    cfg = db_config()
    if not _driver():
        return False
    return bool(cfg["host"] and cfg["user"] and cfg["database"])


def get_connection():
    mysql = _driver()
    if not mysql:
        raise RuntimeError("mysql-connector-python not installed")
    cfg = db_config()
    return mysql.connect(
        host=cfg["host"],
        port=cfg["port"],
        user=cfg["user"],
        password=cfg["password"],
        database=cfg["database"],
    )


def init_schema():
    if not mysql_enabled():
        return False, "MySQL not configured"
    schema_path = Path(__file__).resolve().parent / "schema.sql"
    sql_text = schema_path.read_text(encoding="utf-8")
    statements = [s.strip() for s in sql_text.split(";") if s.strip()]
    conn = get_connection()
    cur = conn.cursor()
    try:
        for stmt in statements:
            cur.execute(stmt)
        conn.commit()
        return True, "Schema ready"
    finally:
        cur.close()
        conn.close()

