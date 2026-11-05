"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { Bell, Heart, MessageCircle, UserPlus, Trash2 } from "lucide-react";
import { Sidebar } from "../components/Sidebar";
import { readMe } from "@/lib/spark-auth";
import { enrichNotifications } from "../components/NotificationsPanel";

type Notif = {
  id: string;
  type: string;
  actor_id: string | null;
  text: string | null;
  read: boolean;
  created_at: string;
  actor?: { username: string; avatar_url: string } | null;
};

function timeAgo(date: string) {
  const s = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

export default function NotificationsPage() {
  const supabase = createClient();
  const router = useRouter();
  const meData = readMe();
  const me = meData?.id ?? null;
  const [notifications, setNotifications] = useState<Notif[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!me) { router.push("/auth"); return; }
    (async () => {
      const { data } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", me)
        .order("created_at", { ascending: false })
        .limit(100);
      const enriched = await enrichNotifications(supabase, (data ?? []) as any[]);
      setNotifications(enriched as any);
      setLoading(false);
      // mark read on open
      await supabase.from("notifications").update({ read: true }).eq("user_id", me).eq("read", false);
    })();
  }, [me]);

  async function clearAll() {
    if (!me) return;
    await supabase.from("notifications").delete().eq("user_id", me);
    setNotifications([]);
  }

  if (loading) return <div className="min-h-screen bg-black text-white flex items-center justify-center">Loading…</div>;

  return (
    <div className="min-h-screen bg-black text-white">
      <Sidebar />
      <main className="md:ml-[72px] max-w-[935px] mx-auto px-4 pt-4 md:pt-9 pb-20">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-3 mb-4">
          <h1 className="text-2xl font-bold flex items-center gap-2"><Bell className="w-6 h-6" /> Notifications</h1>
          {notifications.length > 0 && (
            <button onClick={clearAll} className="text-xs text-zinc-500 hover:text-red-400 flex items-center gap-1">
              <Trash2 className="w-4 h-4" /> Clear all
            </button>
          )}
        </div>
        {notifications.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 text-zinc-500">
            <Bell className="w-10 h-10 mb-3" />
            <p>No notifications yet</p>
          </div>
        )}
        {notifications.map((n) => (
          <button
            key={n.id}
            onClick={() => {
              if (n.type === "message") router.push("/messages");
              else if (n.actor_id) router.push(`/user/${n.actor_id}`);
            }}
            className="w-full flex items-center gap-3 p-3 hover:bg-zinc-900 rounded-lg text-left border-b border-zinc-900"
          >
            <div className="w-12 h-12 rounded-full bg-zinc-700 overflow-hidden flex items-center justify-center shrink-0">
              {n.actor?.avatar_url
                ? <img src={n.actor.avatar_url} alt="" className="w-full h-full object-cover" />
                : <span className="text-lg font-bold text-zinc-300">{n.actor?.username?.[0]?.toUpperCase() ?? "?"}</span>}
            </div>
            <div className="flex-1">
              <p className="text-sm">
                <span className="font-semibold">{n.actor?.username ?? "Someone"}</span>{" "}
                {n.text ?? (n.type === "like" ? "liked your post" : n.type === "comment" ? "commented on your post" : n.type === "follow" ? "started following you" : "did something")}
              </p>
              <p className="text-xs text-zinc-500">{timeAgo(n.created_at)}</p>
            </div>
          </button>
        ))}
      </main>
    </div>
  );
}
