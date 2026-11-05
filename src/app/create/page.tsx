"use client";
import { useDropzone } from "react-dropzone";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { CloudUpload, FileVideo2, Music, Image as ImageIcon, X } from "lucide-react";
import { readMe } from "@/lib/spark-auth";
import { validateMediaDuration, MAX_MEDIA_SECONDS, prepareMediaFile } from "@/lib/media";
import { formatToTall } from "@/lib/tall-format";
import { useI18n } from "@/lib/i18n";

export default function CreatePage() {
  const { t } = useI18n();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkType, setLinkType] = useState<"video" | "image" | "audio" | null>(null);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [caption, setCaption] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [whoCanWatch, setWhoCanWatch] = useState("Everyone");
  const [busy, setBusy] = useState(false);
  const [processing, setProcessing] = useState(false);
  const supabase = createClient();
  const router = useRouter();

  const { getRootProps, getInputProps, isDragActive, isDragAccept, isDragReject } = useDropzone({
    accept: {
      "image/*": [],
      "video/*": [],
      "audio/*": [],
    },
    maxFiles: 1,
    noClick: !!file,
    noKeyboard: !!file,
    onDrop: (accepted) => {
      if (accepted[0]) pickFile(accepted[0]);
    },
  });

  async function pickFile(f: File | null) {
    if (!f) { setFile(null); setPreview(null); setLinkUrl(""); setLinkType(null); setLinkError(null); return; }
    if (f.type.startsWith("video") || f.type.startsWith("audio")) {
      const { ok, duration } = await validateMediaDuration(f);
      if (!ok) {
        alert(`Media is too long (${Math.floor(duration / 60)}:${String(Math.floor(duration % 60)).padStart(2, "0")}). Max 1:30.`);
        return;
      }
    }
    setProcessing(true);
    try {
      const prepared = await prepareMediaFile(f);
      const tall = prepared.type.startsWith("video")
        ? await formatToTall(prepared)
        : prepared;
      setFile(tall);
      setPreview(URL.createObjectURL(tall));
      setLinkUrl("");
      setLinkType(null);
      setLinkError(null);
    } finally {
      setProcessing(false);
    }
  }

  const DOWNLOAD_EXTS = ["mp4", "webm", "mov", "m4v", "ogg", "mp3", "wav", "m4a", "aac", "png", "jpg", "jpeg", "gif", "webp", "avif"];

  function classifyDownloadUrl(url: string): "video" | "image" | "audio" | null {
    try {
      const u = new URL(url);
      const ext = u.pathname.split(".").pop()?.toLowerCase();
      if (ext && DOWNLOAD_EXTS.includes(ext)) {
        if (["mp4", "webm", "mov", "m4v", "ogg"].includes(ext)) return "video";
        if (["mp3", "wav", "m4a", "aac"].includes(ext)) return "audio";
        return "image";
      }
      const host = u.hostname.toLowerCase();
      if (host.includes("tiktok") || host.includes("youtube") || host.includes("youtu.be") || host.includes("vimeo") || host.includes("instagram") || host.includes("twitter") || host.includes("x.com") || host.includes("facebook") || host.includes("reddit") || host.includes("twitch")) return "video";
    } catch {
      return null;
    }
    return null;
  }

  function fileNameFromUrl(url: string, fallback: string): string {
    try {
      const u = new URL(url);
      const base = decodeURIComponent(u.pathname.split("/").pop() || "");
      if (base && base.includes(".")) return base;
    } catch {}
    return fallback;
  }

  async function downloadFromLink(url: string): Promise<File> {
    setDownloading(true);
    try {
      const t = classifyDownloadUrl(url);
      if (!t) throw new Error("That doesn't look like a direct video/image/audio file link. TikTok/YouTube pages need a direct file link (.mp4, .webm...) to download.");
      const fallbackExt = t === "video" ? ".mp4" : t === "image" ? ".jpg" : ".mp3";
      const name = fileNameFromUrl(url, "downloaded" + fallbackExt);

      let data: ArrayBuffer | null = null;
      let mime = "";
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error("Couldn't fetch that link (HTTP " + res.status + ")");
        mime = res.headers.get("content-type") || "";
        data = await res.arrayBuffer();
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (!msg.startsWith("Couldn't fetch")) {
          data = null;
        } else {
          throw e;
        }
      }
      if (!data) {
        const proxyUrl = "/api/proxy-download?url=" + encodeURIComponent(url);
        const res2 = await fetch(proxyUrl);
        if (!res2.ok) throw new Error("Couldn't fetch that link (HTTP " + res2.status + ")");
        mime = res2.headers.get("content-type") || "";
        data = await res2.arrayBuffer();
      }
      if (!data || data.byteLength === 0) throw new Error("That link came back empty.");
      if (!mime || mime.includes("text/html")) mime = t === "video" ? "video/mp4" : t === "image" ? "image/jpeg" : "audio/mpeg";
      const blob = new Blob([data], { type: mime });
      return new File([blob], name, { type: mime });
    } finally {
      setDownloading(false);
    }
  }

  async function useDownloadLink() {
    const url = linkUrl.trim();
    if (!url) return;
    setLinkError(null);
    setLinkType(null);
    if (!classifyDownloadUrl(url)) {
      setLinkError("Couldn't download that. It needs to be a direct video/image/audio file link (.mp4, .webm, .jpg, .mp3...).");
      return;
    }
    setProcessing(true);
    try {
      const downloaded = await downloadFromLink(url);
      if (downloaded.type.startsWith("video") || downloaded.type.startsWith("audio")) {
        const { ok, duration } = await validateMediaDuration(downloaded);
        if (!ok) {
          setLinkError(`That media is too long (${Math.floor(duration / 60)}:${String(Math.floor(duration % 60)).padStart(2, "0")}). Max 1:30.`);
          return;
        }
      }
      const prepared = await prepareMediaFile(downloaded);
      const tall = prepared.type.startsWith("video")
        ? await formatToTall(prepared)
        : prepared;
      setFile(tall);
      setPreview(URL.createObjectURL(tall));
      setLinkUrl("");
      setLinkType(null);
      setLinkError(null);
    } catch (e) {
      setLinkError(e instanceof Error ? e.message : "Couldn't download that link.");
    } finally {
      setProcessing(false);
    }
  }

  function removeLink() {
    setLinkUrl("");
    setLinkType(null);
    setLinkError(null);
    setPreview(null);
  }

  function mediaType(f: File) {
    if (f.type.startsWith("video")) return "video";
    if (f.type.startsWith("audio")) return "audio";
    return "image";
  }

  function toggleTag(tag: string) {
    setTags((prev) => {
      if (prev.includes(tag)) return prev.filter((t) => t !== tag);
      return [...prev, tag];
    });
  }

  async function submit() {
    if (!file) return;
    setBusy(true);
    const meData = readMe();
    if (!meData) { setBusy(false); router.push("/auth"); return; }
    const fullCaption = caption + (tags.length ? " " + tags.join(" ") : "");
    const type = mediaType(file);
    const path = `${meData.id}/${Date.now()}-${file.name}`;
    const { error: upErr } = await supabase.storage.from("posts").upload(path, file);
    if (upErr) { alert(upErr.message); setBusy(false); return; }
    const { data: { publicUrl } } = supabase.storage.from("posts").getPublicUrl(path);
    await supabase.from("posts").insert({ user_id: meData.id, image_url: publicUrl, caption: fullCaption, media_type: type });
    if (type === "video") {
      try {
        const url = URL.createObjectURL(file);
        const vid = document.createElement("video");
        vid.muted = true;
        vid.playsInline = true;
        vid.src = url;
        await new Promise<void>((resolve) => { vid.onloadeddata = () => resolve(); vid.onerror = () => resolve(); });
        vid.currentTime = 0.1;
        await new Promise<void>((resolve) => { vid.onseeked = () => resolve(); vid.onerror = () => resolve(); });
        const canvas = document.createElement("canvas");
        canvas.width = vid.videoWidth || 800;
        canvas.height = vid.videoHeight || 600;
        canvas.getContext("2d")?.drawImage(vid, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(url);
        const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", 0.7));
        if (blob) {
          const pPath = `${meData.id}/poster-${Date.now()}.jpg`;
          await supabase.storage.from("posts").upload(pPath, blob, { contentType: "image/jpeg" });
          const { data: { publicUrl: posterUrl } } = supabase.storage.from("posts").getPublicUrl(pPath);
          await supabase.from("posts").update({ poster_url: posterUrl }).eq("image_url", publicUrl);
        }
      } catch {}
    }
    setBusy(false);
    router.push("/");
  }

  const type = file ? mediaType(file) : null;
  const sizeMb = file ? (file.size / 1024 / 1024).toFixed(1) : "0";

  return (
    <div className="min-h-screen bg-black text-white md:ml-[72px]">
      <div className="flex items-center gap-4 px-6 py-4 border-b border-zinc-800">
        <h1 className="text-2xl font-bold">{t("create.upload")}</h1>
        <span className="text-sm text-zinc-500">{t("create.postacc")}</span>
      </div>

      <div className="max-w-[1100px] mx-auto p-6 grid grid-cols-1 lg:grid-cols-[1fr_420px] gap-8">
        <div
          {...getRootProps()}
          className={`relative border-2 border-dashed rounded-2xl flex flex-col items-center justify-center min-h-[540px] p-8 transition-colors ${
            isDragActive ? "border-blue-400 bg-blue-500/5" : "border-zinc-700 hover:border-zinc-500"
          }`}
        >
          <input {...getInputProps()} />
          {processing ? (
            <div className="flex flex-col items-center gap-4">
              <div className="w-12 h-12 border-4 border-zinc-700 border-t-blue-500 rounded-full animate-spin" />
              <p className="text-lg font-semibold">{t("upload.tall")}</p>
              <p className="text-sm text-zinc-500 text-center max-w-[280px]">{t("upload.tallSub")}</p>
            </div>
          ) : !file && !preview ? (
            <div className="flex flex-col items-center w-full">
              <CloudUpload className="w-16 h-16 text-zinc-500" />
              <p className="mt-4 text-xl font-semibold">{t("create.select")}</p>
              <p className="mt-1 text-sm text-zinc-500">{t("create.dragdrop")}</p>
              <div className="mt-6 flex gap-4 text-xs text-zinc-500">
                <span className="flex items-center gap-1"><FileVideo2 className="w-4 h-4" /> MP4 / WebM</span>
                <span className="flex items-center gap-1"><ImageIcon className="w-4 h-4" /> PNG / JPG</span>
                <span className="flex items-center gap-1"><Music className="w-4 h-4" /> MP3</span>
              </div>
              <p className="mt-4 text-xs text-zinc-600">Less than 2GB • 720x1280 or higher • {sizeMb} MB</p>
              <div className="mt-6 px-6 py-2.5 bg-blue-500 rounded-full text-sm font-semibold text-white">{t("create.select")}</div>

              <div className="mt-8 w-full max-w-[460px] border-t border-zinc-800 pt-6" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
                <p className="text-sm font-semibold text-center">{t("upload.orlink")}</p>
                <p className="mt-1 text-xs text-zinc-500 text-center">{t("upload.linksub")}</p>
                <div className="mt-3 flex gap-2">
                  <input
                    value={linkUrl}
                    onChange={(e) => setLinkUrl(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && useDownloadLink()}
                    placeholder="https://example.com/video.mp4"
                    className="flex-1 min-w-0 px-3 py-2.5 bg-zinc-900 border border-zinc-800 rounded-lg text-sm outline-none focus:border-blue-500"
                  />
                  <button
                    onClick={useDownloadLink}
                    disabled={downloading || processing || !linkUrl.trim()}
                    className="shrink-0 px-4 py-2.5 rounded-full bg-zinc-800 hover:bg-zinc-700 text-sm font-semibold disabled:opacity-40"
                  >
                    {downloading ? t("upload.downloading") : t("create.skipUpload")}
                  </button>
                </div>
                {linkError && <p className="mt-2 text-xs text-red-400 text-center">{linkError}</p>}
              </div>
            </div>
          ) : (
            <>
              {type === "video" ? (
                <video src={preview!} controls autoPlay className="w-full max-h-[500px] rounded-xl" />
              ) : type === "audio" ? (
                <div className="flex flex-col items-center gap-4 p-6">
                  <div className="w-28 h-28 rounded-full bg-gradient-to-tr from-purple-500 to-blue-500 flex items-center justify-center">
                    <Music className="w-12 h-12 text-white" />
                  </div>
                  <audio src={preview!} controls autoPlay className="w-64" />
                </div>
              ) : (
                <img src={preview!} alt="" className="w-full max-h-[500px] object-contain rounded-xl" />
              )}
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); pickFile(null); }}
                className="absolute top-4 right-4 p-2 rounded-full bg-black/70 hover:bg-black/90 text-white"
                aria-label="Remove file"
              >
                <X className="w-5 h-5" />
              </button>
              <p className="mt-4 text-sm text-zinc-400">{file!.name} • {sizeMb} MB</p>
            </>
          )}
        </div>

        <div className="flex flex-col gap-5">
          <div>
            <label className="text-sm font-semibold">{t("create.caption")}</label>
            <textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder={t("create.captionph")}
              rows={4}
              maxLength={2200}
              className="mt-2 w-full px-3 py-2.5 bg-zinc-900 border border-zinc-800 rounded-lg text-sm outline-none resize-none focus:border-blue-500 transition"
            />
            <div className="flex justify-between mt-1 text-xs text-zinc-500">
              <span>Hashtags and @mentions</span>
              <span>{caption.length}/2200</span>
            </div>
          </div>

          <div>
            <label className="text-sm font-semibold">{t("create.tags")}</label>
            <div className="mt-2 flex flex-wrap gap-2">
              {["#mchs", "#school", "#funny", "#fyp"].map((tag) => (
                <button
                  key={tag}
                  onClick={() => toggleTag(tag)}
                  className={`text-xs px-3 py-1.5 rounded-full transition ${tags.includes(tag) ? "bg-blue-500 text-white" : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"}`}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
            <label className="text-sm font-semibold">{t("create.whowatch")}</label>
            <select
              value={whoCanWatch}
              onChange={(e) => setWhoCanWatch(e.target.value)}
              className="mt-2 w-full px-3 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-sm outline-none"
            >
              <option>Everyone</option>
              <option>Followers</option>
              <option>Only me</option>
            </select>
          </div>

          <div className="flex gap-3 mt-auto pt-2">
            <button
              onClick={() => { setFile(null); setPreview(null); setCaption(""); setTags([]); }}
              className="flex-1 py-3 rounded-full bg-[#26292D] hover:bg-[#363A3F] text-sm font-semibold text-white transition-colors"
            >
              {t("common.discard")}
            </button>
            <button
              onClick={submit}
              disabled={busy || processing || !file}
              className="flex-1 py-3 rounded-full bg-blue-500 hover:bg-blue-600 text-sm font-semibold text-white transition-colors disabled:opacity-40"
            >
              {busy ? "Posting..." : processing ? "Converting..." : t("common.post")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
