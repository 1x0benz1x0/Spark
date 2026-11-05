"use client";
import { useDropzone } from "react-dropzone";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { CloudUpload, FileVideo2, Music, Image as ImageIcon, X } from "lucide-react";
import { readMe } from "@/lib/spark-auth";
import { validateMediaDuration, MAX_MEDIA_SECONDS, prepareMediaFile } from "@/lib/media";
import { formatToTall } from "@/lib/tall-format";

export default function CreatePage() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
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
    if (!f) { setFile(null); setPreview(null); return; }
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
    } finally {
      setProcessing(false);
    }
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
      {/* header */}
      <div className="flex items-center gap-4 px-6 py-4 border-b border-zinc-800">
        <h1 className="text-2xl font-bold">Upload video</h1>
        <span className="text-sm text-zinc-500">Post a video to your account</span>
      </div>

      <div className="max-w-[1100px] mx-auto p-6 grid grid-cols-1 lg:grid-cols-[1fr_420px] gap-8">
        {/* LEFT: upload area */}
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
              <p className="text-lg font-semibold">Turning video tallâ€¦</p>
              <p className="text-sm text-zinc-500 text-center max-w-[280px]">Resizing to vertical format so it plays everywhere.</p>
            </div>
          ) : !file ? (
            <>
              <CloudUpload className="w-16 h-16 text-zinc-500" />
              <p className="mt-4 text-xl font-semibold">Select video to upload</p>
              <p className="mt-1 text-sm text-zinc-500">Or drag and drop a file</p>
              <div className="mt-6 flex gap-4 text-xs text-zinc-500">
                <span className="flex items-center gap-1"><FileVideo2 className="w-4 h-4" /> MP4 / WebM</span>
                <span className="flex items-center gap-1"><ImageIcon className="w-4 h-4" /> PNG / JPG</span>
                <span className="flex items-center gap-1"><Music className="w-4 h-4" /> MP3</span>
              </div>
              <p className="mt-4 text-xs text-zinc-600">Less than 2GB â€¢ 720x1280 or higher â€¢ {sizeMb} MB</p>
              <div className="mt-6 px-6 py-2.5 bg-blue-500 rounded-full text-sm font-semibold text-white">Select video</div>
            </>
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
              <p className="mt-4 text-sm text-zinc-400">{file.name} â€¢ {sizeMb} MB</p>
            </>
          )}
        </div>

        {/* RIGHT: details */}
        <div className="flex flex-col gap-5">
          <div>
            <label className="text-sm font-semibold">Caption</label>
            <textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Describe your video"
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
            <label className="text-sm font-semibold">Tags</label>
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
            <label className="text-sm font-semibold">Who can watch this video</label>
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
              Discard
            </button>
            <button
              onClick={submit}
              disabled={busy || processing || !file}
              className="flex-1 py-3 rounded-full bg-blue-500 hover:bg-blue-600 text-sm font-semibold text-white transition-colors disabled:opacity-40"
            >
              {busy ? "Posting..." : processing ? "Converting..." : "Post"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
