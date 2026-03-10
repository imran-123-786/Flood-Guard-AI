from db.mysql_client import get_connection


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
    cur = conn.cursor(dictionary=True)
    try:
        cur.execute(
            "SELECT id, name, email, password_hash, created_at FROM users WHERE email=%s LIMIT 1",
            (email,),
        )
        return cur.fetchone()
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
    cur = conn.cursor(dictionary=True)
    try:
        cur.execute(
            "SELECT token, user_id, email, name, created_at FROM sessions WHERE token=%s LIMIT 1",
            (token,),
        )
        return cur.fetchone()
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
            """,
            (name, phone, area, skill, lat, lon, created_at),
        )
        conn.commit()
        return cur.lastrowid
    finally:
        cur.close()
        conn.close()


def list_volunteers(limit=100):
    conn = get_connection()
    cur = conn.cursor(dictionary=True)
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
        return cur.fetchall()
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
            """,
            (text, priority, area, status, lat, lon, created_at),
        )
        conn.commit()
        return cur.lastrowid
    finally:
        cur.close()
        conn.close()


def list_help_requests(limit=100):
    conn = get_connection()
    cur = conn.cursor(dictionary=True)
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
        return cur.fetchall()
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
            """,
            (event_type, message, lat, lon, created_at),
        )
        conn.commit()
        return cur.lastrowid
    finally:
        cur.close()
        conn.close()


def list_history_events(limit=200):
    conn = get_connection()
    cur = conn.cursor(dictionary=True)
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
        return cur.fetchall()
    finally:
        cur.close()
        conn.close()

