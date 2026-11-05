"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Heart, Trash2, X, RefreshCw, Bookmark, Languages } from "lucide-react";
import { CrownIcon, VerifiedBadge, AdminBadge } from "./Badges";
import { PostVideo } from "./PostVideo";
import { useI18n, type LangCode } from "@/lib/i18n";

export interface Post {
  id: string;
  image_url: string;
  caption: string;
  created_at: string;
  user_id: string;
  media_type?: string;
  poster_url?: string;
  profiles: { username: string; avatar_url: string; verified?: boolean; is_admin?: boolean; is_owner?: boolean } | null;
}

type Comment = { id: string; content: string; created_at: string; profiles: { username: string } | null };

function timeAgo(date: string) {
  const s = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

export function PostCard({ post, currentUserId, onChange }: { post: Post; currentUserId: string | null; onChange: () => void }) {
  const supabase = createClient();
  const { lang, translate, isTranslating } = useI18n();
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [saved, setSaved] = useState(false);
  const [reposted, setReposted] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [showComments, setShowComments] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [isAdminOrOwner, setIsAdminOrOwner] = useState(false);
  const [captionShown, setCaptionShown] = useState(false);
  const [captionTranslated, setCaptionTranslated] = useState("");
  const [commentShown, setCommentShown] = useState<Record<string, boolean>>({});
  const [commentTranslated, setCommentTranslated] = useState<Record<string, string>>({});
  const [commentBusy, setCommentBusy] = useState<Record<string, boolean>>({});

  async function goToProfile(username: string) {
    const { data } = await supabase.from("profiles").select("id").eq("username", username).maybeSingle();
    if (data?.id) window.location.href = `/user/${data.id}`;
  }

  async function translateCaption() {
    if (!post.caption) return;
    const src: LangCode = "en";
    const tgt: LangCode = lang === "es" ? "es" : "en";
    if (src === tgt) { setCaptionTranslated(post.caption); setCaptionShown(true); return; }
    try {
      const res = await translate(post.caption, src, tgt);
      setCaptionTranslated(res.text);
      setCaptionShown(true);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Translation failed");
    }
  }

  async function translateComment(id: string) {
    const c = comments.find((x) => x.id === id);
    if (!c) return;
    setCommentBusy((b) => ({ ...b, [id]: true }));
    try {
      const res = await translate(c.content, "en", lang === "es" ? "es" : "en");
      setCommentTranslated((s) => ({ ...s, [id]: res.text }));
      setCommentShown((s) => ({ ...s, [id]: true }));
    } catch (e) {
      alert(e instanceof Error ? e.message : "Translation failed");
    } finally {
      setCommentBusy((b) => {
        const next = { ...b };
        delete next[id];
        return next;
      });
    }
  }

  function renderMentions(text: string) {
    return text.split(/(@[a-zA-Z0-9_.-]+)/g).map((part: string, i: number) =>
      part.startsWith("@") && part.length > 1
        ? <span key={i} onClick={(e) => { e.stopPropagation(); goToProfile(part.slice(1)); }} className="text-blue-400 cursor-pointer">{part}</span>
        : part
    );
  }

  useEffect(() => {
    (async () => {
      const { count } = await supabase.from("likes").select("*", { count: "exact", head: true }).eq("post_id", post.id);
      setLikeCount(count ?? 0);
      if (currentUserId) {
        const { data } = await supabase.from("likes").select("id").eq("post_id", post.id).eq("user_id", currentUserId).maybeSingle();
        setLiked(!!data);
        const { data: sv } = await supabase.from("saved_posts").select("id").eq("post_id", post.id).eq("user_id", currentUserId).maybeSingle();
        setSaved(!!sv);
        const { data: rp } = await supabase.from("reposts").select("id").eq("post_id", post.id).eq("user_id", currentUserId).maybeSingle();
        setReposted(!!rp);
        const { data: prof } = await supabase.from("profiles").select("is_admin, is_owner").eq("id", currentUserId).single();
        setIsAdminOrOwner(!!(prof?.is_admin || prof?.is_owner));
      }
      const { data: cs } = await supabase.from("comments").select("id, content, created_at, profiles(username)").eq("post_id", post.id).order("created_at");
      setComments((cs as any) ?? []);
    })();
  }, [post.id, currentUserId]);

  async function toggleLike() {
    if (!currentUserId) return;
    if (liked) {
      setLiked(false);
      setLikeCount((c) => Math.max(0, c - 1));
      await supabase.from("likes").delete().eq("post_id", post.id).eq("user_id", currentUserId);
    } else {
      setLiked(true);
      setLikeCount((c) => c + 1);
      await supabase.from("likes").insert({ post_id: post.id, user_id: currentUserId });
      if (post.user_id && post.user_id !== currentUserId) {
        await supabase.from("notifications").insert({
          user_id: post.user_id,
          actor_id: currentUserId,
          type: "like",
          entity_id: post.id,
          text: "liked your post",
        });
      }
    }
  }

  async function toggleSave() {
    if (!currentUserId) return;
    if (saved) {
      setSaved(false);
      await supabase.from("saved_posts").delete().eq("post_id", post.id).eq("user_id", currentUserId);
    } else {
      setSaved(true);
      await supabase.from("saved_posts").insert({ post_id: post.id, user_id: currentUserId });
    }
  }

  async function toggleRepost() {
    if (!currentUserId) return;
    if (reposted) {
      setReposted(false);
      await supabase.from("reposts").delete().eq("post_id", post.id).eq("user_id", currentUserId);
    } else {
      setReposted(true);
      await supabase.from("reposts").insert({ post_id: post.id, user_id: currentUserId });
    }
  }

  async function addComment() {
    if (!newComment.trim() || !currentUserId) return;
    const { data, error } = await supabase.from("comments").insert({ post_id: post.id, user_id: currentUserId, content: newComment }).select("id, content, created_at, profiles(username)").single();
    if (!error && data) setComments((cs) => [...cs, data as any]);
    const mentions = Array.from(new Set((newComment.match(/@([a-zA-Z0-9_.-]+)/g) ?? []).map((m) => m.slice(1))));
    for (const u of mentions) {
      const { data: mentioned } = await supabase.from("profiles").select("id").eq("username", u).maybeSingle();
      if (mentioned && mentioned.id !== currentUserId) {
        await supabase.from("notifications").insert({
          user_id: mentioned.id,
          actor_id: currentUserId,
          type: "mention",
          entity_id: post.id,
          text: " mentioned you in a comment",
        });
      }
    }
    setNewComment("");
    if (post.user_id && post.user_id !== currentUserId) {
      await supabase.from("notifications").insert({
        user_id: post.user_id,
        actor_id: currentUserId,
        type: "comment",
        entity_id: post.id,
        text: "commented on your post",
      });
    }
  }

  async function deletePost() {
    await supabase.from("posts").delete().eq("id", post.id);
    onChange();
  }

  return (
    <article className="mb-6">
      <div className="flex items-center gap-3 px-1 pt-3 pb-2">
        <div className="w-9 h-9 rounded-full bg-zinc-700 overflow-hidden shrink-0">
          {post.profiles?.avatar_url && <img src={post.profiles.avatar_url} alt="" className="w-full h-full object-cover" />}
        </div>
        <div className="flex-1">
          <span className="font-semibold text-sm flex items-center gap-1">
            <span onClick={() => post.profiles?.username && goToProfile(post.profiles.username)} className="cursor-pointer hover:underline">{post.profiles?.username}</span>
            {post.profiles?.is_owner && <CrownIcon className="w-3.5 h-3.5" />}
            {post.profiles?.verified && !post.profiles?.is_owner && <VerifiedBadge className="w-3.5 h-3.5" />}
          </span>
          <span className="text-zinc-500 text-sm"> • {timeAgo(post.created_at)}</span>
        </div>
        {(currentUserId === post.user_id || isAdminOrOwner) && (
          <button onClick={deletePost} className="text-zinc-500 hover:text-red-400">
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>

      {post.media_type === "video" ? (
        <PostVideo src={post.image_url} poster={post.poster_url} />
      ) : post.media_type === "audio" ? (
        <div className="w-full bg-zinc-900 p-8 flex flex-col items-center gap-3">
          <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-purple-500 to-blue-500 flex items-center justify-center">
            <svg className="w-10 h-10 text-white" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55c-2.21 0-4 1.79-4 4s1.79 4 4 4s4-1.79 4-4V7h4V3h-6z" />
            </svg>
          </div>
          <audio src={post.image_url} controls className="w-64 max-w-full" />
        </div>
      ) : (
        <img src={post.image_url} alt="" className="w-full bg-zinc-900 object-contain max-h-[600px]" />
      )}

      <div className="flex gap-4 pt-3 px-1 items-center">
        <button onClick={toggleLike} className="hover:opacity-70">
          <Heart className={`w-6 h-6 ${liked ? "fill-red-500 text-red-500" : ""}`} />
        </button>
        <button onClick={() => setShowComments((v) => !v)} className="hover:opacity-70">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg>
        </button>
        <button onClick={toggleRepost} className="hover:opacity-70">
          <RefreshCw className={`w-6 h-6 ${reposted ? "text-green-500" : ""}`} />
        </button>
        <button onClick={toggleSave} className="ml-auto hover:opacity-70">
          <Bookmark className={`w-6 h-6 ${saved ? "fill-white text-white" : ""}`} />
        </button>
      </div>
      {likeCount > 0 && <p className="pt-2 px-1 text-sm font-semibold">{likeCount} like{likeCount === 1 ? "" : "s"}</p>}
      {post.caption && (
        <p className="px-1 pt-1 text-sm">
          <span className="font-semibold mr-2 inline-flex items-center gap-1">{post.profiles?.username}{post.profiles?.is_owner && <CrownIcon className="w-3.5 h-3.5" />}{post.profiles?.verified && !post.profiles?.is_owner && <VerifiedBadge className="w-3.5 h-3.5" />}</span>
          {renderMentions(captionShown ? captionTranslated : post.caption)}
          <button
            onClick={translateCaption}
            className="ml-2 inline-flex items-center gap-1 text-[11px] text-zinc-500 hover:text-zinc-300 align-middle"
            title="Translate caption"
          >
            <Languages className="w-3.5 h-3.5" />
            {isTranslating(post.caption) ? "..." : captionShown ? "Original" : "Translate"}
          </button>
        </p>
      )}
      {comments.length > 0 && !showComments && (
        <button onClick={() => setShowComments(true)} className="px-1 pt-1 text-sm text-zinc-500">
          View all {comments.length} comments
        </button>
      )}
      {showComments && (
        <div className="pt-2">
          <div className="flex justify-end">
            <button onClick={() => setShowComments(false)}><X className="w-4 h-4 text-zinc-500" /></button>
          </div>
          {comments.map((c) => (
            <p key={c.id} className="text-sm py-0.5 flex items-start gap-1">
              <span className="font-semibold mr-2">{c.profiles?.username}</span>
              <span className="flex-1">{renderMentions(commentShown[c.id] ? commentTranslated[c.id] ?? c.content : c.content)}</span>
              <button
                onClick={() => translateComment(c.id)}
                className="shrink-0 inline-flex items-center gap-1 text-[11px] text-zinc-500 hover:text-zinc-300 mt-[2px]"
                title="Translate comment"
              >
                <Languages className="w-3.5 h-3.5" />
                {commentBusy[c.id] ? "..." : commentShown[c.id] ? "Original" : "Translate"}
              </button>
            </p>
          ))}
          {currentUserId && (
            <div className="flex gap-2 pt-2">
              <input
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addComment()}
                placeholder="Add a comment…"
                className="flex-1 bg-transparent border-t border-zinc-800 py-2 text-sm outline-none"
              />
              <button onClick={addComment} className="text-blue-500 text-sm font-semibold">Post</button>
            </div>
          )}
        </div>
      )}
    </article>
  );
}
