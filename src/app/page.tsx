"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { readMe } from "@/lib/spark-auth";

function FollowButton({ me, target }: { me: string | null; target: string }) {
  const supabase = createClient();
  const [following, setFollowing] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!me) return;
    supabase.from("follows").select("id").eq("follower_id", me).eq("following_id", target).maybeSingle().then(({ data }) => setFollowing(!!data));
  }, [me, target]);

  async function toggle() {
    if (!me) return;
    setBusy(true);
    if (following) {
      await supabase.from("follows").delete().eq("follower_id", me).eq("following_id", target);
      setFollowing(false);
    } else {
      await supabase.from("follows").insert({ follower_id: me, following_id: target });
      setFollowing(true);
      // notify the followed user
      if (target !== me) {
        await supabase.from("notifications").insert({
          user_id: target,
          actor_id: me,
          type: "follow",
          entity_id: target,
          text: "started following you",
        });
      }
    }
    setBusy(false);
  }

  return (
    <button onClick={toggle} disabled={busy} className={`text-sm font-semibold ${following ? "text-zinc-400" : "text-blue-500"}`}>
      {following ? "Following" : "Follow"}
    </button>
  );
}
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Heart, User } from "lucide-react";
import { PostCard, Post } from "./components/PostCard";
import { Sidebar } from "./components/Sidebar";
import { CrownIcon, VerifiedBadge, AdminBadge } from "./components/Badges";
import { CreateModal } from "./components/CreateModal";
import { Stories } from "./components/Stories";

export default function HomePage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [myProfile, setMyProfile] = useState<{ username: string; avatar_url: string } | null>(null);
  const [me, setMe] = useState<string | null>(null);
  const [suggested, setSuggested] = useState<{ id: string; username: string; full_name: string; avatar_url: string; verified?: boolean; is_admin?: boolean; is_owner?: boolean }[]>([]);
  const supabase = createClient();
  const router = useRouter();

  async function loadPosts() {
    const { data } = await supabase
      .from("posts")
      .select("*, profiles(username, avatar_url, verified, is_admin, is_owner)")
      .order("created_at", { ascending: false });
    setPosts((data as any) ?? []);
  }

  useEffect(() => {
    (async () => {
      const meData = readMe();
      if (!meData) { router.push("/auth"); return; }
      setMe(meData.id);
      setCurrentUserId(meData.id);
      loadPosts();
      const { data: sp } = await supabase.from("profiles").select("id, username, full_name, avatar_url, verified, is_admin, is_owner").neq("id", meData.id).limit(5);
      setSuggested((sp as any) ?? []);
      const { data: prof } = await supabase.from("profiles").select("username, avatar_url").eq("id", meData.id).single();
      setMyProfile((prof as any) ?? null);
    })();
  }, []);

  if (!me) {
    return <div className="min-h-screen bg-black text-white flex items-center justify-center">Loading…</div>;
  }

  return (
    <div className="min-h-screen bg-black text-white max-md:pb-16">
      <Sidebar />

      {/* Mobile top bar */}
      <header className="md:hidden sticky top-0 z-10 border-b border-zinc-800 bg-black px-4 py-2 flex items-center justify-between">
        <h1 className="text-2xl font-bold" style={{ fontFamily: "cursive" }}>Spark</h1>
        <Link href="/profile" className="flex items-center gap-2">
          <span className="text-sm font-semibold">{myProfile?.username ?? readMe()?.username ?? ""}</span>
          <div className="w-7 h-7 rounded-full bg-zinc-700 overflow-hidden flex items-center justify-center">
            {myProfile?.avatar_url
              ? <img src={myProfile.avatar_url} alt="" className="w-full h-full object-cover" />
              : <User className="w-4 h-4 text-zinc-300" />}
          </div>
        </Link>
      </header>

      {/* Main */}
      <main className="md:ml-[72px] flex justify-center gap-16">
        <div className="w-full max-w-[470px]">
          {/* Stories */}
          <Stories />

          {/* Feed */}
          {posts.length === 0 && (
            <div className="text-center text-zinc-500 mt-16">
              <p className="text-lg mb-2">No posts yet</p>
              <p className="text-sm">Follow people or share your first photo.</p>
              <button onClick={() => setShowCreate(true)} className="inline-block mt-4 px-4 py-2 bg-blue-500 rounded-lg text-sm font-semibold text-white">Create post</button>
            </div>
          )}
          {posts.map((p) => (
            <PostCard key={p.id} post={p} currentUserId={currentUserId} onChange={loadPosts} />
          ))}
        </div>

        {/* Right sidebar */}
        <aside className="hidden lg:block w-[320px] pt-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-11 h-11 rounded-full bg-zinc-700 overflow-hidden">
              {myProfile?.avatar_url && <img src={myProfile.avatar_url} alt="" className="w-full h-full object-cover" />}
            </div>
            <div className="flex-1">
              <p className="font-semibold text-sm">{myProfile?.username ?? readMe()?.username ?? "You"}</p>
              <p className="text-zinc-500 text-sm">{myProfile?.username ?? readMe()?.username ?? ""}</p>
            </div>
            <Link href="/auth" className="text-blue-500 text-sm font-semibold">Switch</Link>
          </div>
          <div className="flex items-center justify-between mb-4">
            <p className="text-zinc-500 font-semibold">Suggested for you</p>
            <button className="text-xs font-semibold hover:text-zinc-400">See all</button>
          </div>
          <div className="flex flex-col gap-4">
            {suggested.map((s) => (
              <div key={s.id} className="flex items-center gap-3">
                <Link href={`/user/${s.id}`} className="w-11 h-11 rounded-full bg-zinc-700 overflow-hidden flex items-center justify-center shrink-0">
                  {s.avatar_url ? <img src={s.avatar_url} alt="" className="w-full h-full object-cover" /> : <span className="font-semibold text-sm">{s.username?.[0]?.toUpperCase()}</span>}
                </Link>
                <div className="flex-1 min-w-0">
                <Link href={`/user/${s.id}`} className="font-semibold text-sm truncate block flex items-center gap-1">
                  {s.username}
                  {s.is_owner && <CrownIcon className="w-3.5 h-3.5" />}
                  {s.verified && !s.is_owner && <VerifiedBadge className="w-3.5 h-3.5" />}
                </Link>
                  <p className="text-zinc-500 text-xs truncate">Suggested for you</p>
                </div>
                <FollowButton me={me} target={s.id} />
              </div>
            ))}
          </div>
        </aside>
      </main>

    {showCreate && <CreateModal onClose={() => { setShowCreate(false); loadPosts(); }} />}
    </div>
  );
}
