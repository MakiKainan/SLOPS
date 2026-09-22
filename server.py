#!/usr/bin/env python3
"""SLOPS sticker booth HTTP server (Flask)."""
from __future__ import annotations

import base64
import os
import sys
import threading
import traceback
import warnings
from pathlib import Path

# os.chdir() to the folder containing server.py
BASE_DIR = Path(__file__).resolve().parent
os.chdir(BASE_DIR)
ENGINE_DIR = BASE_DIR / "typography-scripts"
sys.path.insert(0, str(ENGINE_DIR))

import font_catalog
import make_typography
from flask import Flask, jsonify, request, send_file
from werkzeug.exceptions import HTTPException

# Load catalog and presets once at startup with defaults
try:
    CATALOG = font_catalog.scan_fonts(ENGINE_DIR / "fonts")
    if not CATALOG:
        print("Warning: No fonts found in typography-scripts/fonts/.", file=sys.stderr)
    COLOR_PRESETS = make_typography.load_color_presets(ENGINE_DIR / "color_presets.json")
except Exception as e:
    print(f"Fatal error during startup: {e}", file=sys.stderr)
    traceback.print_exc()
    sys.exit(1)

app = Flask(__name__, static_folder=None)
app.config["MAX_CONTENT_LENGTH"] = 16 * 1024

RENDER_LOCK = threading.Lock()


def err(status: int, code: str, message: str):
    return jsonify({"error": str(message), "code": str(code)}), status


@app.errorhandler(400)
def handle_400(e):
    return err(400, "invalid_request", str(getattr(e, "description", e)))


@app.errorhandler(404)
def handle_404(e):
    return err(404, "not_found", str(getattr(e, "description", "The requested URL was not found.")))


@app.errorhandler(405)
def handle_405(e):
    return err(405, "method_not_allowed", "Method not allowed.")


@app.errorhandler(413)
def handle_413(e):
    return err(413, "payload_too_large", "Request payload exceeds maximum allowed size.")


@app.errorhandler(500)
def handle_500(e):
    traceback.print_exc()
    return err(500, "internal", "Internal server error")


@app.errorhandler(Exception)
def handle_exception(e):
    traceback.print_exc()
    if isinstance(e, HTTPException):
        code = str(e.code) if e.code else "http_error"
        return err(e.code or 500, code, e.description)
    return err(500, "internal", f"{type(e).__name__}: {str(e)}")


@app.get("/fonts")
def get_fonts():
    global CATALOG
    # Refresh on discovery so added files need no server restart.
    CATALOG = font_catalog.scan_fonts(ENGINE_DIR / "fonts")
    res = []
    canonical = ["regular", "bold", "italic", "bold-italic"]
    for fam_name, fam in sorted(CATALOG.items(), key=lambda item: item[0].casefold()):
        raw_styles = font_catalog.available_styles(fam)
        styles = [s for s in canonical if s in raw_styles]
        res.append({
            "family": fam_name,
            "category": fam.category,
            "styles": styles,
        })
    return jsonify(res)


@app.get("/font-file")
def get_font_file():
    family = request.args.get("family", "")
    style = request.args.get("style", "")
    if not family or family not in CATALOG:
        return err(404, "font_not_found", f"Font family '{family}' not found")
    fam = CATALOG[family]
    styles = font_catalog.available_styles(fam)
    if style not in styles:
        return err(404, "font_not_found", f"Style '{style}' not found in family '{family}'")

    try:
        font_path = font_catalog.resolve_font(CATALOG, family, style)
    except Exception as e:
        return err(404, "font_not_found", str(e))

    suffix = font_path.suffix.lower()
    mimetypes = {
        ".ttf": "font/ttf",
        ".otf": "font/otf",
        ".woff": "font/woff",
        ".woff2": "font/woff2",
    }
    mimetype = mimetypes.get(suffix, "application/octet-stream")
    return send_file(font_path, mimetype=mimetype, max_age=86400)


@app.get("/presets")
def get_presets():
    return jsonify(COLOR_PRESETS)


@app.post("/render")
def render():
    b = request.get_json(silent=True)
    if not isinstance(b, dict):
        return err(400, "invalid_request", "Request body must be a JSON object")

    req_fields = ["text", "family", "style", "foreground", "background", "shape", "guide", "size"]
    for f in req_fields:
        if f not in b:
            return err(400, "invalid_request", f"Missing required field: '{f}'")

    # Type validation: bool is not accepted as int, text/family/style/colors/shape must be str
    if not isinstance(b["text"], str):
        return err(400, "invalid_request", "Field 'text' must be a string")
    if not isinstance(b["family"], str):
        return err(400, "invalid_request", "Field 'family' must be a string")
    if not isinstance(b["style"], str):
        return err(400, "invalid_request", "Field 'style' must be a string")
    if not isinstance(b["foreground"], str):
        return err(400, "invalid_request", "Field 'foreground' must be a string")
    if not isinstance(b["background"], str):
        return err(400, "invalid_request", "Field 'background' must be a string")
    if not isinstance(b["shape"], str):
        return err(400, "invalid_request", "Field 'shape' must be a string")
    if not isinstance(b["guide"], bool):
        return err(400, "invalid_request", "Field 'guide' must be a boolean")
    if not isinstance(b["size"], int) or isinstance(b["size"], bool):
        return err(400, "invalid_request", "Field 'size' must be an integer")

    if b["size"] not in {512, 1024}:
        return err(400, "invalid_request", "Field 'size' must be 512 or 1024")
    if len(b["text"]) > 64:
        return err(400, "invalid_request", "Text length cannot exceed 64 characters")

    # 404 font_not_found: family not in CATALOG
    if b["family"] not in CATALOG:
        return err(404, "font_not_found", f"Font family '{b['family']}' not found in catalog")

    try:
        path = font_catalog.resolve_font(CATALOG, b["family"], b["style"])
    except ValueError as e:
        return err(422, "style_unavailable", str(e))

    with RENDER_LOCK:
        with warnings.catch_warnings(record=True) as caught:
            warnings.simplefilter("always")
            try:
                img = make_typography.generate(
                    b["text"],
                    b["foreground"],
                    b["background"],
                    path,
                    size=b["size"],
                    shape=b["shape"],
                    guide=b["guide"],
                )
            except FileNotFoundError as e:
                return err(404, "font_file_missing", str(e))
            except ValueError as e:
                return err(422, "cannot_render", str(e))

    msgs = list(dict.fromkeys(str(w.message) for w in caught if issubclass(w.category, UserWarning)))
    png = make_typography.to_png_bytes(img)
    return jsonify({
        "png_base64": base64.b64encode(png).decode("ascii"),
        "warning": " ".join(msgs) or None,
    })


def main():
    port = int(os.environ.get("PORT", 8765))
    host = "127.0.0.1"
    # API only; the UI is served by server.ts (npm run dev). --no-open is still accepted and ignored.
    print(f"SLOPS booth API -> http://127.0.0.1:{port}  (Ctrl+C to stop)", flush=True)
    app.run(host=host, port=port, threaded=True)


if __name__ == "__main__":
    main()
