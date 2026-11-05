"use client";
import { useEffect, useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { X, Plus, Heart, Trash2, Eye } from "lucide-react";
import { User as UserIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { readMe } from "@/lib/spark-auth";
import { validateMediaDuration } from "@/lib/media";

type Story = { id: string; user_id: string; image_url: string; media_type?: string; created_at: string; profiles: { username: string; avatar_url: string } | null };
type Group = { user: { id: string; username: string; avatar_url: string | null }; items: Story[] };
type Viewer = { id: string; username: string; avatar_url: string | null };

export function Stories() {
  const supabase = createClient();
  const router = useRouter();
  const me = readMe()?.id ?? null;
  const [groups, setGroups] = useState<Group[]>([]);
  const [myAvatar, setMyAvatar] = useState<string | null>(null);
  const [viewer, setViewer] = useState<{ group: number; item: number } | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // per-story engagement
  const [likeCount, setLikeCount] = useState<Record<string, number>>({});
  const [liked, setLiked] = useState<Set<string>>(new Set());
  const [viewCount, setViewCount] = useState<Record<string, number>>({});
  const [viewers, setViewers] = useState<Viewer[]>([]);
  const [showViewers, setShowViewers] = useState(false);

  async function load() {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    if (me) {
      const { data: prof } = await supabase.from("profiles").select("avatar_url").eq("id", me).single();
      setMyAvatar(prof?.avatar_url ?? null);
    }
    const { data } = await supabase
      .from("stories")
      .select("id, user_id, image_url, media_type, created_at, profiles(username, avatar_url)")
      .gte("created_at", cutoff)
      .order("created_at");
    if (!data) return;
    const map = new Map<string, Group>();
    for (const s of data as unknown as Story[]) {
      const u = s.profiles ?? { id: s.user_id, username: "unknown", avatar_url: null };
      if (!map.has(s.user_id)) {
        map.set(s.user_id, { user: { id: s.user_id, username: u.username, avatar_url: u.avatar_url }, items: [] });
      }
      map.get(s.user_id)!.items.push(s);
    }
    setGroups([...map.values()]);

    // engagement counts for all stories
    const ids = (data as any[]).map((s) => s.id);
    if (ids.length) {
      const [{ data: likes }, { data: views }] = await Promise.all([
        supabase.from("story_likes").select("story_id, user_id").in("story_id", ids),
        supabase.from("story_views").select("story_id").in("story_id", ids),
      ]);
      const lc: Record<string, number> = {};
      const likedSet = new Set<string>();
      (likes ?? []).forEach((l: any) => {
        lc[l.story_id] = (lc[l.story_id] ?? 0) + 1;
        if (l.user_id === me) likedSet.add(l.story_id);
      });
      const vc: Record<string, number> = {};
      (views ?? []).forEach((v: any) => { vc[v.story_id] = (vc[v.story_id] ?? 0) + 1; });
      setLikeCount(lc);
      setLiked(likedSet);
      setViewCount(vc);
    }
  }

  useEffect(() => { load(); }, []);

  async function addStory(file: File) {
    if (file.type.startsWith("video") || file.type.startsWith("audio")) {
      const { ok, duration } = await validateMediaDuration(file);
      if (!ok) {
        alert(`Media is too long (${Math.floor(duration / 60)}:${String(Math.floor(duration % 60)).padStart(2, "0")}). Max 1:30.`);
        return;
      }
    }
    setUploading(true);
    if (me) {
      const { prepareMediaFile } = await import("@/lib/media");
      const prepared = await prepareMediaFile(file);
      const path = `${me}/story-${Date.now()}-${prepared.name}`;
      const { error } = await supabase.storage.from("posts").upload(path, prepared);
      if (!error) {
        const { data: { publicUrl } } = supabase.storage.from("posts").getPublicUrl(path);
        const media_type = prepared.type.startsWith("video") ? "video" : prepared.type.startsWith("audio") ? "audio" : "image";
        await supabase.from("stories").insert({ user_id: me, image_url: publicUrl, media_type });
        await load();
      } else {
        alert(error.message);
      }
    }
    setUploading(false);
  }

  const cur = viewer !== null ? groups[viewer.group] : null;
  const curStory = cur ? cur.items[viewer!.item] : null;

  // when opening a story: record a view (if not own) + load viewers if owner
  useEffect(() => {
    if (!curStory) return;
    if (me && me !== curStory.user_id) {
      supabase.from("story_views").insert({ story_id: curStory.id, viewer_id: me }).then(() => {
        setViewCount((v) => ({ ...v, [curStory.id]: (v[curStory.id] ?? 0) + (v[curStory.id] ? 0 : 1) }));
      });
    }
    if (me === curStory.user_id) {
      supabase
        .from("story_views")
        .select("viewer_id, profiles(username, avatar_url)")
        .eq("story_id", curStory.id)
        .then(({ data }) => {
          const vs = ((data ?? []) as any[]).map((v) => ({
            id: v.viewer_id,
            username: v.profiles?.username ?? "unknown",
            avatar_url: v.profiles?.avatar_url ?? null,
          }));
          setViewers(vs);
        });
    } else {
      setViewers([]);
    }
    setShowViewers(false);
  }, [viewer?.group, viewer?.item]);

  function next() {
    if (!viewer || !cur) return;
    if (viewer.item < cur.items.length - 1) setViewer({ ...viewer, item: viewer.item + 1 });
    else if (viewer.group < groups.length - 1) setViewer({ group: viewer.group + 1, item: 0 });
    else setViewer(null);
  }
  function prev() {
    if (!viewer) return;
    if (viewer.item > 0) setViewer({ ...viewer, item: viewer.item - 1 });
    else if (viewer.group > 0) setViewer({ group: viewer.group - 1, item: 0 });
    else setViewer(null);
  }

  useEffect(() => {
    if (viewer === null || !curStory) return;
    const isMedia = (curStory.media_type ?? "image") !== "image";
    if (isMedia) return; // media playback controls its own length
    const t = setTimeout(next, 5000);
    return () => clearTimeout(t);
  }, [viewer, viewer?.item, viewer?.group]);

  useEffect(() => {
    function key(e: KeyboardEvent) {
      if (e.key === "Escape") setViewer(null);
      if (e.key === "ArrowRight") next();
      if (e.key === "ArrowLeft") prev();
    }
    if (viewer !== null) {
      window.addEventListener("keydown", key);
      return () => window.removeEventListener("keydown", key);
    }
  }, [viewer]);

  async function toggleLike() {
    if (!curStory || !me) return;
    if (liked.has(curStory.id)) {
      await supabase.from("story_likes").delete().eq("story_id", curStory.id).eq("user_id", me);
      setLiked((s) => { const n = new Set(s); n.delete(curStory.id); return n; });
      setLikeCount((c) => ({ ...c, [curStory.id]: Math.max(0, (c[curStory.id] ?? 1) - 1) }));
    } else {
      await supabase.from("story_likes").insert({ story_id: curStory.id, user_id: me });
      setLiked((s) => new Set(s).add(curStory.id));
      setLikeCount((c) => ({ ...c, [curStory.id]: (c[curStory.id] ?? 0) + 1 }));
    }
  }

  async function deleteStory() {
    if (!curStory || !me || me !== curStory.user_id) return;
    if (!confirm("Delete this story?")) return;
    await supabase.from("stories").delete().eq("id", curStory.id);
    setViewer(null);
    await load();
  }

  const openMy = () => {
    const mine = groups.findIndex((g) => g.user.id === me);
    if (mine >= 0) setViewer({ group: mine, item: 0 });
    else fileRef.current?.click();
  };

  return (
    <div>
      <div className="flex gap-4 overflow-x-auto px-4 py-4 scrollbar-none">
        {me && (
          <div className="flex flex-col items-center gap-1 shrink-0 cursor-pointer" onClick={openMy}>
            <div className="relative w-16 h-16">
              <div className={`w-16 h-16 rounded-full ${groups.some((g) => g.user.id === me) ? "p-[2px] bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-600" : "bg-zinc-700"}`}>
                <div className="w-full h-full rounded-full bg-zinc-800 border-2 border-black overflow-hidden flex items-center justify-center">
                  {myAvatar
                    ? <img src={myAvatar} alt="" className="w-full h-full object-cover" />
                    : <UserIcon className="w-6 h-6 text-zinc-500" />}
                </div>
              </div>
              {!groups.some((g) => g.user.id === me) && (
                <div className="absolute bottom-0 right-0 w-5 h-5 rounded-full bg-blue-500 border-2 border-black flex items-center justify-center">
                  <Plus className="w-3 h-3 text-white" />
                </div>
              )}
            </div>
            <span className="text-xs text-zinc-300">Your story</span>
            <input ref={fileRef} type="file" accept="image/*,video/*,audio/*" className="hidden"
              onChange={(e) => e.target.files?.[0] && addStory(e.target.files[0])} />
          </div>
        )}
        {groups.filter((g) => g.user.id !== me).map((g) => (
          <div key={g.user.id} className="flex flex-col items-center gap-1 shrink-0 cursor-pointer" onClick={() => {
            const idx = groups.indexOf(g);
            setViewer({ group: idx, item: 0 });
          }}>
            <div className="w-16 h-16 rounded-full p-[2px] bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-600">
              <div className="w-full h-full rounded-full bg-zinc-800 border-2 border-black overflow-hidden">
                {g.user.avatar_url
                  ? <img src={g.user.avatar_url} alt="" className="w-full h-full object-cover" />
                  : <div className="w-full h-full flex items-center justify-center"><UserIcon className="w-6 h-6 text-zinc-500" /></div>}
              </div>
            </div>
            <span className="text-xs text-zinc-300 max-w-[64px] truncate">{g.user.username}</span>
          </div>
        ))}
        {groups.length === 0 && <p className="text-xs text-zinc-500 self-center">No stories yet — add one!</p>}
      </div>

      {cur && curStory && viewer !== null && (
        <div className="fixed inset-0 z-50 bg-black flex items-center justify-center" onClick={() => setViewer(null)}>
          {/* progress bars */}
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 flex gap-1 w-[min(96vw,400px)]">
            {cur.items.map((_, i) => (
              <div key={i} className="h-[3px] flex-1 bg-zinc-700 rounded-full overflow-hidden">
                <div className={`h-full bg-white ${i < viewer.item ? "w-full" : i === viewer.item ? "w-full animate-[story_5s_linear]" : "w-0"}`} />
              </div>
            ))}
          </div>
          {/* header */}
          <div className="absolute top-6 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2 w-[min(96vw,400px)]" onClick={(e) => e.stopPropagation()}>
            <div className="w-8 h-8 rounded-full bg-zinc-700 overflow-hidden">
              {cur.user.avatar_url && <img src={cur.user.avatar_url} alt="" className="w-full h-full object-cover" />}
            </div>
            <span className="font-semibold text-sm">{cur.user.username}</span>
            <button onClick={() => setViewer(null)} className="ml-auto p-1"><X className="w-6 h-6" /></button>
          </div>
          {/* media */}
          {(curStory.media_type ?? "image") === "image" && (
            <img src={curStory.image_url} alt="" className="max-h-[75vh] max-w-[92vw] object-contain select-none pointer-events-none" />
          )}
          {(curStory.media_type ?? "image") === "video" && (
            <video
              src={curStory.image_url}
              className="max-h-[75vh] max-w-[92vw] object-contain select-none"
              autoPlay
              controls
              onEnded={next}
            />
          )}
          {(curStory.media_type ?? "image") === "audio" && (
            <div className="flex flex-col items-center gap-4 max-w-[92vw] w-[400px] p-6 bg-zinc-900 rounded-2xl border border-zinc-800 select-none" onClick={(e) => e.stopPropagation()}>
              <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-purple-500 to-blue-500 flex items-center justify-center">
                <svg className="w-10 h-10 text-white" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55c-2.21 0-4 1.79-4 4s1.79 4 4 4s4-1.79 4-4V7h4V3h-6z" />
                </svg>
              </div>
              <p className="text-sm text-zinc-300">Audio story</p>
              <audio src={curStory.image_url} autoPlay controls onEnded={next} className="w-full" />
            </div>
          )}
          {/* actions bar */}
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 flex items-center gap-6 w-[min(96vw,400px)]" onClick={(e) => e.stopPropagation()}>
            <button onClick={toggleLike} className="flex items-center gap-1.5">
              <Heart className={`w-6 h-6 ${liked.has(curStory.id) ? "fill-red-500 text-red-500" : "text-white"}`} />
              <span className="text-sm">{likeCount[curStory.id] ?? 0}</span>
            </button>
            <div className="flex items-center gap-1.5 text-sm">
              <Eye className="w-5 h-5" />
              <span>{viewCount[curStory.id] ?? 0}</span>
            </div>
            {me === curStory.user_id && (
              <>
                <button onClick={() => setShowViewers((v) => !v)} className="text-xs text-zinc-300 underline">
                  {showViewers ? "Hide" : "Viewers"}
                </button>
                <button onClick={deleteStory} className="ml-auto text-red-400">
                  <Trash2 className="w-5 h-5" />
                </button>
              </>
            )}
          </div>
          {/* viewers list */}
          {showViewers && me === curStory.user_id && (
            <div className="absolute bottom-20 left-1/2 -translate-x-1/2 z-10 w-[min(96vw,400px)] max-h-40 overflow-y-auto bg-zinc-900/90 rounded-lg p-3" onClick={(e) => e.stopPropagation()}>
              {viewers.length === 0 && <p className="text-xs text-zinc-400">No viewers yet</p>}
              {viewers.map((v) => (
                <div key={v.id} className="flex items-center gap-2 py-1">
                  <div className="w-7 h-7 rounded-full bg-zinc-700 overflow-hidden flex items-center justify-center">
                    {v.avatar_url ? <img src={v.avatar_url} alt="" className="w-full h-full object-cover" /> : <UserIcon className="w-4 h-4" />}
                  </div>
                  <span className="text-sm">{v.username}</span>
                </div>
              ))}
            </div>
          )}
          {/* nav arrows */}
          <button onClick={(e) => { e.stopPropagation(); prev(); }} className="absolute left-3 top-1/2 -translate-y-1/2 p-2 opacity-70 hover:opacity-100"><ChevronLeft className="w-7 h-7" /></button>
          <button onClick={(e) => { e.stopPropagation(); next(); }} className="absolute right-3 top-1/2 -translate-y-1/2 p-2 opacity-70 hover:opacity-100"><ChevronRight className="w-7 h-7" /></button>
          {/* tap zones */}
          <button onClick={(e) => { e.stopPropagation(); prev(); }} className="absolute left-0 top-16 bottom-24 w-1/3 opacity-0" aria-label="prev" />
          <button onClick={(e) => { e.stopPropagation(); next(); }} className="absolute right-0 top-16 bottom-24 w-1/3 opacity-0" aria-label="next" />
        </div>
      )}

      {uploading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
          <p className="text-sm">Uploading story…</p>
        </div>
      )}
    </div>
  );
}
