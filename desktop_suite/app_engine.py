"""Local creative records: preserve legacy schema, fail closed on damaged data."""
from __future__ import annotations
import json
import os
from pathlib import Path
import tempfile
from uuid import uuid4


class RecordError(ValueError):
    pass


def unique_object(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise RecordError("Duplicate JSON key")
        result[key] = value
    return result


def read_records(path, empty, validate):
    if path.is_symlink():
        raise RecordError("Symbolic-link store is not supported")
    try:
        raw = path.read_bytes()
    except FileNotFoundError:
        return empty()
    try:
        data = json.loads(raw.decode("utf-8"), object_pairs_hook=unique_object)
        validate(data)
    except (ValueError, TypeError, UnicodeError, KeyError) as exc:
        raise RecordError("Existing records cannot be read; original preserved. Restore a reviewed backup before saving.") from exc
    return data


def append_record(path, empty, validate, insert, entry):
    # Exclusive lock across desktop instances; stale lock blocks rather than overwrites.
    lock = path.with_name(path.name + ".write-lock")
    try:
        fd = os.open(lock, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
    except FileExistsError as exc:
        raise RecordError("Another save is active or a previous save was interrupted. Review the lock before retrying.") from exc
    pending = None
    try:
        os.close(fd)
        data = read_records(path, empty, validate)
        insert(data, entry)
        validate(data)
        payload = json.dumps(data, ensure_ascii=False, indent=2, allow_nan=False).encode("utf-8")
        with tempfile.NamedTemporaryFile(dir=path.parent, prefix=path.name+".", suffix=".tmp", delete=False) as out:
            pending = Path(out.name)
            out.write(payload)
            out.flush()
            os.fsync(out.fileno())
        os.replace(pending, path)
        pending = None
        return data
    finally:
        if pending is not None:
            pending.unlink(missing_ok=True)
        lock.unlink()


def required_text(body, name, *, allow_empty=False, limit=200000):
    value = body.get(name)
    if not isinstance(value, str) or len(value) > limit or (not allow_empty and not value.strip()):
        raise RecordError("Invalid field: " + name)
    return value


def validate_rows(rows, fields):
    if not isinstance(rows, list):
        raise RecordError("Expected record list")
    for row in rows:
        if not isinstance(row, dict) or not all(isinstance(row.get(key), str) for key in fields):
            raise RecordError("Invalid stored record")

def _db():
    import platform_exclusive
    return platform_exclusive.local_data_dir("phoenix-creator-bench") / "universe_bible.json"


def empty():
    return {"universe": "My Universe Bible", "entries": []}


def validate(data):
    if not isinstance(data, dict) or not isinstance(data.get("universe"), str):
        raise RecordError("Invalid universe")
    validate_rows(data.get("entries"), ("id", "kind", "name", "era", "canon", "body"))


def new_entry(body):
    if not isinstance(body, dict):
        raise RecordError("Expected JSON object")
    entry = {"id": "e" + uuid4().hex,
             "kind": required_text(body, "kind", limit=100),
             "name": required_text(body, "name", limit=500),
             "era": required_text(body, "era", allow_empty=True, limit=500),
             "canon": required_text(body, "canon", limit=100),
             "body": required_text(body, "body", allow_empty=True)}
    if entry["kind"] not in {"Character", "Faction", "Timeline", "Lore", "Storyboard Scene"} or entry["canon"] not in {"Locked", "Draft", "Needs Review"}:
        raise RecordError("Invalid canon category")
    return entry


def load_bible():
    return read_records(_db(), empty, validate)


def save_record(body):
    entry = new_entry(body)
    return append_record(_db(), empty, validate, lambda data, row: data["entries"].insert(0, row), entry)

def create_app(port, bundle_root, meta):
    from flask import Flask, jsonify, request, send_from_directory
    import platform_exclusive
    app = Flask(__name__)
    app.config["MAX_CONTENT_LENGTH"] = 2 * 1024 * 1024
    ui_dir, assets_dir = bundle_root / "ui", bundle_root / "assets"

    @app.before_request
    def local_only():
        host = f"127.0.0.1:{port}"
        if request.host != host or (request.headers.get("Origin") and request.headers["Origin"] != f"http://{host}"):
            return jsonify({"ok": False, "error": "Invalid local request origin"}), 403

    @app.route("/")
    def index():
        return send_from_directory(ui_dir, "index.html")

    @app.route("/assets/<path:f>")
    def assets(f):
        return send_from_directory(assets_dir, f)

    @app.route("/api/health")
    def health():
        try:
            load_bible()
        except (RecordError, OSError):
            return jsonify({"ok": False, "app": meta["title"], "error": "Local records unavailable; existing data preserved"}), 503
        return jsonify({"ok": True, "app": meta["title"], "mode": "local-records-only", "full_engine_integrated": False})

    @app.route("/api/platform")
    def plat():
        return jsonify(platform_exclusive.get_system_overview())

    @app.route("/api/bible", methods=["GET", "POST"])
    def records():
        if request.method == "GET":
            try:
                data = load_bible()
                return jsonify(data)
            except (RecordError, OSError):
                return jsonify({"ok": False, "error": "Cannot read local records. Existing file preserved."}), 503
        if not request.is_json:
            return jsonify({"ok": False, "error": "JSON required"}), 415
        body = request.get_json(silent=True)
        try:
            new_entry(body)
        except RecordError as exc:
            return jsonify({"ok": False, "error": str(exc)}), 400
        try:
            data = save_record(body)
        except (RecordError, OSError):
            return jsonify({"ok": False, "error": "Save failed or store unavailable. Do not discard your draft; inspect local records before retrying."}), 503
        return jsonify({"ok": True, "bible": data})

    return app


def start_server(port, bundle_root, meta):
    create_app(port, bundle_root, meta).run(host="127.0.0.1", port=port, debug=False, use_reloader=False)
