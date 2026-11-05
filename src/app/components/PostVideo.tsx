"use client";
import { useRef, useState } from "react";
import { Play, Pause, Volume2, VolumeX, Maximize2 } from "lucide-react";

function formatTime(s: number) {
  if (!isFinite(s)) return "0:00";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, "0")}`;
}

export function PostVideo({ src, poster }: { src: string; poster?: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(true);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [muted, setMuted] = useState(true);
  const [rate, setRate] = useState(1);
  const [wide, setWide] = useState(false);
  const [errored, setError] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const video = () => videoRef.current;

  function togglePlay() {
    const v = video();
    if (!v) return;
    if (v.paused) { v.play(); setPlaying(true); } else { v.pause(); setPlaying(false); }
  }

  function cycleRate() {
    const v = video();
    const next = rate === 1 ? 1.5 : rate === 1.5 ? 2 : 1;
    if (v) v.playbackRate = next;
    setRate(next);
  }

  function toggleMute() {
    const v = video();
    if (!v) return;
    v.muted = !v.muted;
    setMuted(v.muted);
  }

  function seek(e: React.MouseEvent<HTMLDivElement>) {
    const v = video();
    if (!v || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    v.currentTime = ratio * duration;
    setTime(v.currentTime);
  }

  function fullscreen() {
    const el = containerRef.current;
    if (!el) return;
    if (document.fullscreenElement) document.exitFullscreen();
    else el.requestFullscreen?.();
  }

  const progress = duration > 0 ? (time / duration) * 100 : 0;

  // Wide/landscape videos get letterboxed in a 16:9 box; tall/vertical ones get 9:16.
  // The video is always CENTERED with an explicit width/height, so a weird-aspect
  // file can't overflow, stretch the card, or render as a black box.
  const boxAspect = wide ? "aspect-video" : "aspect-[9/16]";
  const videoSize = wide ? "w-full h-auto" : "h-full w-auto";

  return (
    <div
      ref={containerRef}
      className={`relative w-full ${boxAspect} max-h-[600px] bg-black overflow-hidden select-none`}
      onClick={togglePlay}
    >
      <video
        ref={videoRef}
        src={src}
        autoPlay
        muted
        playsInline
        loop
        className={`${videoSize} object-contain relative left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2`}
        poster={poster}
        onLoadedMetadata={(e) => {
          const v = e.currentTarget;
          setDuration(v.duration);
          setWide(v.videoWidth >= v.videoHeight);
          setLoaded(true);
        }}
        onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onError={() => setError(true)}
      />

      {/* wide video note + codec-error fallback (very wide files can fail to render as frames on some ChromeOS devices) */}
      {wide && loaded && !errored && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 z-10 px-3 py-1 rounded-full bg-black/70 text-white text-[11px] pointer-events-none">
          Wide video — plays best full screen. Tap the fullscreen icon.
        </div>
      )}
      {errored && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-zinc-950 text-center p-6">
          <p className="text-sm text-zinc-300">This video can't play on this device.</p>
          <p className="text-xs text-zinc-500 max-w-[280px]">It may be a wide/landscape file. On your phone: Settings → Camera → Formats → "Most Compatible", then record and post again.</p>
        </div>
      )}

      {/* bottom control bar */}
      <div
        className="absolute bottom-0 left-0 right-0 z-10 bg-gradient-to-t from-black/90 via-black/50 to-transparent pt-8 pb-2 px-2"
        onClick={(e) => e.stopPropagation()}
      >
        {/* red progress bar sits at the bottom, just above the controls */}
        <div
          className="h-[3px] w-full bg-zinc-800 cursor-pointer mb-2 rounded overflow-hidden"
          onClick={(e) => { e.stopPropagation(); seek(e); }}
        >
          <div className="h-full bg-blue-500" style={{ width: `${progress}%` }} />
        </div>
        <div className="flex items-center gap-3 text-white text-xs">
          <button onClick={togglePlay} className="p-1">
            {playing
              ? <Pause className="w-5 h-5 fill-white text-white" />
              : <Play className="w-5 h-5 fill-white text-white" />}
          </button>
          <span className="tabular-nums text-[11px] text-zinc-200">{formatTime(time)} / {formatTime(duration)}</span>

          <button onClick={cycleRate} className="ml-auto text-[11px] font-semibold text-zinc-200 hover:text-white px-2 py-1 rounded">
            {rate}x
          </button>
          <button onClick={toggleMute} className="p-1">
            {muted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
          </button>
          <button onClick={fullscreen} className="p-1">
            <Maximize2 className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
