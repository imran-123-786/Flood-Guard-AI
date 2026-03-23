from db.postgres_client import get_connection


def _fetch_one_dict(cur):
    row = cur.fetchone()
    if not row:
        return None
    cols = [d[0] for d in cur.description]
    return dict(zip(cols, row))


def _fetch_all_dict(cur):
    rows = cur.fetchall()
    if not rows:
        return []
    cols = [d[0] for d in cur.description]
    return [dict(zip(cols, row)) for row in rows]


def ping():
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute("SELECT 1")
        cur.fetchone()
        return True
    finally:
        cur.close()
        conn.close()


def get_user_by_email(email):
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            "SELECT id, name, email, password_hash, created_at FROM users WHERE email=%s LIMIT 1",
            (email,),
        )
        return _fetch_one_dict(cur)
    finally:
        cur.close()
        conn.close()


def create_user(user_id, name, email, password_hash, created_at):
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            "INSERT INTO users (id, name, email, password_hash, created_at) VALUES (%s,%s,%s,%s,%s)",
            (user_id, name, email, password_hash, created_at),
        )
        conn.commit()
        return True
    finally:
        cur.close()
        conn.close()


def create_session(token, user_id, email, name, created_at):
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            "INSERT INTO sessions (token, user_id, email, name, created_at) VALUES (%s,%s,%s,%s,%s)",
            (token, user_id, email, name, created_at),
        )
        conn.commit()
        return True
    finally:
        cur.close()
        conn.close()


def get_session(token):
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            "SELECT token, user_id, email, name, created_at FROM sessions WHERE token=%s LIMIT 1",
            (token,),
        )
        return _fetch_one_dict(cur)
    finally:
        cur.close()
        conn.close()


def delete_session(token):
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute("DELETE FROM sessions WHERE token=%s", (token,))
        conn.commit()
        return True
    finally:
        cur.close()
        conn.close()


def add_volunteer(name, phone, area, skill, lat, lon, created_at):
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            """
            INSERT INTO community_volunteers (name, phone, area, skill, lat, lon, created_at)
            VALUES (%s,%s,%s,%s,%s,%s,%s)
            RETURNING id
            """,
            (name, phone, area, skill, lat, lon, created_at),
        )
        rid = cur.fetchone()[0]
        conn.commit()
        return rid
    finally:
        cur.close()
        conn.close()


def list_volunteers(limit=100):
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            """
            SELECT id, name, phone, area, skill, lat, lon, created_at
            FROM community_volunteers
            ORDER BY id DESC
            LIMIT %s
            """,
            (int(limit),),
        )
        return _fetch_all_dict(cur)
    finally:
        cur.close()
        conn.close()


def add_help_request(text, priority, area, status, lat, lon, created_at):
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            """
            INSERT INTO community_help_requests (request_text, priority, area, status, lat, lon, created_at)
            VALUES (%s,%s,%s,%s,%s,%s,%s)
            RETURNING id
            """,
            (text, priority, area, status, lat, lon, created_at),
        )
        rid = cur.fetchone()[0]
        conn.commit()
        return rid
    finally:
        cur.close()
        conn.close()


def list_help_requests(limit=100):
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            """
            SELECT id, request_text, priority, area, status, lat, lon, created_at
            FROM community_help_requests
            ORDER BY id DESC
            LIMIT %s
            """,
            (int(limit),),
        )
        return _fetch_all_dict(cur)
    finally:
        cur.close()
        conn.close()


def resolve_help_request(request_id):
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            "UPDATE community_help_requests SET status='resolved' WHERE id=%s",
            (int(request_id),),
        )
        conn.commit()
        return True
    finally:
        cur.close()
        conn.close()


def add_history_event(event_type, message, lat, lon, created_at):
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            """
            INSERT INTO history_events (event_type, message, lat, lon, created_at)
            VALUES (%s,%s,%s,%s,%s)
            RETURNING id
            """,
            (event_type, message, lat, lon, created_at),
        )
        rid = cur.fetchone()[0]
        conn.commit()
        return rid
    finally:
        cur.close()
        conn.close()


def list_history_events(limit=200):
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            """
            SELECT id, event_type, message, lat, lon, created_at
            FROM history_events
            ORDER BY id DESC
            LIMIT %s
            """,
            (int(limit),),
        )
        return _fetch_all_dict(cur)
    finally:
        cur.close()
        conn.close()
