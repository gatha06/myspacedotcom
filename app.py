import os
import sqlite3
from flask import Flask, render_template, request, jsonify, g

app = Flask(__name__)
DB_PATH = os.path.join(app.root_path, "myspace.db")
ALLOWED_TYPES = {"note", "link"}


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
    """Create the blocks table the first time the app runs."""
    conn = sqlite3.connect(DB_PATH)
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS blocks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            type TEXT NOT NULL,
            title TEXT NOT NULL DEFAULT '',
            content TEXT NOT NULL DEFAULT '',
            url TEXT NOT NULL DEFAULT '',
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
        """
    )
    conn.commit()
    conn.close()


# ---------- Pages ----------
@app.route("/")
def home():
    return render_template("index.html")


# ---------- API ----------
@app.route("/api/blocks", methods=["GET"])
def list_blocks():
    rows = get_db().execute("SELECT * FROM blocks ORDER BY id DESC").fetchall()
    return jsonify([dict(row) for row in rows])


@app.route("/api/blocks", methods=["POST"])
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

    db = get_db()
    cursor = db.execute(
        "INSERT INTO blocks (type, title, content, url) VALUES (?, ?, ?, ?)",
        (block_type, title, content, url),
    )
    db.commit()

    row = db.execute("SELECT * FROM blocks WHERE id = ?", (cursor.lastrowid,)).fetchone()
    return jsonify(dict(row)), 201


@app.route("/api/blocks/<int:block_id>", methods=["DELETE"])
def delete_block(block_id):
    db = get_db()
    cursor = db.execute("DELETE FROM blocks WHERE id = ?", (block_id,))
    db.commit()
    if cursor.rowcount == 0:
        return jsonify(error="Not found"), 404
    return jsonify(ok=True)


init_db()

if __name__ == "__main__":
    app.run(debug=True)