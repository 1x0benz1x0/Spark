export const MAX_MEDIA_SECONDS = 90; // 1:30

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
