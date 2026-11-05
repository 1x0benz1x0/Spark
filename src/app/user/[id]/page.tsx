"use client";
import { Suspense, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter, useParams } from "next/navigation";
import { Grid3x3, Bookmark, RefreshCw, User as UserIcon, Camera } from "lucide-react";
import { Sidebar } from "../../components/Sidebar";
import { readMe } from "@/lib/spark-auth";
import { PostDetailModal } from "../../components/PostDetailModal";
import { CrownIcon, VerifiedBadge, AdminBadge } from "../../components/Badges";

export default function UserPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-black text-white flex items-center justify-center">Loading…</div>}>
      <UserPageInner />
    </Suspense>
  );
}

function UserPageInner() {
  const supabase = createClient();
  const router = useRouter();
  const params = useParams();
  const targetId = params?.id as string;
  const meData = readMe();
  const me = meData?.id ?? null;

  const [profile, setProfile] = useState<{ username: string; full_name: string; avatar_url: string; bio: string; verified?: boolean; is_admin?: boolean; is_owner?: boolean } | null>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const [followers, setFollowers] = useState(0);
  const [following, setFollowing] = useState(0);
  const [isFollowing, setIsFollowing] = useState(false);
  const [activeTab, setActiveTab] = useState<"posts" | "saved" | "reposts" | "tagged">("posts");
  const [loading, setLoading] = useState(true);
  const [selectedPost, setSelectedPost] = useState<any>(null);
  const [myProfile, setMyProfile] = useState<{ is_admin?: boolean; is_owner?: boolean } | null>(null);

  useEffect(() => {
    if (!targetId) return;
    (async () => {
      if (me) {
        const { data: mp } = await supabase.from("profiles").select("is_admin, is_owner").eq("id", me).single();
        setMyProfile((mp as any) ?? null);
      }
      const { data: prof } = await supabase.from("profiles").select("username, full_name, avatar_url, bio, verified, is_admin, is_owner").eq("id", targetId).single();
      setProfile((prof as any) ?? null);
      const [{ count: fc }, { count: gc }, { data: ps }, { data: fl }] = await Promise.all([
        supabase.from("follows").select("*", { count: "exact", head: true }).eq("following_id", targetId),
        supabase.from("follows").select("*", { count: "exact", head: true }).eq("follower_id", targetId),
        supabase.from("posts").select("*").eq("user_id", targetId).order("created_at", { ascending: false }),
        me ? supabase.from("follows").select("id").eq("follower_id", me).eq("following_id", targetId).maybeSingle() : Promise.resolve({ data: null }),
      ]);
      setFollowers(fc ?? 0);
      setFollowing(gc ?? 0);
      setPosts(ps ?? []);
      setIsFollowing(!!fl);
      setLoading(false);
    })();
  }, [targetId, me]);

  async function toggleFollow() {
    if (!me) { router.push("/auth"); return; }
    if (isFollowing) {
      await supabase.from("follows").delete().eq("follower_id", me).eq("following_id", targetId);
      setIsFollowing(false);
      setFollowers((c) => Math.max(0, c - 1));
    } else {
      await supabase.from("follows").insert({ follower_id: me, following_id: targetId });
      setIsFollowing(true);
      setFollowers((c) => c + 1);
      if (targetId !== me) {
        await supabase.from("notifications").insert({
          user_id: targetId,
          actor_id: me,
          type: "follow",
          entity_id: targetId,
          text: "started following you",
        });
      }
    }
  }

  if (loading) return <div className="min-h-screen bg-black text-white flex items-center justify-center">Loading…</div>;
  if (!profile) return <div className="min-h-screen bg-black text-white flex items-center justify-center">User not found</div>;

  const isSelf = me === targetId;
  const username = profile.username;

  return (
    <div className="min-h-screen bg-black text-[#F5F5F5]">
      <Sidebar />
      <div className="md:pl-[72px]">
        <main className="max-w-[975px] mx-auto px-4 md:px-6 pt-4 md:pt-14 pb-20 md:pb-4">
          {/* Profile header */}
          <div className="flex flex-col md:flex-row items-center md:items-start gap-4 md:gap-20 mb-4 md:mb-6">
            {/* Profile picture */}
            <div className="shrink-0">
              <div className="w-[90px] h-[90px] md:w-[165px] md:h-[165px] rounded-full bg-zinc-800 overflow-hidden border border-zinc-700">
                {profile.avatar_url
                  ? <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
                  : <div className="w-full h-full flex items-center justify-center text-2xl md:text-5xl font-bold text-zinc-400">{username[0]?.toUpperCase()}</div>}
              </div>
            </div>

            {/* Profile info */}
            <div className="flex-1 w-full">
              {/* Username row */}
              <div className="flex items-center justify-center md:justify-start gap-2 mb-2 md:mb-4 flex-wrap">
                <h1 className="text-[18px] md:text-[26px] font-bold text-[#F5F5F5]">{username}</h1>
                {profile.is_owner && <CrownIcon className="w-5 h-5 md:w-6 md:h-6" />}
                {profile.verified && !profile.is_owner && <VerifiedBadge className="w-5 h-5 md:w-6 md:h-6" />}
                {profile.is_admin && !profile.is_owner && <AdminBadge className="w-5 h-5 md:w-6 md:h-6" />}
              </div>

              {/* Stats row */}
              <div className="flex justify-center md:justify-start gap-6 md:gap-10 mb-3 md:mb-4 text-[14px] md:text-[18px]">
                <span><b className="font-bold">{posts.length}</b> <span className="text-[#A8A8A8]">posts</span></span>
                <span><b className="font-bold">{followers}</b> <span className="text-[#A8A8A8]">followers</span></span>
                <span><b className="font-bold">{following}</b> <span className="text-[#A8A8A8]">following</span></span>
              </div>

              {/* Display name + bio */}
              <div className="mb-3 md:mb-4 text-center md:text-left">
                {profile.full_name && <p className="text-[14px] md:text-[18px] font-semibold text-[#F5F5F5]">{profile.full_name}</p>}
                {profile.bio && <p className="text-[14px] md:text-[18px] text-[#F5F5F5] whitespace-pre-line">{profile.bio}</p>}
              </div>

              {/* Action buttons */}
              <div className="flex flex-col sm:flex-row gap-[8px] md:gap-[10px] justify-center md:justify-start">
                {!isSelf ? (
                  <>
                    <button
                      onClick={toggleFollow}
                      className={`${isFollowing ? "bg-[#26292D] hover:bg-[#363A3F]" : "bg-blue-600 hover:bg-blue-700"} text-white font-bold text-[14px] md:text-[18px] rounded-[10px] w-full sm:w-[238px] h-[33px] flex items-center justify-center transition-colors`}
                    >
                      {isFollowing ? "Following" : "Follow"}
                    </button>
                    <button className="bg-[#26292D] hover:bg-[#363A3F] text-white font-bold text-[14px] md:text-[18px] rounded-[10px] w-full sm:w-[238px] h-[33px] flex items-center justify-center transition-colors">
                      Message
                    </button>
                  </>
                ) : (
                  <>
                    <button className="bg-[#26292D] hover:bg-[#363A3F] text-white font-bold text-[14px] md:text-[18px] rounded-[10px] w-full sm:w-[238px] h-[33px] flex items-center justify-center transition-colors">
                      Edit profile
                    </button>
                    <button className="bg-[#26292D] hover:bg-[#363A3F] text-white font-bold text-[14px] md:text-[18px] rounded-[10px] w-full sm:w-[238px] h-[33px] flex items-center justify-center transition-colors">
                      View archive
                    </button>
                  </>
                )}
              </div>

              {/* Admin controls (only visible to admins/owner) */}
              {(myProfile?.is_admin || myProfile?.is_owner) && !isSelf && (
                <div className="flex flex-wrap gap-2 mt-3 justify-center md:justify-start">
                  <button
                    onClick={async () => {
                      const newVal = !profile.verified;
                      await supabase.from("profiles").update({ verified: newVal }).eq("id", targetId);
                      setProfile((p) => p ? { ...p, verified: newVal } : p);
                    }}
                    className={`text-xs px-3 py-1 rounded-full ${profile.verified ? "bg-blue-600 text-white" : "bg-[#26292D] text-[#A8A8A8] hover:bg-[#363A3F]"}`}
                  >
                    {profile.verified ? "✓ Verified" : "Verify"}
                  </button>
                  {myProfile?.is_owner && (
                    <button
                      onClick={async () => {
                        const newVal = !profile.is_admin;
                        await supabase.from("profiles").update({ is_admin: newVal }).eq("id", targetId);
                        setProfile((p) => p ? { ...p, is_admin: newVal } : p);
                      }}
                      className={`text-xs px-3 py-1 rounded-full ${profile.is_admin ? "bg-purple-600 text-white" : "bg-[#26292D] text-[#A8A8A8] hover:bg-[#363A3F]"}`}
                    >
                      {profile.is_admin ? "★ Admin" : "Make Admin"}
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Navigation tabs */}
          <div className="border-t border-[#26292D] mt-4 md:mt-6">
            <div className="flex justify-around h-[48px] md:h-[58px] items-center">
              <button onClick={() => setActiveTab("posts")} className="flex items-center justify-center w-full h-full">
                <Grid3x3 className={`w-[18px] h-[18px] ${activeTab === "posts" ? "text-white" : "text-[#A8A8A8]"}`} />
              </button>
              <button onClick={() => setActiveTab("saved")} className="flex items-center justify-center w-full h-full">
                <Bookmark className={`w-[18px] h-[18px] ${activeTab === "saved" ? "text-white" : "text-[#A8A8A8]"}`} />
              </button>
              <button onClick={() => setActiveTab("reposts")} className="flex items-center justify-center w-full h-full">
                <RefreshCw className={`w-[18px] h-[18px] ${activeTab === "reposts" ? "text-white" : "text-[#A8A8A8]"}`} />
              </button>
              <button onClick={() => setActiveTab("tagged")} className="flex items-center justify-center w-full h-full">
                <UserIcon className={`w-[18px] h-[18px] ${activeTab === "tagged" ? "text-white" : "text-[#A8A8A8]"}`} />
              </button>
            </div>
          </div>

          {/* Tab content */}
          <div className="mt-4 md:mt-8">
            {activeTab === "posts" && (
              posts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 md:py-24 text-[#A8A8A8]">
                  <div className="w-[45px] h-[45px] rounded-full border border-[#A8A8A8] flex items-center justify-center mb-4">
                    <Camera className="w-7 h-7 text-[#A8A8A8]" />
                  </div>
                  <h2 className="text-[18px] md:text-[18px] font-bold text-[#F5F5F5] mb-2">No posts yet</h2>
                  <p className="text-[11px] md:text-[13px] text-[#F5F5F5]">When they share photos, they will appear here.</p>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-1">
                  {posts.map((p) => (
                    <div key={p.id} onClick={() => setSelectedPost(p)} className="relative aspect-square bg-zinc-900 overflow-hidden cursor-pointer hover:opacity-80 transition-opacity">
                      {p.media_type === "video" ? (
                        <video src={p.image_url} className="w-full h-full object-cover" muted preload="metadata" />
                      ) : p.media_type === "audio" ? (
                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-purple-900 to-blue-900">
                          <svg className="w-10 h-10 text-white/80" viewBox="0 0 24 24" fill="currentColor"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55c-2.21 0-4 1.79-4 4s1.79 4 4 4s4-1.79 4-4V7h4V3h-6z" /></svg>
                        </div>
                      ) : (
                        <img src={p.image_url} alt="" className="w-full h-full object-cover" />
                      )}
                    </div>
                  ))}
                </div>
              )
            )}
            {activeTab === "saved" && (
              <div className="flex flex-col items-center justify-center py-12 md:py-24 text-[#A8A8A8]">
                <Bookmark className="w-10 h-10 mb-3" />
                <p className="text-sm">You haven't saved anything yet.</p>
              </div>
            )}
            {activeTab === "reposts" && (
              <div className="flex flex-col items-center justify-center py-12 md:py-24 text-[#A8A8A8]">
                <RefreshCw className="w-10 h-10 mb-3" />
                <p className="text-sm">No reposts yet.</p>
              </div>
            )}
            {activeTab === "tagged" && (
              <div className="flex flex-col items-center justify-center py-12 md:py-24 text-[#A8A8A8]">
                <UserIcon className="w-10 h-10 mb-3" />
                <p className="text-sm">No photos of them yet.</p>
              </div>
            )}
          </div>
        </main>
      </div>

      {selectedPost && (
        <PostDetailModal
          post={selectedPost}
          currentUserId={me}
          onClose={() => setSelectedPost(null)}
          onChange={() => {
            setSelectedPost(null);
            if (targetId) {
              supabase.from("posts").select("*").eq("user_id", targetId).order("created_at", { ascending: false }).then(({ data }) => setPosts(data ?? []));
            }
          }}
        />
      )}
    </div>
  );
}



