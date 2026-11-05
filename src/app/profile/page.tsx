"use client";
import { useEffect, useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { SparkLogo } from "../components/SparkLogo";
import { Grid3x3, Bookmark, RefreshCw, User as UserIcon, Camera } from "lucide-react";
import { Sidebar } from "../components/Sidebar";
import { CreateModal } from "../components/CreateModal";
import { PostDetailModal } from "../components/PostDetailModal";
import { EditProfileModal } from "../components/EditProfileModal";
import { readMe } from "@/lib/spark-auth";
import { CrownIcon, VerifiedBadge, AdminBadge } from "../components/Badges";

export default function ProfilePage() {
  const supabase = createClient();
  const router = useRouter();
  const meData = readMe();
  const me = meData?.id ?? null;

  const [profile, setProfile] = useState<{ username: string; full_name: string; avatar_url: string; bio: string; verified?: boolean; is_admin?: boolean; is_owner?: boolean } | null>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const [savedPosts, setSavedPosts] = useState<any[]>([]);
  const [repostedPosts, setRepostedPosts] = useState<any[]>([]);
  const [followers, setFollowers] = useState(0);
  const [following, setFollowing] = useState(0);
  const [activeTab, setActiveTab] = useState<"posts" | "saved" | "reposts" | "tagged">("posts");
  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [selectedPost, setSelectedPost] = useState<any>(null);
  const [mounted, setMounted] = useState(false);
  const storyRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setMounted(true); }, []);

  const username = profile?.username ?? meData?.username ?? "user";

  async function loadProfile() {
    if (!me) return;
    const { data: prof } = await supabase.from("profiles").select("username, full_name, avatar_url, bio, verified, is_admin, is_owner").eq("id", me).single();
    if (!prof) {
      await supabase.from("profiles").insert({ id: me, username: meData?.username ?? "user" });
      setProfile({ username: meData?.username ?? "user", full_name: "", avatar_url: "", bio: "" });
      return;
    }
    setProfile((prof as any) ?? null);
  }

  async function loadSavedAndReposts() {
    if (!me) return;
    const [{ data: sv }, { data: rp }] = await Promise.all([
      supabase.from("saved_posts").select("post_id, posts(*)").eq("user_id", me).order("created_at", { ascending: false }),
      supabase.from("reposts").select("post_id, posts(*)").eq("user_id", me).order("created_at", { ascending: false }),
    ]);
    setSavedPosts(((sv ?? []) as any[]).map((r) => r.posts).filter(Boolean));
    setRepostedPosts(((rp ?? []) as any[]).map((r) => r.posts).filter(Boolean));
  }

  useEffect(() => {
    if (!me) return;
    (async () => {
      await loadProfile();
      const [{ count: fc }, { count: gc }, { data: ps }] = await Promise.all([
        supabase.from("follows").select("*", { count: "exact", head: true }).eq("following_id", me),
        supabase.from("follows").select("*", { count: "exact", head: true }).eq("follower_id", me),
        supabase.from("posts").select("*").eq("user_id", me).order("created_at", { ascending: false }),
      ]);
      setFollowers(fc ?? 0);
      setFollowing(gc ?? 0);
      setPosts(ps ?? []);
      await loadSavedAndReposts();
    })();
  }, [me]);

  if (!mounted) return <div className="min-h-screen bg-black" />;

  return (
    <div className="min-h-screen bg-black text-white">
      <Sidebar />

      {/* Mobile top bar */}
      <div className="md:hidden sticky top-0 z-10 bg-black border-b border-zinc-800 px-4 py-3 flex items-center justify-between">
        <span className="font-bold text-lg">{username}</span>
        <SparkLogo className="w-6 h-6" />
      </div>

      <div className="md:pl-[72px]">
        <main className="max-w-[975px] mx-auto px-4 md:px-6 pt-4 md:pt-10 pb-20 md:pb-4">
          {/* Profile header */}
          <div className="flex flex-col md:flex-row items-center md:items-start gap-4 md:gap-20 mb-4 md:mb-6">
            <div className="shrink-0">
              <div className="w-[90px] h-[90px] md:w-[165px] md:h-[165px] rounded-full bg-zinc-800 overflow-hidden border border-zinc-700">
                {profile?.avatar_url
                  ? <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
                  : <div className="w-full h-full flex items-center justify-center text-2xl md:text-5xl font-bold text-zinc-400">{username[0]?.toUpperCase()}</div>}
              </div>
            </div>
            <div className="flex-1 w-full">
              <div className="flex items-center justify-center md:justify-start gap-2 mb-2 md:mb-4 flex-wrap">
                <h1 className="text-[18px] md:text-[26px] font-bold text-[#F5F5F5]">{username}</h1>
                {profile?.is_owner && <CrownIcon className="w-5 h-5 md:w-6 md:h-6" />}
                {profile?.verified && !profile?.is_owner && <VerifiedBadge className="w-5 h-5 md:w-6 md:h-6" />}
                {profile?.is_admin && !profile?.is_owner && <AdminBadge className="w-5 h-5 md:w-6 md:h-6" />}
              </div>
              <div className="flex justify-center md:justify-start gap-6 md:gap-10 mb-3 md:mb-4 text-[14px] md:text-[18px]">
                <span><b className="font-bold">{posts.length}</b> <span className="text-[#A8A8A8]">posts</span></span>
                <span><b className="font-bold">{followers}</b> <span className="text-[#A8A8A8]">followers</span></span>
                <span><b className="font-bold">{following}</b> <span className="text-[#A8A8A8]">following</span></span>
              </div>
              <div className="mb-3 md:mb-4 text-center md:text-left">
                {profile?.full_name && <p className="text-[14px] md:text-[18px] font-semibold text-[#F5F5F5]">{profile.full_name}</p>}
                {profile?.bio && <p className="text-[14px] md:text-[18px] text-[#F5F5F5] whitespace-pre-line">{profile.bio}</p>}
              </div>
              <div className="flex flex-col sm:flex-row gap-[8px] md:gap-[10px] justify-center md:justify-start">
                <button
                  onClick={() => setShowEdit(true)}
                  className="bg-[#26292D] hover:bg-[#363A3F] text-white font-bold text-[14px] md:text-[18px] rounded-[10px] w-full sm:w-[280px] h-[33px] md:h-[40px] flex items-center justify-center transition-colors"
                >
                  Edit profile
                </button>
                <button
                  onClick={() => setActiveTab("saved")}
                  className="bg-[#26292D] hover:bg-[#363A3F] text-white font-bold text-[14px] md:text-[18px] rounded-[10px] w-full sm:w-[238px] h-[33px] md:h-[40px] flex items-center justify-center transition-colors"
                >
                  View archive
                </button>
              </div>
            </div>
          </div>

          {/* Story highlight */}
          <div className="mb-4 md:mb-8">
            <div className="flex flex-col items-center gap-1">
              <button
                onClick={() => storyRef.current?.click()}
                className="w-[56px] h-[56px] md:w-[76px] md:h-[76px] rounded-full bg-[#1a1d21] border border-[#26292D] flex items-center justify-center cursor-pointer hover:bg-[#26292D] transition-colors"
              >
                <svg className="w-5 h-5 md:w-7 md:h-7 text-[#A8A8A8]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              </button>
              <span className="text-[11px] md:text-[14px] text-[#F5F5F5]">New</span>
              <input ref={storyRef} type="file" accept="image/*,video/*,audio/*" className="hidden"
                onChange={(e) => e.target.files?.[0] && (async () => {
                  const file = e.target.files![0];
                  if (!me) return;
                  const path = `${me}/story-${Date.now()}-${file.name}`;
                  const { error } = await supabase.storage.from("posts").upload(path, file);
                  if (error) { alert(error.message); return; }
                  const { data: { publicUrl } } = supabase.storage.from("posts").getPublicUrl(path);
                  const media_type = file.type.startsWith("video") ? "video" : file.type.startsWith("audio") ? "audio" : "image";
                  await supabase.from("stories").insert({ user_id: me, image_url: publicUrl, media_type });
                })()} />
            </div>
          </div>

          {/* Navigation tabs */}
          <div className="border-t border-[#26292D]">
            <div className="flex justify-around h-[48px] md:h-[64px] items-center">
              <button onClick={() => setActiveTab("posts")} className="flex items-center justify-center w-full h-full">
                <Grid3x3 className={`w-[18px] h-[18px] md:w-6 md:h-6 ${activeTab === "posts" ? "text-white" : "text-[#A8A8A8]"}`} />
              </button>
              <button onClick={() => setActiveTab("saved")} className="flex items-center justify-center w-full h-full">
                <Bookmark className={`w-[18px] h-[18px] md:w-6 md:h-6 ${activeTab === "saved" ? "text-white" : "text-[#A8A8A8]"}`} />
              </button>
              <button onClick={() => setActiveTab("reposts")} className="flex items-center justify-center w-full h-full">
                <RefreshCw className={`w-[18px] h-[18px] md:w-6 md:h-6 ${activeTab === "reposts" ? "text-white" : "text-[#A8A8A8]"}`} />
              </button>
              <button onClick={() => setActiveTab("tagged")} className="flex items-center justify-center w-full h-full">
                <UserIcon className={`w-[18px] h-[18px] md:w-6 md:h-6 ${activeTab === "tagged" ? "text-white" : "text-[#A8A8A8]"}`} />
              </button>
            </div>
          </div>

          {/* Tab content */}
          <div className="mt-4 md:mt-8">
            {activeTab === "posts" && (
              posts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 md:py-24">
                  <div className="w-[45px] h-[45px] md:w-[50px] md:h-[50px] rounded-full border border-[#A8A8A8] flex items-center justify-center mb-4">
                    <Camera className="w-6 h-6 md:w-7 md:h-7 text-[#A8A8A8]" />
                  </div>
                  <h2 className="text-[18px] md:text-[28px] font-bold text-[#F5F5F5] mb-2">Share Photos</h2>
                  <p className="text-[11px] md:text-[13px] text-[#F5F5F5]">When you share photos, they will appear on your profile.</p>
                  <p onClick={() => setShowCreate(true)} className="text-[11px] md:text-[13px] text-[#4C9AFF] mt-2 cursor-pointer hover:underline">Share your first photo</p>
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
              savedPosts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 md:py-24 text-[#A8A8A8]">
                  <Bookmark className="w-10 h-10 mb-3" />
                  <p className="text-sm">You haven't saved anything yet.</p>
                  <p className="text-xs mt-1">Save posts and they'll show up here.</p>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-1">
                  {savedPosts.map((p) => (
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
            {activeTab === "reposts" && (
              repostedPosts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 md:py-24 text-[#A8A8A8]">
                  <RefreshCw className="w-10 h-10 mb-3" />
                  <p className="text-sm">No reposts yet.</p>
                  <p className="text-xs mt-1">Repost posts and they'll show up here.</p>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-1">
                  {repostedPosts.map((p) => (
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
            {activeTab === "tagged" && (
              <div className="flex flex-col items-center justify-center py-12 md:py-24 text-[#A8A8A8]">
                <UserIcon className="w-10 h-10 mb-3" />
                <p className="text-sm">No photos of you yet.</p>
              </div>
            )}
          </div>
        </main>
      </div>

      {showCreate && <CreateModal onClose={() => { setShowCreate(false); router.refresh(); }} />}

      {selectedPost && (
        <PostDetailModal
          post={selectedPost}
          currentUserId={me}
          onClose={() => setSelectedPost(null)}
          onChange={async () => {
            setSelectedPost(null);
            if (me) {
              supabase.from("posts").select("*").eq("user_id", me).order("created_at", { ascending: false }).then(({ data }) => setPosts(data ?? []));
              await loadSavedAndReposts();
            }
          }}
        />
      )}

      {showEdit && me && (
        <EditProfileModal
          onClose={() => setShowEdit(false)}
          profile={profile}
          me={me}
          onSaved={loadProfile}
        />
      )}
    </div>
  );
}
