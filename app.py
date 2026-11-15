import base64
import os
import re
import secrets
import sqlite3
from functools import wraps
from flask import Flask, render_template, request, jsonify, g, session, redirect, url_for
from werkzeug.security import generate_password_hash, check_password_hash

app = Flask(__name__)
DB_PATH = os.path.join(app.root_path, "myspace.db")
ALLOWED_TYPES = {"note", "link", "spotify"}
USERNAME_RE = re.compile(r"^[a-z0-9_]{3,20}$")
AVATAR_PREFIX = "data:image/jpeg;base64,"
MAX_AVATAR_BYTES = 150_000


# ---------- Secret key (signs the login cookie) ----------
def load_secret_key():
    """Use the SECRET_KEY environment variable if set, otherwise make
    a random key once and keep it in secret_key.txt (ignored by git)."""
    from_env = os.environ.get("SECRET_KEY")
    if from_env:
        return from_env
    path = os.path.join(app.root_path, "secret_key.txt")
    if not os.path.exists(path):
        with open(path, "w") as f:
            f.write(secrets.token_hex(32))
    with open(path) as f:
        return f.read().strip()


app.config.update(
    SECRET_KEY=load_secret_key(),
    SESSION_COOKIE_HTTPONLY=True,
    SESSION_COOKIE_SAMESITE="Lax",
    MAX_CONTENT_LENGTH=1_000_000,  # refuse requests bigger than 1 MB
)


# ---------- Database helpers ----------
def get_db():
    """Open a database connection for this request (and reuse it)."""
    if "db" not in g:
        g.db = sqlite3.connect(DB_PATH)
        g.db.row_factory = sqlite3.Row  # lets us read rows like dictionaries
    return g.db


@app.teardown_appcontext
def close_db(error):
    db = g.pop("db", None)
    if db is not None:
        db.close()


