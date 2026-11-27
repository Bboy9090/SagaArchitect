"""Phoenix Creator Bench (SagaArchitect) — Local-First Universe Bible & Canon Engine."""
from __future__ import annotations
import json
from datetime import datetime
from pathlib import Path
from flask import Flask, jsonify, request, send_from_directory
import platform_exclusive

DEFAULT_BIBLE = {"universe": "My Universe Bible", "entries": []}

def _db() -> Path:
    return platform_exclusive.local_data_dir("phoenix-creator-bench") / "universe_bible.json"

def load_bible() -> dict:
    p = _db()
    if p.exists():
        try: return json.loads(p.read_text(encoding="utf-8"))
        except Exception: pass
    return dict(DEFAULT_BIBLE)

def start_server(port: int, bundle_root: Path, meta: dict):
    app = Flask(__name__)
    ui_dir, assets_dir = bundle_root / "ui", bundle_root / "assets"

    @app.route("/")
    def index(): return send_from_directory(ui_dir, "index.html")
    @app.route("/assets/<path:f>")
    def assets(f): return send_from_directory(assets_dir, f)
    @app.route("/api/health")
    def health(): return jsonify({"ok": True, "app": meta["title"]})
    @app.route("/api/platform")
    def plat(): return jsonify(platform_exclusive.get_system_overview())
    @app.route("/api/bible", methods=["GET", "POST"])
    def bible():
        data = load_bible()
        if request.method == "GET": return jsonify(data)
        b = request.get_json(force=True, silent=True) or {}
        entry = {
            "id": f"e{int(datetime.now().timestamp())}",
            "kind": b.get("kind", "Lore"),
            "name": b.get("name", "Untitled"),
            "era": b.get("era", "Current Era"),
            "canon": b.get("canon", "Draft"),
            "body": b.get("body", ""),
        }
        data["entries"].insert(0, entry)
        _db().write_text(json.dumps(data, indent=2), encoding="utf-8")
        return jsonify({"ok": True, "bible": data})

    app.run(host="127.0.0.1", port=port, debug=False, use_reloader=False)
