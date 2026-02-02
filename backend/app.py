from flask import Flask, request, jsonify
from flask_cors import CORS
import json
import os
from datetime import datetime, timezone

app = Flask(__name__)
CORS(app)

DATA_PATH = os.path.join(os.path.dirname(__file__), "data", "notes.json")


def read_notes():
    if not os.path.exists(DATA_PATH):
        return {}
    with open(DATA_PATH, "r", encoding="utf-8") as f:
        try:
            return json.load(f)
        except json.JSONDecodeError:
            return {}


def write_notes(notes):
    with open(DATA_PATH, "w", encoding="utf-8") as f:
        json.dump(notes, f, indent=2)


@app.get("/api/notes/<video_id>")
def get_notes(video_id):
    notes = read_notes()
    return jsonify(notes.get(video_id, []))


@app.post("/api/notes")
def add_note():
    payload = request.get_json(silent=True) or {}
    video_id = payload.get("videoId")
    timestamp = payload.get("timestamp")
    transcript = payload.get("transcript")
    overall = bool(payload.get("overall"))

    if not video_id or not transcript:
        return jsonify({"error": "videoId, transcript required"}), 400
    if not overall and not isinstance(timestamp, (int, float)):
        return jsonify({"error": "timestamp required for non-overall notes"}), 400

    notes = read_notes()
    entry = {
        "timestamp": float(timestamp) if isinstance(timestamp, (int, float)) else None,
        "transcript": transcript,
        "overall": overall,
        "createdAt": datetime.now(timezone.utc).isoformat()
    }

    notes.setdefault(video_id, [])
    replaced = False
    for existing in notes[video_id]:
        if overall and existing.get("overall"):
            existing["transcript"] = entry["transcript"]
            existing["createdAt"] = entry["createdAt"]
            replaced = True
            break
        existing_ts = existing.get("timestamp")
        if not overall and existing_ts is not None and float(existing_ts) == float(entry["timestamp"]):
            existing["transcript"] = entry["transcript"]
            existing["createdAt"] = entry["createdAt"]
            replaced = True
            break
    if not replaced:
        notes[video_id].append(entry)
    notes[video_id].sort(key=lambda n: (n["timestamp"] is None, n["timestamp"] or 0))

    write_notes(notes)
    return jsonify({"ok": True, "entry": entry})


@app.put("/api/notes")
def update_note():
    payload = request.get_json(silent=True) or {}
    video_id = payload.get("videoId")
    timestamp = payload.get("timestamp")
    new_transcript = payload.get("transcript")
    overall = bool(payload.get("overall"))

    if not video_id or not new_transcript:
        return jsonify({"error": "videoId, transcript required"}), 400
    if not overall and not isinstance(timestamp, (int, float)):
        return jsonify({"error": "timestamp required for non-overall notes"}), 400

    notes = read_notes()
    entries = notes.get(video_id, [])
    updated = False
    for entry in entries:
        if overall and entry.get("overall"):
            entry["transcript"] = new_transcript
            entry["editedAt"] = datetime.now(timezone.utc).isoformat()
            updated = True
            break
        if not overall and float(entry.get("timestamp", -1)) == float(timestamp):
            entry["transcript"] = new_transcript
            entry["editedAt"] = datetime.now(timezone.utc).isoformat()
            updated = True
            break

    if not updated:
        return jsonify({"error": "note not found"}), 404

    write_notes(notes)
    return jsonify({"ok": True})


@app.delete("/api/notes")
def delete_note():
    payload = request.get_json(silent=True) or {}
    video_id = payload.get("videoId")
    timestamp = payload.get("timestamp")
    overall = bool(payload.get("overall"))

    if not video_id:
        return jsonify({"error": "videoId required"}), 400
    if not overall and not isinstance(timestamp, (int, float)):
        return jsonify({"error": "timestamp required for non-overall notes"}), 400

    notes = read_notes()
    entries = notes.get(video_id, [])
    original_len = len(entries)
    if overall:
        notes[video_id] = [e for e in entries if not e.get("overall")]
    else:
        notes[video_id] = [
            e for e in entries
            if e.get("timestamp") is None or float(e.get("timestamp")) != float(timestamp)
        ]

    if len(notes[video_id]) == original_len:
        return jsonify({"error": "note not found"}), 404

    write_notes(notes)
    return jsonify({"ok": True})


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=4000, debug=True)
