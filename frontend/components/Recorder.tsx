"use client";

import { useEffect, useMemo, useRef, useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:4000";

type Props = {
  videoId: string;
  timestamp: number | null;
  initialTranscript: string;
  onSaved: () => void;
};

export default function Recorder({ videoId, timestamp, initialTranscript, onSaved }: Props) {
  const [isRecording, setIsRecording] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [transcript, setTranscript] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  const canRecord = useMemo(() => typeof window !== "undefined" && !!navigator.mediaDevices, []);

  useEffect(() => {
    if (timestamp === null) return;
    setStatus("Ready to record");
    setTranscript(initialTranscript || "");
    setAudioUrl(null);
  }, [timestamp, initialTranscript]);

  const reset = () => {
    setIsRecording(false);
    setAudioUrl(null);
    setTranscript("");
    setStatus("Ready to record");
    chunksRef.current = [];
  };

  const startRecording = async () => {
    if (!canRecord) {
      setStatus("Recording not supported in this browser");
      return;
    }
    setStatus("Recording...");
    setTranscript("");
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const recorder = new MediaRecorder(stream);
    recorderRef.current = recorder;
    chunksRef.current = [];

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunksRef.current.push(event.data);
    };
    recorder.onstop = () => {
      stream.getTracks().forEach((track) => track.stop());
      const blob = new Blob(chunksRef.current, { type: "audio/webm" });
      setAudioUrl(URL.createObjectURL(blob));
      setStatus("Recording stopped");
    };

    const RecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (RecognitionCtor) {
      const recognition = new RecognitionCtor();
      recognition.lang = "en-US";
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.onresult = (event) => {
        let finalText = "";
        for (let i = event.resultIndex; i < event.results.length; i += 1) {
          const result = event.results[i];
          if (result.isFinal) finalText += result[0].transcript;
        }
        if (finalText) setTranscript((prev) => (prev ? `${prev} ${finalText}` : finalText));
      };
      recognitionRef.current = recognition;
      recognition.start();
    } else {
      setStatus("Speech recognition not available. You can still save notes manually.");
    }

    recorder.start();
    setIsRecording(true);
  };

  const stopRecording = () => {
    recorderRef.current?.stop();
    recognitionRef.current?.stop();
    setIsRecording(false);
  };

  const saveTranscript = async () => {
    if (!transcript.trim() || timestamp === null) {
      setStatus("Add a transcript before saving");
      return;
    }
    setStatus("Saving...");
    const res = await fetch(`${API_BASE}/api/notes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ videoId, timestamp, transcript: transcript.trim() })
    });

    if (!res.ok) {
      setStatus("Save failed");
      return;
    }

    setStatus("Saved");
    onSaved();
  };

  if (timestamp === null) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-500">
        Pause the video to record thoughts.
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        <button
          className="rounded-md bg-accent px-3 py-2 text-sm text-white"
          onClick={isRecording ? stopRecording : startRecording}
        >
          {isRecording ? "Stop" : "Record"}
        </button>
        <button className="rounded-md bg-slate-100 px-3 py-2 text-sm" onClick={reset}>
          Redo
        </button>
        <button className="rounded-md bg-ink px-3 py-2 text-sm text-white" onClick={saveTranscript}>
          Save Transcript
        </button>
        {status && <span className="text-xs text-slate-500">{status}</span>}
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <div className="rounded-lg border border-slate-200 p-3 text-sm">
          <p className="mb-2 text-xs uppercase text-slate-500">Transcript</p>
          <textarea
            className="h-28 w-full resize-none rounded-md border border-slate-200 p-2 text-sm"
            placeholder="Speech-to-text will appear here. You can edit it."
            value={transcript}
            onChange={(event) => setTranscript(event.target.value)}
          />
        </div>
        <div className="rounded-lg border border-slate-200 p-3 text-sm">
          <p className="mb-2 text-xs uppercase text-slate-500">Recording Playback</p>
          {audioUrl ? (
            <audio controls className="w-full">
              <source src={audioUrl} type="audio/webm" />
            </audio>
          ) : (
            <p className="text-slate-500">Record to enable playback.</p>
          )}
        </div>
      </div>
    </div>
  );
}
