"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:4000";

type Props = {
  videoId: string;
  timestamp: number | null;
  initialTranscript: string;
  mode: "timestamp" | "overall";
  onSaved: () => void;
  startSignal?: number;
  stopSignal?: number;
  autoStop?: boolean;
  autoSaveOnStop?: boolean;
  handsfree?: boolean;
};

export default function Recorder({
  videoId,
  timestamp,
  initialTranscript,
  mode,
  onSaved,
  startSignal,
  stopSignal,
  autoStop = true,
  autoSaveOnStop = false,
  handsfree = false
}: Props) {
  const [isRecording, setIsRecording] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [transcript, setTranscript] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const chunksRef = useRef<Blob[]>([]);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const startingRef = useRef(false);
  const lastAutoStartRef = useRef<number | null>(null);
  const transcriptRef = useRef("");
  const keyRef = useRef<string>("");

  const canRecord = useMemo(() => typeof window !== "undefined" && !!navigator.mediaDevices, []);

  useEffect(() => {
    if (mode === "timestamp" && timestamp === null) return;
    if (isRecording) return;
    const key = `${mode}:${mode === "overall" ? "overall" : String(timestamp)}`;
    if (keyRef.current !== key) {
      keyRef.current = key;
      setStatus("Ready to record");
      setTranscript(initialTranscript || "");
      setAudioUrl(null);
      setSaved(false);
    }
  }, [timestamp, initialTranscript, mode]);

  useEffect(() => {
    transcriptRef.current = transcript;
  }, [transcript]);

  const reset = () => {
    setIsRecording(false);
    setAudioUrl(null);
    setTranscript("");
    setStatus("Ready to record");
    setSaved(false);
    chunksRef.current = [];
  };

  const startRecording = useCallback(async () => {
    if (!canRecord) {
      setStatus("Recording not supported in this browser");
      return;
    }
    if (startingRef.current || isRecording) return;
    if (mode === "timestamp" && timestamp === null) return;
    startingRef.current = true;
    setStatus("Recording...");
    setTranscript("");
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    streamRef.current = stream;
    const recorder = new MediaRecorder(stream);
    recorderRef.current = recorder;
    chunksRef.current = [];

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunksRef.current.push(event.data);
    };
    recorder.onstop = () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      const blob = new Blob(chunksRef.current, { type: "audio/webm" });
      setAudioUrl(URL.createObjectURL(blob));
      setStatus("Recording stopped");
      if (autoSaveOnStop && transcriptRef.current.trim()) {
        saveTranscript(transcriptRef.current.trim());
      }
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
    startingRef.current = false;
    if (startSignal !== undefined) {
      lastAutoStartRef.current = Date.now();
    }
  }, [canRecord, isRecording, mode, timestamp, autoSaveOnStop, videoId]);

  const stopRecording = useCallback(() => {
    recorderRef.current?.stop();
    recognitionRef.current?.stop();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    recorderRef.current = null;
    recognitionRef.current = null;
    setIsRecording(false);
  }, []);

  useEffect(() => {
    if (startSignal === undefined) return;
    if (mode === "timestamp" && timestamp === null) return;
    if (!isRecording) startRecording();
  }, [startSignal, mode, timestamp, isRecording, startRecording]);

  useEffect(() => {
    if (stopSignal === undefined) return;
    if (!autoStop) return;
    const lastStart = lastAutoStartRef.current;
    if (lastStart && Date.now() - lastStart < 500) return;
    if (isRecording) stopRecording();
  }, [stopSignal, autoStop, isRecording, stopRecording]);

  const saveTranscript = async (overrideTranscript?: string) => {
    const baseTranscript =
      typeof overrideTranscript === "string" ? overrideTranscript : transcript;
    const payloadTranscript = baseTranscript.trim();
    if (!payloadTranscript) {
      setStatus("Add a transcript before saving");
      return;
    }
    if (mode === "timestamp" && timestamp === null) {
      setStatus("Pause the video to capture a timestamp");
      return;
    }
    setStatus("Saving...");
    const res = await fetch(`${API_BASE}/api/notes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        videoId,
        timestamp,
        transcript: payloadTranscript,
        overall: mode === "overall"
      })
    });

    if (!res.ok) {
      setStatus("Save failed");
      return;
    }

    setStatus("Saved");
    setSaved(true);
    onSaved();
  };

  const handleSaveClick = () => {
    if (isRecording) {
      stopRecording();
      window.setTimeout(() => {
        void saveTranscript();
      }, 150);
    } else {
      void saveTranscript();
    }
  };

  if (mode === "timestamp" && timestamp === null) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-500">
        Pause the video to record thoughts.
      </div>
    );
  }

  if (saved) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
        Saved successfully.
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        {handsfree ? (
          <button
            className="rounded-md bg-ink px-3 py-2 text-sm text-white"
            onClick={handleSaveClick}
          >
            Save Transcript
          </button>
        ) : (
          <>
            <button
              className="rounded-md bg-accent px-3 py-2 text-sm text-white"
              onClick={isRecording ? stopRecording : startRecording}
            >
              {isRecording ? "Stop" : "Record"}
            </button>
            <button className="rounded-md bg-slate-100 px-3 py-2 text-sm" onClick={reset}>
              Redo
            </button>
            <button
              className="rounded-md bg-ink px-3 py-2 text-sm text-white"
              onClick={handleSaveClick}
            >
              Save Transcript
            </button>
          </>
        )}
        {status && <span className="text-xs text-slate-500">{status}</span>}
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <div className="rounded-lg border border-slate-200 p-3 text-sm">
          <p className="mb-2 text-xs uppercase text-slate-500">
            {mode === "overall" ? "Overall Transcript" : "Transcript"}
          </p>
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
