"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { Search as SearchIcon, User as UserIcon, X } from "lucide-react";
import { Sidebar } from "../components/Sidebar";
import { readMe } from "@/lib/spark-auth";

type Profile = { id: string; username: string; full_name: string; avatar_url: string };

export default function ExplorePage() {
  const supabase = createClient();
  const router = useRouter();
  const meData = readMe();
  const me = meData?.id ?? null;
  const [query, setQuery] = useState("");
  const [users, setUsers] = useState<Profile[]>([]);
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    // load all users initially
    (async () => {
      const { data } = await supabase.from("profiles").select("id, username, full_name, avatar_url").limit(30);
      setUsers((data as any) ?? []);
    })();
  }, []);

  async function doSearch(q: string) {
    setQuery(q);
    if (!q.trim()) {
      const { data } = await supabase.from("profiles").select("id, username, full_name, avatar_url").limit(30);
      setUsers((data as any) ?? []);
      setPosts([]);
      setSearched(false);
      return;
    }
    setLoading(true);
    setSearched(true);
    const [{ data: us }, { data: ps }] = await Promise.all([
      supabase.from("profiles").select("id, username, full_name, avatar_url").or(`username.ilike.%${q.trim()}%,full_name.ilike.%${q.trim()}%`).limit(20),
      supabase.from("posts").select("id, image_url, media_type, caption, user_id, profiles(username, avatar_url)").ilike("caption", `%${q.trim()}%`).limit(20),
    ]);
    setUsers((us as any) ?? []);
    setPosts((ps as any) ?? []);
    setLoading(false);
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <Sidebar />
      <main className="md:ml-[72px] max-w-[935px] mx-auto px-4 pt-6 pb-16">
        {/* Search bar */}
        <div className="flex items-center gap-3 bg-zinc-900 rounded-xl px-4 py-3 mb-6 border border-zinc-800">
          <SearchIcon className="w-5 h-5 text-zinc-500" />
          <input
            value={query}
            onChange={(e) => doSearch(e.target.value)}
            placeholder="Search users or posts..."
            className="bg-transparent outline-none text-sm flex-1 text-white placeholder-zinc-500"
          />
          {query && (
            <button onClick={() => doSearch("")} className="text-zinc-500 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {loading && <p className="text-center text-zinc-500 text-sm py-8">Searching…</p>}

        {/* Users */}
        {users.length > 0 && (
          <div className="mb-8">
            <h2 className="text-sm font-semibold text-zinc-400 mb-3">{searched ? "People" : "Suggested"}</h2>
            <div className="flex flex-col gap-2">
              {users.map((u) => (
                <button
                  key={u.id}
                  onClick={() => router.push(`/user/${u.id}`)}
                  className="flex items-center gap-3 p-3 rounded-xl hover:bg-zinc-900 transition text-left"
                >
                  <div className="w-11 h-11 rounded-full bg-zinc-700 overflow-hidden flex items-center justify-center shrink-0">
                    {u.avatar_url
                      ? <img src={u.avatar_url} alt="" className="w-full h-full object-cover" />
                      : <span className="font-semibold text-sm text-zinc-300">{u.username?.[0]?.toUpperCase()}</span>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate">{u.username}</p>
                    <p className="text-zinc-500 text-xs truncate">{u.full_name || "User"}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Posts */}
        {posts.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold text-zinc-400 mb-3">Posts</h2>
            <div className="grid grid-cols-3 gap-1">
              {posts.map((p) => (
                <div key={p.id} className="relative aspect-square bg-zinc-900 overflow-hidden">
                  {p.media_type === "video" ? (
                    <video src={p.image_url} className="w-full h-full object-cover" muted preload="metadata" />
                  ) : p.media_type === "audio" ? (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-purple-900 to-blue-900">
                      <svg className="w-10 h-10 text-white/80" viewBox="0 0 24 24" fill="currentColor"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55c-2.21 0-4 1.79-4 4s1.79 4 4 4s4-1.79 4-4V7h4V3h-6z" /></svg>
                    </div>
                  ) : (
                    <img src={p.image_url} alt="" className="w-full h-full object-cover" />
                  )}
                  <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/60 to-transparent">
                    <p className="text-xs text-white truncate">{p.profiles?.username}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {searched && users.length === 0 && posts.length === 0 && !loading && (
          <div className="flex flex-col items-center py-20 text-zinc-500">
            <SearchIcon className="w-10 h-10 mb-3" />
            <p className="text-sm">No results found for "{query}"</p>
          </div>
        )}
      </main>
    </div>
  );
}