def init_db():
    """Create the tables the first time the app runs."""
    conn = sqlite3.connect(DB_PATH)
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL UNIQUE,
            password_hash TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
        """
    )
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS blocks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            type TEXT NOT NULL,
            title TEXT NOT NULL DEFAULT '',
            content TEXT NOT NULL DEFAULT '',
            url TEXT NOT NULL DEFAULT '',
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            user_id INTEGER
        )
        """
    )
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS profiles (
            user_id INTEGER PRIMARY KEY,
            display_name TEXT NOT NULL DEFAULT '',
            tagline TEXT NOT NULL DEFAULT '',
            bio TEXT NOT NULL DEFAULT '',
            avatar TEXT NOT NULL DEFAULT ''
        )
        """
    )

    # Older databases don't have the user_id column yet, so add it
    columns = [row[1] for row in conn.execute("PRAGMA table_info(blocks)")]
    if "user_id" not in columns:
        conn.execute("ALTER TABLE blocks ADD COLUMN user_id INTEGER")

    # Blocks made before accounts existed go to the first account
    conn.execute(
        "UPDATE blocks SET user_id = (SELECT MIN(id) FROM users) WHERE user_id IS NULL"
    )

    conn.commit()
    conn.close()


def current_user():
    """Return the logged-in user, or None."""
    user_id = session.get("user_id")
    if user_id is None:
        return None
    return get_db().execute(
        "SELECT id, username FROM users WHERE id = ?", (user_id,)
    ).fetchone()


def login_required(view):
    """Block an API route unless someone is logged in."""
    @wraps(view)
    def wrapped(*args, **kwargs):
        user = current_user()
        if user is None:
            return jsonify(error="Please log in"), 401
        g.user = user
        return view(*args, **kwargs)
    return wrapped


# ---------- Pages ----------
@app.route("/")
def home():
    if current_user() is None:
        return redirect(url_for("login_page"))
    return render_template("index.html")


@app.route("/login")
def login_page():
    return render_template("login.html")


# ---------- Accounts API ----------
@app.route("/api/register", methods=["POST"])
def register():
    data = request.get_json(silent=True) or {}
    username = str(data.get("username", "")).strip().lower()
    password = str(data.get("password", ""))

    if not USERNAME_RE.match(username):
        return jsonify(error="Username must be 3 to 20 characters: letters, numbers or underscores"), 400
    if len(password) < 8:
        return jsonify(error="Password must be at least 8 characters"), 400
    if len(password) > 128:
        return jsonify(error="Password is too long"), 400

    db = get_db()
    try:
        cursor = db.execute(
            "INSERT INTO users (username, password_hash) VALUES (?, ?)",
            (username, generate_password_hash(password)),
        )
        db.commit()
    except sqlite3.IntegrityError:
        return jsonify(error="That username is taken"), 409

    session.clear()
    session["user_id"] = cursor.lastrowid
    return jsonify(username=username), 201


@app.route("/api/login", methods=["POST"])
def login():
    data = request.get_json(silent=True) or {}
    username = str(data.get("username", "")).strip().lower()
    password = str(data.get("password", ""))

    row = get_db().execute(
        "SELECT id, password_hash FROM users WHERE username = ?", (username,)
    ).fetchone()

    # Same message for "no such user" and "wrong password" on purpose
    if len(password) > 128 or row is None or not check_password_hash(row["password_hash"], password):
        return jsonify(error="Wrong username or password"), 401

    session.clear()
    session["user_id"] = row["id"]
    return jsonify(username=username)


@app.route("/api/logout", methods=["POST"])
def logout():
    session.clear()
    return jsonify(ok=True)


@app.route("/api/me")
def me():
    user = current_user()
    if user is None:
        return jsonify(user=None)
    return jsonify(user={"username": user["username"]})


# ---------- Profile API (About me) ----------
def valid_avatar(value):
    """Accept only a small JPEG sent as a data URL."""
    if not value.startswith(AVATAR_PREFIX):
        return False
    try:
        raw = base64.b64decode(value[len(AVATAR_PREFIX):], validate=True)
    except ValueError:
        return False
    return len(raw) <= MAX_AVATAR_BYTES and raw[:3] == b"\xff\xd8\xff"


def profile_for(user):
    row = get_db().execute(
        "SELECT display_name, tagline, bio, avatar FROM profiles WHERE user_id = ?",
        (user["id"],),
    ).fetchone()
    data = {"display_name": "", "tagline": "", "bio": "", "avatar": ""}
    if row:
        data.update(dict(row))
    data["username"] = user["username"]
    return data


@app.route("/api/profile", methods=["GET"])
@login_required
def get_profile():
    return jsonify(profile_for(g.user))


@app.route("/api/profile", methods=["PUT"])
@login_required
def save_profile():
    data = request.get_json(silent=True) or {}
    current = profile_for(g.user)

    display_name = str(data.get("display_name", current["display_name"])).strip()[:60]
    tagline = str(data.get("tagline", current["tagline"])).strip()[:100]
    bio = str(data.get("bio", current["bio"])).strip()[:1000]

    avatar = current["avatar"]
    if "avatar" in data:  # missing = keep the old photo, "" = remove it
        avatar = str(data["avatar"])
        if avatar and not valid_avatar(avatar):
            return jsonify(error="That photo couldn't be used. Try a different image."), 400

    db = get_db()
    db.execute(
        """
        INSERT INTO profiles (user_id, display_name, tagline, bio, avatar)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(user_id) DO UPDATE SET
            display_name = excluded.display_name,
            tagline = excluded.tagline,
            bio = excluded.bio,
            avatar = excluded.avatar
        """,
        (g.user["id"], display_name, tagline, bio, avatar),
    )
    db.commit()
    return jsonify(profile_for(g.user))


# ---------- Blocks API (only for logged-in users, and only their own) ----------
@app.route("/api/blocks", methods=["GET"])
@login_required
def list_blocks():
    rows = get_db().execute(
        "SELECT * FROM blocks WHERE user_id = ? ORDER BY id DESC", (g.user["id"],)
    ).fetchall()
    return jsonify([dict(row) for row in rows])


@app.route("/api/blocks", methods=["POST"])
@login_required
def add_block():
    data = request.get_json(silent=True) or {}

    block_type = data.get("type")
    if block_type not in ALLOWED_TYPES:
        return jsonify(error="Unknown block type"), 400

    title = str(data.get("title", "")).strip()[:100]
    content = str(data.get("content", "")).strip()[:5000]
    url = str(data.get("url", "")).strip()[:500]

    # Always check on the server too. Never trust the browser.
    if block_type == "note" and not content:
        return jsonify(error="A note needs some text"), 400
    if block_type == "link" and not url.startswith(("http://", "https://")):
        return jsonify(error="A link must start with http:// or https://"), 400
    if block_type == "spotify" and not url.startswith("https://open.spotify.com/"):
        return jsonify(error="That doesn't look like a Spotify link"), 400

    db = get_db()
    cursor = db.execute(
        "INSERT INTO blocks (type, title, content, url, user_id) VALUES (?, ?, ?, ?, ?)",
        (block_type, title, content, url, g.user["id"]),
    )
    db.commit()

    row = db.execute("SELECT * FROM blocks WHERE id = ?", (cursor.lastrowid,)).fetchone()
    return jsonify(dict(row)), 201


@app.route("/api/blocks/<int:block_id>", methods=["DELETE"])
@login_required
def delete_block(block_id):
    db = get_db()
    # The user_id check means you can only delete your own blocks
    cursor = db.execute(
        "DELETE FROM blocks WHERE id = ? AND user_id = ?", (block_id, g.user["id"])
    )
    db.commit()
    if cursor.rowcount == 0:
        return jsonify(error="Not found"), 404
    return jsonify(ok=True)


init_db()

if __name__ == "__main__":
    app.run(debug=True)