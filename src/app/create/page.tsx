"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { readMe } from "@/lib/spark-auth";
import { validateMediaDuration } from "@/lib/media";

export default function CreatePage() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [busy, setBusy] = useState(false);
  const supabase = createClient();
  const router = useRouter();

  async function pickFile(f: File | null) {
    if (!f) { setFile(null); setPreview(null); return; }
    if (f.type.startsWith("video") || f.type.startsWith("audio")) {
      const { ok, duration } = await validateMediaDuration(f);
      if (!ok) {
        alert(`Media is too long (${Math.floor(duration / 60)}:${String(Math.floor(duration % 60)).padStart(2, "0")}). Max 1:30.`);
        return;
      }
    }
    setFile(f);
    setPreview(URL.createObjectURL(f));
  }

  function mediaType(f: File) {
    if (f.type.startsWith("video")) return "video";
    if (f.type.startsWith("audio")) return "audio";
    return "image";
  }

  async function submit() {
    if (!file) return;
    setBusy(true);
    const meData = readMe();
    if (!meData) { router.push("/auth"); return; }
    const path = `${meData.id}/${Date.now()}-${file.name}`;
    const { error: upErr } = await supabase.storage.from("posts").upload(path, file);
    if (upErr) { alert(upErr.message); setBusy(false); return; }
    const { data: { publicUrl } } = supabase.storage.from("posts").getPublicUrl(path);
    await supabase.from("posts").insert({ user_id: meData.id, image_url: publicUrl, caption, media_type: mediaType(file) });
    setBusy(false);
    router.push("/");
  }

  const type = file ? mediaType(file) : null;

  return (
    <div className="min-h-screen bg-black text-white max-w-[470px] mx-auto md:border-x md:border-zinc-800">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-800 sticky top-0 bg-black z-10">
        <Link href="/" className="p-1 hover:opacity-70"><ArrowLeft className="w-6 h-6" /></Link>
        <h1 className="font-semibold">New post</h1>
        <button onClick={submit} disabled={busy || !file} className="text-blue-500 font-semibold disabled:opacity-40">
          {busy ? "Sharing…" : "Share"}
        </button>
      </div>

      {/* Media area */}
      <div className="aspect-square bg-zinc-900 flex items-center justify-center relative overflow-hidden">
        {preview
          ? (
            type === "video"
              ? <video src={preview} className="w-full h-full object-contain" controls autoPlay />
              : type === "audio"
                ? (
                  <div className="flex flex-col items-center gap-4">
                    <div className="w-28 h-28 rounded-full bg-gradient-to-tr from-purple-500 to-blue-500 flex items-center justify-center">
                      <svg className="w-12 h-12 text-white" viewBox="0 0 24 24" fill="currentColor"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55c-2.21 0-4 1.79-4 4s1.79 4 4 4s4-1.79 4-4V7h4V3h-6z" /></svg>
                    </div>
                    <audio src={preview} controls autoPlay className="w-64" />
                  </div>
                )
                : <img src={preview} alt="" className="w-full h-full object-cover" />
          )
          : (
            <label className="cursor-pointer flex flex-col items-center gap-3 text-zinc-400">
              <div className="w-20 h-20 rounded-full border-2 border-dashed border-zinc-600 flex items-center justify-center text-3xl hover:border-blue-500 hover:text-blue-500 transition">+</div>
              <p className="text-sm">Select a photo, video or audio</p>
              <input type="file" accept="image/*,video/*,audio/*" className="hidden" onChange={(e) => pickFile(e.target.files?.[0] ?? null)} />
            </label>
          )}
      </div>

      {/* Caption */}
      <textarea
        value={caption}
        onChange={(e) => setCaption(e.target.value)}
        placeholder="Write a caption..."
        rows={3}
        className="w-full px-4 py-3 bg-transparent text-sm outline-none resize-none border-b border-zinc-800 focus:border-zinc-600 transition"
      />
    </div>
  );
}
