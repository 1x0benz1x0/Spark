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

export async function prepareVideoFile(file: File): Promise<File> {
  if (file.size <= MAX_FILE_BYTES) return file;
  // downscale via canvas captureStream so uploads stay browser-friendly
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.src = url;
    video.addEventListener("loadedmetadata", () => {
      const vw = video.videoWidth || 640;
      const vh = video.videoHeight || 360;
      const scale = Math.min(1, 480 / Math.max(vw, vh));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(2, Math.round(vw * scale)) >>> 1 << 1;
      canvas.height = Math.max(2, Math.round(vh * scale)) >>> 1 << 1;
      video.currentTime = 0.1;
      video.addEventListener("seeked", () => {
        const ctx = canvas.getContext("2d");
        if (!ctx || !canvas.captureStream) {
          URL.revokeObjectURL(url);
          resolve(file);
          return;
        }
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const stream = canvas.captureStream();
        URL.revokeObjectURL(url);
        if (!window.MediaRecorder || !stream) {
          resolve(file);
          return;
        }
        const mime = MediaRecorder.isTypeSupported("video/webm;codecs=vp9") ? "video/webm;codecs=vp9" : "video/webm";
        const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 1_000_000 });
        const chunks: Blob[] = [];
        rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
        rec.onstop = () => {
          const out = new Blob(chunks, { type: mime });
          resolve(new File([out], file.name.replace(/\.[^.]+$/, "") + ".webm", { type: mime }));
        };
        rec.start(200);
        video.play().catch(() => rec.stop());
        setTimeout(() => { if (rec.state !== "inactive") rec.stop(); }, 2500);
      }, { once: true });
    }, { once: true });
    video.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
  });
}

export async function prepareMediaFile(file: File): Promise<File> {
  if (file.type.startsWith("video")) return prepareVideoFile(file);
  return file;
}
