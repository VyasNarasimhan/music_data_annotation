"use client";

import { useEffect, useRef, useState } from "react";

declare global {
  interface Window {
    YT?: any;
    onYouTubeIframeAPIReady?: () => void;
  }
}

type Props = {
  videoId: string;
  onPaused: (timestamp: number) => void;
  onPlaying: () => void;
  onEnded: () => void;
  seekTo: number | null;
  onSeekHandled: () => void;
};

export default function VideoPlayer({ videoId, onPaused, onPlaying, onEnded, seekTo, onSeekHandled }: Props) {
  const playerRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [ready, setReady] = useState(false);
  const onPausedRef = useRef(onPaused);
  const onPlayingRef = useRef(onPlaying);
  const onEndedRef = useRef(onEnded);
  const pollRef = useRef<number | null>(null);
  const lastReportedRef = useRef<number | null>(null);

  useEffect(() => {
    onPausedRef.current = onPaused;
  }, [onPaused]);

  useEffect(() => {
    onPlayingRef.current = onPlaying;
  }, [onPlaying]);

  useEffect(() => {
    onEndedRef.current = onEnded;
  }, [onEnded]);

  useEffect(() => {
    let isMounted = true;

    function createPlayer() {
      if (!containerRef.current || !window.YT?.Player) return;
      playerRef.current?.destroy?.();
      playerRef.current = new window.YT.Player(containerRef.current, {
        videoId,
        playerVars: { controls: 1, rel: 0 },
        events: {
          onReady: () => isMounted && setReady(true),
          onStateChange: (event: any) => {
            if (event.data === window.YT.PlayerState.PAUSED) {
              const time = playerRef.current?.getCurrentTime?.() ?? 0;
              onPausedRef.current(time);
              lastReportedRef.current = Math.floor(time);
              if (pollRef.current === null) {
                pollRef.current = window.setInterval(() => {
                  const now = playerRef.current?.getCurrentTime?.() ?? 0;
                  const floored = Math.floor(now);
                  if (floored !== lastReportedRef.current) {
                    lastReportedRef.current = floored;
                    onPausedRef.current(now);
                  }
                }, 300);
              }
            }
            if (event.data === window.YT.PlayerState.PLAYING) {
              onPlayingRef.current();
              if (pollRef.current !== null) {
                window.clearInterval(pollRef.current);
                pollRef.current = null;
              }
              lastReportedRef.current = null;
            }
            if (event.data === window.YT.PlayerState.ENDED) {
              onEndedRef.current();
            }
            if (event.data === window.YT.PlayerState.BUFFERING) {
              if (pollRef.current !== null) {
                window.clearInterval(pollRef.current);
                pollRef.current = null;
              }
              lastReportedRef.current = null;
            }
          }
        }
      });
    }

    if (!window.YT) {
      const tag = document.createElement("script");
      tag.src = "https://www.youtube.com/iframe_api";
      document.body.appendChild(tag);
      window.onYouTubeIframeAPIReady = () => createPlayer();
    } else {
      createPlayer();
    }

    return () => {
      isMounted = false;
      if (pollRef.current !== null) {
        window.clearInterval(pollRef.current);
        pollRef.current = null;
      }
      playerRef.current?.destroy?.();
    };
  }, [videoId]);

  useEffect(() => {
    if (seekTo === null || !ready || !playerRef.current) return;
    playerRef.current.seekTo?.(seekTo, true);
    playerRef.current.pauseVideo?.();
    onPausedRef.current(seekTo);
    onSeekHandled();
  }, [seekTo, ready, onSeekHandled]);

  return (
    <div className="space-y-3">
      <div className="aspect-video w-full rounded-xl bg-black" ref={containerRef} />
      {ready ? null : <div className="text-xs text-slate-500">Loading player…</div>}
    </div>
  );
}
