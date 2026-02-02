"use client";

import { useEffect, useState } from "react";
import VideoPlayer from "../components/VideoPlayer";
import Recorder from "../components/Recorder";
import NotesList from "../components/NotesList";
import { extractVideoId, formatTimestamp } from "../lib/youtube";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:4000";

type Note = {
  timestamp: number | null;
  transcript: string;
  createdAt: string;
  overall?: boolean;
};

export default function HomePage() {
  const [videoInput, setVideoInput] = useState("");
  const [videoId, setVideoId] = useState<string | null>(null);
  const [pausedAt, setPausedAt] = useState<number | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [seekTo, setSeekTo] = useState<number | null>(null);
  const [overallActive, setOverallActive] = useState(false);
  const [handsfreeSetting, setHandsfreeSetting] = useState(true);
  const [handsfreeActive, setHandsfreeActive] = useState(true);
  const [startToken, setStartToken] = useState(0);
  const [stopToken, setStopToken] = useState(0);
  const [overallStartToken, setOverallStartToken] = useState(0);

  useEffect(() => {
    if (!videoId) return;
    fetch(`${API_BASE}/api/notes/${videoId}`)
      .then((res) => res.json())
      .then((data) => setNotes(data))
      .catch(() => setNotes([]));
  }, [videoId]);

  const loadVideo = () => {
    const id = extractVideoId(videoInput);
    if (!id) {
      setError("Enter a valid YouTube URL or video ID");
      return;
    }
    setError(null);
    setPausedAt(null);
    setNotes([]);
    setOverallActive(false);
    setHandsfreeActive(handsfreeSetting);
    if (id === videoId) {
      refreshNotes();
    } else {
      setVideoId(id);
    }
  };

  const refreshNotes = async () => {
    if (!videoId) return;
    const res = await fetch(`${API_BASE}/api/notes/${videoId}`);
    const data = await res.json();
    setNotes(data);
  };

  const deleteNote = async (timestamp: number) => {
    if (!videoId) return;
    await fetch(`${API_BASE}/api/notes`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ videoId, timestamp })
    });
    refreshNotes();
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-6 px-6 py-10">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold text-ink">Video Thoughts</h1>
        <p className="text-sm text-slate-600">
          Paste a YouTube link, pause the video, and record timestamped thoughts.
        </p>
      </header>

      <section className="rounded-2xl bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <input
            className="flex-1 rounded-md border border-slate-200 px-3 py-2 text-sm"
            placeholder="https://www.youtube.com/watch?v=..."
            value={videoInput}
            onChange={(event) => setVideoInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") loadVideo();
            }}
          />
          <button className="rounded-md bg-ink px-4 py-2 text-sm text-white" onClick={loadVideo}>
            Load Video
          </button>
        </div>
        <div className="mt-3 flex items-center gap-2 text-xs text-slate-600">
          <input
            id="handsfree"
            type="checkbox"
            checked={handsfreeSetting}
            onChange={(event) => setHandsfreeSetting(event.target.checked)}
          />
          <label htmlFor="handsfree">
            Handsfree mode (auto-record on pause, applies on load)
          </label>
        </div>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      </section>

      {videoId ? (
        <section className="grid gap-6 lg:grid-cols-[2fr,1fr]">
          <div className="space-y-4">
            <VideoPlayer
              videoId={videoId}
              onPaused={(time) => setPausedAt(Math.floor(time))}
              onPauseEvent={() => {
                if (handsfreeActive) setStartToken((v) => v + 1);
              }}
              onPlaying={() => {
                setPausedAt(null);
                setOverallActive(false);
                if (handsfreeActive) setStopToken((v) => v + 1);
              }}
              onEnded={() => {
                setPausedAt(null);
                setOverallActive(true);
                if (handsfreeActive) setOverallStartToken((v) => v + 1);
              }}
              seekTo={seekTo}
              onSeekHandled={() => setSeekTo(null)}
            />
            <div className="text-sm text-slate-600">
              {pausedAt !== null ? `Paused at ${formatTimestamp(pausedAt)}` : "Not paused yet"}
            </div>
            <Recorder
              videoId={videoId}
              timestamp={pausedAt}
              mode="timestamp"
              initialTranscript={
                pausedAt === null
                  ? ""
                  : notes.find(
                      (note) => note.timestamp !== null && Math.floor(note.timestamp) === pausedAt
                    )?.transcript || ""
              }
              onSaved={refreshNotes}
              startSignal={handsfreeActive ? startToken : undefined}
              stopSignal={handsfreeActive ? stopToken : undefined}
              autoSaveOnStop={handsfreeActive}
              handsfree={handsfreeActive}
            />
            {overallActive && pausedAt === null ? (
              <Recorder
                videoId={videoId}
                timestamp={null}
                mode="overall"
                initialTranscript={notes.find((note) => note.overall)?.transcript || ""}
                onSaved={refreshNotes}
                startSignal={handsfreeActive ? overallStartToken : undefined}
                autoStop={false}
                handsfree={handsfreeActive}
              />
            ) : null}
          </div>
          <aside className="space-y-3">
            <h2 className="text-lg font-semibold text-ink">Saved Notes</h2>
            <NotesList
              notes={notes}
              onDelete={deleteNote}
              onJumpToTimestamp={(timestamp) => setSeekTo(Math.floor(timestamp))}
            />
          </aside>
        </section>
      ) : (
        <section className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-500">
          Load a video to begin.
        </section>
      )}
    </main>
  );
}
