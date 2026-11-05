"use client";

/** Render a video file into a 9:16 tall canvas, capture it, and return a webm File
 *  (or the original file if anything fails). Keeps the glTF-style media pipeline working. */
export async function formatToTall(file: File): Promise<File> {
  const url = URL.createObjectURL(file);
  return new Promise((resolve) => {
    const video = document.createElement("video");
    (video as any).webkitPlaysInline = true;
    video.playsInline = true;
    video.muted = false;
    video.volume = 0; // silent re-record, avoids audio kind change
    video.autoplay = true;
    video.loop = false;
    video.src = url;

    const TIMEOUT_MS = 30000;
    let raf = 0;
    let done = false;
    const finish = (f: File) => {
      if (done) return;
      done = true;
      cancelAnimationFrame(raf);
      URL.revokeObjectURL(url);
      resolve(f);
    };

    const timer = setTimeout(() => finish(file), TIMEOUT_MS);

    video.addEventListener(
      "loadedmetadata",
      () => {
        const vw = video.videoWidth || 640;
        const vh = video.videoHeight || 360;

        // 9:16 canvas, keep video aspect, fit + center
        const targetW = 480;
        const targetH = Math.round((targetW * 16) / 9); // 853
        const scale = Math.min(targetW / vw, targetH / vh);
        const dw = Math.max(2, Math.round(vw * scale)) >>> 1 << 1;
        const dh = Math.max(2, Math.round(vh * scale)) >>> 1 << 1;
        const dx = Math.round((targetW - dw) / 2);
        const dy = Math.round((targetH - dh) / 2);

        const canvas = document.createElement("canvas");
        canvas.width = targetW;
        canvas.height = targetH;
        const ctx = canvas.getContext("2d");
        const canvasStream: MediaStream | undefined = (canvas as any).captureStream?.(30);
        const elemStream: MediaStream | undefined = (video as any).captureStream?.();
        if (!ctx || !canvasStream || !window.MediaRecorder) {
          clearTimeout(timer);
          finish(file);
          return;
        }
        const tracks = [...canvasStream.getVideoTracks()];
        elemStream?.getAudioTracks()?.forEach((t) => tracks.push(t));
        const merged = new MediaStream(tracks);
        const mime = MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
          ? "video/webm;codecs=vp9"
          : "video/webm";
        let rec: MediaRecorder;
        try {
          rec = new MediaRecorder(merged, {
            mimeType: mime,
            videoBitsPerSecond: 1_200_000,
            audioBitsPerSecond: 96_000,
          });
        } catch {
          clearTimeout(timer);
          finish(file);
          return;
        }

        const chunks: Blob[] = [];
        rec.ondataavailable = (e) => {
          if (e.data.size) chunks.push(e.data);
        };
        rec.onstop = () => {
          clearTimeout(timer);
          const out = new Blob(chunks, { type: mime });
          finish(
            new File([out], file.name.replace(/\.[^.]+$/, "") + "-tall.webm", { type: mime }),
          );
        };

        const draw = () => {
          if (video.ended || video.paused || done) return;
          ctx.clearRect(0, 0, targetW, targetH);
          ctx.fillStyle = "#000";
          ctx.fillRect(0, 0, targetW, targetH);
          ctx.drawImage(video, dx, dy, dw, dh);
          raf = requestAnimationFrame(draw);
        };

        video.addEventListener("play", () => {
          raf = requestAnimationFrame(draw);
        });
        video.addEventListener("ended", () => {
          cancelAnimationFrame(raf);
          if (rec.state !== "inactive") rec.stop();
        });
        rec.start(250);
        video.play().catch(() => {
          if (rec.state !== "inactive") rec.stop();
        });
      },
      { once: true },
    );
    video.onerror = () => {
      clearTimeout(timer);
      finish(file);
    };
  });
}
