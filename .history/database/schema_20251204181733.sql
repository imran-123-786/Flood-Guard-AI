CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    email TEXT,
    phone TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    text TEXT,
    lat REAL,
    lon REAL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE volunteers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    phone TEXT,
    area TEXT
);

CREATE TABLE history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    action_type TEXT,
    message TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
