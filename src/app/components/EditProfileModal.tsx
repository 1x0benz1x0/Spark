"use client";
import { useState } from "react";
import { X, Camera, Save } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

async function compressImage(file: File): Promise<File> {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(1, 800 / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext("2d")?.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        (blob) => {
          URL.revokeObjectURL(url);
          resolve(blob ? new File([blob], file.name, { type: "image/jpeg" }) : file);
        },
        "image/jpeg",
        0.8
      );
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
    img.src = url;
  });
}

export function EditProfileModal({ onClose, profile, me, onSaved }: {
  onClose: () => void;
  profile: { username: string; full_name: string; avatar_url: string; bio: string } | null;
  me: string;
  onSaved: () => void;
}) {
  const supabase = createClient();
  const [name, setName] = useState(profile?.full_name ?? "");
  const [bio, setBio] = useState(profile?.bio ?? "");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const currentAvatar = preview || profile?.avatar_url || "";

  async function selectPhoto(file: File) {
    setPendingFile(file);
    setPreview(URL.createObjectURL(file));
  }

  async function save() {
    setSaving(true);
    setError("");
    try {
      let nextAvatar = profile?.avatar_url ?? "";
      if (pendingFile) {
        const compressed = await compressImage(pendingFile);
        const path = me + "/avatar-" + Date.now() + "-" + compressed.name;
        const { error } = await supabase.storage.from("posts").upload(path, compressed);
        if (error) throw error;
        const { data: { publicUrl } } = supabase.storage.from("posts").getPublicUrl(path);
        nextAvatar = publicUrl;
      } else if (avatarUrl.trim()) {
        nextAvatar = avatarUrl.trim();
      }
      const { error } = await supabase.from("profiles").update({ full_name: name, bio, avatar_url: nextAvatar }).eq("id", me);
      if (error) throw error;
      onSaved();
      onClose();
    } catch (e: any) {
      setError(e.message ?? "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm px-4" onClick={onClose}>
      <div
        className="w-full max-w-[440px] bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-800 bg-zinc-950/50">
          <span className="text-sm text-zinc-500">Edit</span>
          <p className="font-bold text-lg">Edit profile</p>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-zinc-800 text-zinc-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 flex flex-col gap-5">
          <div className="flex flex-col items-center gap-3">
            <div className="relative">
              <div className="w-24 h-24 rounded-full bg-zinc-800 overflow-hidden flex items-center justify-center ring-4 ring-zinc-800">
                {currentAvatar
                  ? <img src={currentAvatar} alt="" className="w-full h-full object-cover" />
                  : <span className="text-3xl font-bold text-zinc-500">{(profile?.username ?? "U")[0]?.toUpperCase()}</span>}
              </div>
              <label className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-blue-500 hover:bg-blue-600 flex items-center justify-center cursor-pointer transition-colors">
                <Camera className="w-4 h-4 text-white" />
                <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && selectPhoto(e.target.files[0])} />
              </label>
            </div>
            <p className="text-xs text-zinc-500">
              {pendingFile ? "Previewing new photo — will save on click below" : "Tap the camera to change your photo"}
            </p>
          </div>

          <div>
            <label className="text-xs font-semibold text-zinc-400">Avatar URL (optional)</label>
            <input
              value={avatarUrl}
              onChange={(e) => setAvatarUrl(e.target.value)}
              onBlur={() => { if (avatarUrl.trim()) setPreview(avatarUrl.trim()); }}
              placeholder="https://…"
              className="mt-1 w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm outline-none focus:border-blue-500 transition"
            />
            <p className="mt-1 text-[11px] text-zinc-600">Paste an image link instead of uploading.</p>
          </div>

          <div>
            <label className="text-xs font-semibold text-zinc-400">Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your full name"
              className="mt-1 w-full px-3 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-sm outline-none focus:border-blue-500 transition"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-zinc-400">Bio</label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Tell people who you are…"
              rows={3}
              maxLength={150}
              className="mt-1 w-full px-3 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-sm outline-none resize-none focus:border-blue-500 transition"
            />
            <div className="flex justify-end mt-1">
              <span className="text-[11px] text-zinc-600">{bio.length}/150</span>
            </div>
          </div>

          {error && <p className="text-sm text-red-400 text-center">{error}</p>}

          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="flex-1 py-2.5 rounded-full bg-zinc-800 hover:bg-zinc-700 text-sm font-semibold text-white transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={save}
              disabled={saving}
              className="flex-1 py-2.5 rounded-full bg-blue-500 hover:bg-blue-600 text-sm font-semibold text-white transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <Save className="w-4 h-4" />
              {saving ? "Saving…" : "Save changes"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
