export const MAX_MEDIA_SECONDS = 90; // 1:30
export const MAX_FILE_BYTES = 8 * 1024 * 1024; // 8 MB — Supabase free storage-friendly target

export function maxToShort(s: number) {
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
}

export async function validateMediaDuration(file: File): Promise<{ ok: boolean; duration: number }> {
  if (!file.type.startsWith("video") && !file.type.startsWith("audio")) {
    return { ok: true, duration: 0 };
  }
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const el = file.type.startsWith("video") ? document.createElement("video") : new Audio();
    el.preload = "metadata";
    el.src = url;
    el.onloadedmetadata = () => {
      const d = el.duration;
      URL.revokeObjectURL(url);
      resolve({ ok: d <= MAX_MEDIA_SECONDS, duration: d });
    };
    el.onerror = () => {
      URL.revokeObjectURL(url);
      resolve({ ok: false, duration: 0 });
    };
  });
}

// Scan the raw bytes of an MP4/MOV for HEVC codec markers (iPhone "High Efficiency" exports
// are saved as .mp4 but ChromeOS can't decode them — you get black video with sound).
export async function isUnsupportedHevc(file: File): Promise<boolean> {
  const t = (file.type || "").toLowerCase();
  const n = file.name.toLowerCase();
  const isMovOrMp4 =
    t.includes("mp4") || t.includes("quicktime") || n.endsWith(".mp4") || n.endsWith(".mov") || n.endsWith(".m4v");
  if (!isMovOrMp4) return false;
  const cap = Math.min(file.size, 32 * 1024 * 1024);
  const buf = await file.slice(0, cap).arrayBuffer();
  // latin1 decoding keeps one char per byte so regex can find ASCII codec markers
  const text = new TextDecoder("iso-8859-1").decode(new Uint8Array(buf));
  return /hev1|hvc1|dvh1|dvh\w|hvcC|hevc/i.test(text);
}

/** Re-encode to universally-playable H.264 MP4 using ffmpeg.wasm (lazy-loaded, ~31 MB, cached by the browser). */
export async function transcodeToH264(file: File): Promise<File> {
  const { FFmpeg } = await import("@ffmpeg/ffmpeg");
  const { toBlobURL, fetchFile } = await import("@ffmpeg/util");
  const ffmpeg = new FFmpeg();
  const base = "https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/umd";
  await ffmpeg.load({
    coreURL: await toBlobURL(`${base}/ffmpeg-core.js`, "text/javascript"),
    wasmURL: await toBlobURL(`${base}/ffmpeg-core.wasm`, "application/wasm"),
  });
  const ext = (file.name.split(".").pop() || "mp4").toLowerCase().replace(/[^a-z0-9]/g, "") || "mp4";
  await ffmpeg.writeFile(`input.${ext}`, await fetchFile(file));
  await ffmpeg.exec([
    "-i", `input.${ext}`,
    "-t", String(MAX_MEDIA_SECONDS),
    "-c:v", "libx264",
    "-preset", "ultrafast",
    "-crf", "28",
    "-vf", "scale=-2:480",
    "-c:a", "aac",
    "-movflags", "+faststart",
    "output.mp4",
  ]);
  const data = await ffmpeg.readFile("output.mp4");
  const name = file.name.replace(/\.[^.]+$/, "") + ".mp4";
  return new File([data as BlobPart], name, { type: "video/mp4" });
}

async function prepareVideoFile(file: File): Promise<File> {
  // HEVC (iPhone) can't be decoded by ChromeOS → transcode to H.264 first
  if (await isUnsupportedHevc(file)) {
    try {
      return await transcodeToH264(file);
    } catch (e) {
      console.error("HEVC transcode failed", e);
      return file;
    }
  }
  if (file.size <= MAX_FILE_BYTES) return file;
  // Downscale large videos for real: re-record via canvas + element captureStream (keeps audio, full duration)
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.playsInline = true;
    video.muted = false;
    video.volume = 0;
    video.src = url;
    video.addEventListener("loadedmetadata", () => {
      const vw = video.videoWidth || 640;
      const vh = video.videoHeight || 360;
      const scale = Math.min(1, 480 / Math.max(vw, vh));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(2, Math.round(vw * scale)) >>> 1 << 1;
      canvas.height = Math.max(2, Math.round(vh * scale)) >>> 1 << 1;
      const ctx = canvas.getContext("2d");
      const canvasStream: MediaStream | undefined = (canvas as any).captureStream?.(30);
      const elemStream: MediaStream | undefined = (video as any).captureStream?.();
      if (!ctx || !canvasStream || !window.MediaRecorder) {
        URL.revokeObjectURL(url);
        resolve(file);
        return;
      }
      const tracks = [...canvasStream.getVideoTracks()];
      if (elemStream?.getAudioTracks) tracks.push(...elemStream.getAudioTracks());
      const merged = new MediaStream(tracks);
      const mime = MediaRecorder.isTypeSupported("video/webm;codecs=vp9") ? "video/webm;codecs=vp9" : "video/webm";
      let rec: MediaRecorder;
      try {
        rec = new MediaRecorder(merged, { mimeType: mime, videoBitsPerSecond: 1_000_000, audioBitsPerSecond: 96_000 });
      } catch {
        URL.revokeObjectURL(url);
        resolve(file);
        return;
      }
      const chunks: Blob[] = [];
      rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
      rec.onstop = () => {
        URL.revokeObjectURL(url);
        const out = new Blob(chunks, { type: mime });
        resolve(new File([out], file.name.replace(/\.[^.]+$/, "") + ".webm", { type: mime }));
      };
      rec.start(250);
      let raf = 0;
      const draw = () => {
        if (video.ended || video.paused) return;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        raf = requestAnimationFrame(draw);
      };
      video.addEventListener("play", () => { raf = requestAnimationFrame(draw); });
      video.addEventListener("ended", () => { cancelAnimationFrame(raf); if (rec.state !== "inactive") rec.stop(); });
      video.play().catch(() => { if (rec.state !== "inactive") rec.stop(); });
      setTimeout(() => { if (rec.state !== "inactive") { cancelAnimationFrame(raf); rec.stop(); } }, (MAX_MEDIA_SECONDS + 5) * 1000);
    }, { once: true });
    video.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
  });
}

export async function prepareMediaFile(file: File): Promise<File> {
  if (file.type.startsWith("video")) return prepareVideoFile(file);
  return file;
}
