"use client";
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { Heart, MessageCircle, Share2, Volume2, VolumeX, Play, ChevronUp, ChevronDown } from "lucide-react";
import { readMe } from "@/lib/spark-auth";
import { CrownIcon, VerifiedBadge } from "../components/Badges";
import { Sidebar } from "../components/Sidebar";
import { SparkLogo } from "../components/SparkLogo";

type SparkPost = {
  id: string;
  image_url: string;
  caption: string;
  user_id: string;
  created_at: string;
  profiles: { username: string; avatar_url: string; verified?: boolean; is_owner?: boolean } | null;
};

function SparkVideo({ post, idx, liked, likeCount, commentCount, comments, commentDraft, setCommentDraft, onAddComment, onLike, onOpenComments, muted, setMutedState, onOpenProfile, isCommentsOpen, goToProfile }: {
  post: SparkPost;
  idx: number;
  liked: boolean;
  likeCount: number;
  commentCount: number;
  comments: any[];
  commentDraft: string;
  setCommentDraft: (s: string) => void;
  onAddComment: () => void;
  onLike: (id: string) => void;
  onOpenComments: () => void;
  muted: boolean;
  setMutedState: (v: boolean) => void;
  onOpenProfile: (id: string) => void;
  isCommentsOpen: boolean;
  goToProfile: (username: string) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const sectionRef = useRef<HTMLElement>(null);
  const [paused, setPaused] = useState(false);
  const [volume, setVolume] = useState(muted ? 0 : 0.8);

  function togglePlay() {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) { v.play(); setPaused(false); } else { v.pause(); setPaused(true); }
  }

  useEffect(() => {
    const v = videoRef.current;
    const el = sectionRef.current;
    if (!v || !el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            v.play().catch(() => {});
            setPaused(false);
          } else {
            v.pause();
            setPaused(true);
          }
        });
      },
      { threshold: 0.6 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <section ref={sectionRef} data-spark-section className="relative h-[100svh] w-full snap-start snap-always flex items-center justify-center bg-black overflow-hidden">
      <SparkLogo className="absolute top-4 left-4 w-5 h-5 z-10" />
      <div className="w-full h-full md:max-w-[60vw] md:w-[60vw] relative">
        <video
          ref={videoRef}
          src={post.image_url}
          autoPlay
          loop
          muted={muted}
          playsInline
          onClick={togglePlay}
          className="w-full h-full object-contain bg-black"
        />
        {paused && (
          <button onClick={togglePlay} className="absolute inset-0 flex items-center justify-center bg-black/30 z-10">
            <Play className="w-20 h-20 text-white fill-white" />
          </button>
        )}
        {/* top-left label + volume hover slider */}
        <div className="absolute top-3 left-0 flex items-center gap-2 text-white/90">
          <div className="relative group ml-1">
            <button
              className="p-2 flex items-center gap-2"
              onClick={() => {
                const el = videoRef.current;
                setMutedState(!muted);
                setVolume(muted ? 0.8 : 0);
                if (el) { el.muted = !muted; el.volume = muted ? 0.8 : 0; }
              }}
            >
              {muted || volume === 0 ? <VolumeX className="w-6 h-6" /> : <Volume2 className="w-6 h-6" />}
            </button>
            <div className="absolute left-10 top-1/2 -translate-y-1/2 hidden group-hover:flex items-center bg-black/85 backdrop-blur rounded-full px-2.5 py-1.5 w-28 z-30 shadow-xl shadow-black/50">
              <input
                type="range"
                min={0}
                max={100}
                value={Math.round(volume * 100)}
                onChange={(e) => {
                  const v = Number(e.target.value) / 100;
                  setVolume(v);
                  const el = videoRef.current;
                  if (el) {
                    el.volume = v;
                    el.muted = v === 0;
                  }
                  if (v > 0) setMutedState(false);
                }}
                className="w-full h-1.5 accent-blue-500 cursor-pointer"
                aria-label="Volume"
              />
            </div>
          </div>
        </div>
        {/* right action rail */}
        <div className="absolute right-3 bottom-24 z-20 flex flex-col items-center gap-6">
          <button onClick={() => onOpenProfile(post.user_id)}>
            <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-white bg-zinc-700 flex items-center justify-center">
              {post.profiles?.avatar_url
                ? <img src={post.profiles.avatar_url} alt="" className="w-full h-full object-cover" />
                : <span className="font-bold">{post.profiles?.username?.[0]?.toUpperCase()}</span>}
            </div>
          </button>
          <button onClick={() => onLike(post.id)} className="flex flex-col items-center">
            <Heart className={`w-8 h-8 ${liked ? "fill-red-500 text-red-500" : "text-white"}`} />
            <span className="text-xs mt-1">{likeCount}</span>
          </button>
          <button onClick={onOpenComments} className="flex flex-col items-center">
            <MessageCircle className={`w-8 h-8 ${isCommentsOpen ? "text-yellow-400" : "text-white"}`} />
            <span className="text-xs mt-1">{commentCount}</span>
          </button>
          <button className="flex flex-col items-center" onClick={() => { navigator.clipboard?.writeText(window.location.origin + "/user/" + post.user_id); }}>
            <Share2 className="w-8 h-8 text-white" />
          </button>
        </div>
        {/* nav arrows */}
        <div className="absolute right-2 top-1/2 -translate-y-1/2 z-20 hidden md:flex flex-col items-center gap-2">
          <button
            onClick={() => {
              const target = document.querySelectorAll("[data-spark-section]")[idx - 1] as HTMLElement | undefined;
              target?.scrollIntoView({ behavior: "smooth" });
            }}
            className="p-1 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur"
            aria-label="Previous"
          >
            <ChevronUp className="w-5 h-5 text-white" />
          </button>
          <button
            onClick={() => {
              const target = document.querySelectorAll("[data-spark-section]")[idx + 1] as HTMLElement | undefined;
              target?.scrollIntoView({ behavior: "smooth" });
            }}
            className="p-1 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur"
            aria-label="Next"
          >
            <ChevronDown className="w-5 h-5 text-white" />
          </button>
        </div>
        {/* comments panel */}
        {isCommentsOpen && (
          <div className="absolute inset-x-0 bottom-0 z-30 max-h-[45%] bg-zinc-900/95 backdrop-blur rounded-t-3xl border-t border-zinc-800 flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
              <p className="font-semibold text-sm">{commentCount} comment{commentCount === 1 ? "" : "s"}</p>
              <button onClick={onOpenComments} className="text-zinc-400 text-sm">Close</button>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-2 flex flex-col gap-3">
              {comments.length === 0 && <p className="text-zinc-500 text-sm text-center py-4">No comments yet — be the first!</p>}
              {comments.map((c) => (
                <div key={c.id} className="flex gap-2">
                  <div className="w-7 h-7 rounded-full bg-zinc-700 overflow-hidden shrink-0 flex items-center justify-center">
                    {c.profiles?.avatar_url
                      ? <img src={c.profiles.avatar_url} alt="" className="w-full h-full object-cover" />
                      : <span className="text-xs font-bold">{c.profiles?.username?.[0]?.toUpperCase()}</span>}
                  </div>
                  <p className="text-sm flex-1"><span className="font-semibold mr-2">{c.profiles?.username}</span>{c.content.split(/(@[a-zA-Z0-9_.-]+)/g).map((part: string, i: number) => part.startsWith("@") && part.length > 1 ? <span key={i} onClick={(e) => { e.stopPropagation(); goToProfile(part.slice(1)); }} className="text-blue-400">@{part.slice(1)}</span> : part)}</p>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2 px-4 py-3 border-t border-zinc-800">
              <input
                value={commentDraft}
                onChange={(e) => setCommentDraft(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && onAddComment()}
                placeholder="Add a comment…"
                className="flex-1 bg-zinc-800 rounded-full px-4 py-2 text-sm outline-none"
              />
              <button onClick={onAddComment} className="text-blue-500 font-semibold text-sm">Post</button>
            </div>
          </div>
        )}
        {/* bottom caption */}
        <div className="absolute bottom-6 left-4 right-20 z-10">
          <button onClick={() => onOpenProfile(post.user_id)} className="flex items-center gap-2 font-bold">
            @{post.profiles?.username}
            {post.profiles?.is_owner && <CrownIcon className="w-4 h-4" />}
            {post.profiles?.verified && !post.profiles?.is_owner && <VerifiedBadge className="w-4 h-4" />}
          </button>
          {post.caption && <p className="text-sm mt-1 line-clamp-2">{post.caption.split(/(@[a-zA-Z0-9_.-]+)/g).map((part: string, i: number) => part.startsWith("@") && part.length > 1 ? <span key={i} onClick={(e) => { e.stopPropagation(); goToProfile(part.slice(1)); }} className="text-blue-400">@{part.slice(1)}</span> : part)}</p>}
        </div>
      </div>
    </section>
  );
}

export default function SparksPage() {
  const supabase = createClient();
  const router = useRouter();
  const meData = readMe();
  const me = meData?.id ?? null;
  const [videos, setVideos] = useState<SparkPost[]>([]);
  const [muted, setMuted] = useState(true);
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  const [likeCounts, setLikeCounts] = useState<Record<string, number>>({});
  const [comments, setComments] = useState<Record<string, any[]>>({});
  const [showComments, setShowComments] = useState<string | null>(null);
  const [commentDraft, setCommentDraft] = useState("");

  async function goToProfile(username: string) {
    const { data } = await supabase.from("profiles").select("id").eq("username", username).maybeSingle();
    if (data?.id) router.push(`/user/${data.id}`);
  }

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("posts")
        .select("id, image_url, caption, user_id, created_at, profiles(username, avatar_url, verified, is_owner)")
        .eq("media_type", "video")
        .order("created_at", { ascending: false })
        .limit(50);
      const vids = (data as unknown as SparkPost[]) ?? [];
      setVideos(vids);
      const ids = vids.map((v) => v.id);
      if (ids.length) {
        const { data: likes } = await supabase.from("likes").select("post_id, user_id").in("post_id", ids);
        const lc: Record<string, number> = {};
        const mine = new Set<string>();
        (likes ?? []).forEach((l: any) => {
          lc[l.post_id] = (lc[l.post_id] ?? 0) + 1;
          if (l.user_id === me) mine.add(l.post_id);
        });
        setLikeCounts(lc);
        setLikedIds(mine);
        const { data: cs } = await supabase
          .from("comments")
          .select("id, post_id, content, created_at, user_id, profiles(username, avatar_url)")
          .in("post_id", ids)
          .order("created_at", { ascending: true });
        const map: Record<string, any[]> = {};
        (cs ?? []).forEach((c: any) => {
          map[c.post_id] = [...(map[c.post_id] ?? []), c];
        });
        setComments(map);
      }
    })();
  }, [me]);

  async function toggleLike(postId: string) {
    if (!me) return;
    if (likedIds.has(postId)) {
      await supabase.from("likes").delete().eq("post_id", postId).eq("user_id", me);
      setLikedIds((s) => { const n = new Set(s); n.delete(postId); return n; });
      setLikeCounts((c) => ({ ...c, [postId]: Math.max(0, (c[postId] ?? 1) - 1) }));
    } else {
      await supabase.from("likes").insert({ post_id: postId, user_id: me });
      setLikedIds((s) => new Set(s).add(postId));
      setLikeCounts((c) => ({ ...c, [postId]: (c[postId] ?? 0) + 1 }));
    }
  }

  async function addComment(postId: string, userId: string) {
    if (!commentDraft.trim() || !me) return;
    const { data } = await supabase
      .from("comments")
      .insert({ post_id: postId, user_id: me, content: commentDraft.trim() })
      .select("id, post_id, content, created_at, user_id, profiles(username, avatar_url)")
      .single();
    if (data) {
      setComments((prev) => ({ ...prev, [postId]: [...(prev[postId] ?? []), data] }));
      setCommentDraft("");
      const mentions = Array.from(new Set((commentDraft.match(/@([a-zA-Z0-9_.-]+)/g) ?? []).map((m) => m.slice(1))));
      for (const u of mentions) {
        const { data: mentioned } = await supabase.from("profiles").select("id").eq("username", u).maybeSingle();
        if (mentioned && mentioned.id !== me) {
          await supabase.from("notifications").insert({
            user_id: mentioned.id,
            actor_id: me,
            type: "mention",
            entity_id: postId,
            text: " mentioned you in a Spark comment",
          });
        }
      }
      if (userId !== me) {
        await supabase.from("notifications").insert({
          user_id: userId,
          actor_id: me,
          type: "comment",
          entity_id: postId,
          text: "commented on your video",
        });
      }
    }
  }

  return (
    <div className="h-screen bg-black text-white flex">
      <Sidebar />
      <div className="flex-1 h-screen overflow-y-scroll snap-y snap-mandatory scrollbar-none md:ml-[72px]">
        {videos.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-zinc-500 gap-3">
            <SparkLogo className="w-12 h-12 opacity-40" />
            <p>No Sparks yet — post a video!</p>
            <button onClick={() => router.push("/create")} className="text-blue-500 font-semibold">Create one</button>
          </div>
        )}
        {videos.map((v, idx) => (
          <SparkVideo
            key={v.id}
            idx={idx}
            post={v}
            liked={likedIds.has(v.id)}
            likeCount={likeCounts[v.id] ?? 0}
            commentCount={comments[v.id]?.length ?? 0}
            onLike={toggleLike}
            onOpenComments={() => setShowComments(showComments === v.id ? null : v.id)}
            comments={comments[v.id] ?? []}
            commentDraft={commentDraft}
            setCommentDraft={setCommentDraft}
            onAddComment={() => addComment(v.id, v.user_id)}
            muted={muted}
            setMutedState={(m: boolean) => setMuted(m)}
            onOpenProfile={(id) => router.push(`/user/${id}`)}
            isCommentsOpen={showComments === v.id}
            goToProfile={goToProfile}
          />
        ))}
      </div>
    </div>
  );
}
