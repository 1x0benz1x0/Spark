"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { X, Heart, MessageCircle, UserPlus, Bell } from "lucide-react";
import { readMe } from "@/lib/spark-auth";
import { playPop } from "@/lib/sound";

type Notif = {
  id: string;
  user_id: string;
  actor_id: string | null;
  type: string;
  entity_id: string | null;
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

export function NotificationsPanel({
  open,
  onClose,
  me,
  notifications,
  setNotifications,
}: {
  open: boolean;
  onClose: () => void;
  me: string | null;
  notifications: Notif[];
  setNotifications: (n: Notif[] | ((p: Notif[]) => Notif[])) => void;
}) {
  const supabase = createClient();
  const router = useRouter();

  useEffect(() => {
    if (!open || !me) return;
    // mark all as read
    supabase.from("notifications").update({ read: true }).eq("user_id", me).eq("read", false).then(() => {
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    });
  }, [open, me]);

  async function handleClick(n: Notif) {
    if (n.type === "message") router.push("/messages");
    else if (n.type === "follow") router.push(`/user/${n.actor_id}`);
    else if (n.type === "like" || n.type === "comment") router.push("/");
    onClose();
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 flex justify-start" onClick={onClose}>
      <div
        className="w-full max-w-[360px] h-full bg-black border-r border-zinc-800 flex flex-col shadow-2xl animate-[slideInLeft_0.2s_ease-out] md:ml-[72px]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-4 border-b border-zinc-800">
          <h2 className="text-lg font-bold">Notifications</h2>
          <button onClick={onClose} className="p-1 hover:opacity-70"><X className="w-6 h-6" /></button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {notifications.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-zinc-500">
              <Bell className="w-10 h-10 mb-3" />
              <p className="text-sm">No notifications yet</p>
            </div>
          )}
          {notifications.map((n) => (
            <button
              key={n.id}
              onClick={() => handleClick(n)}
              className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-zinc-900 text-left border-b border-zinc-900 ${n.read ? "" : "bg-zinc-900/40"}`}
            >
              <div className="w-11 h-11 rounded-full bg-zinc-700 overflow-hidden shrink-0 flex items-center justify-center">
                {n.actor?.avatar_url
                  ? <img src={n.actor.avatar_url} alt="" className="w-full h-full object-cover" />
                  : <span className="font-semibold text-sm text-zinc-300">{n.actor?.username?.[0]?.toUpperCase() ?? "?"}</span>}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm">
                  <span className="font-semibold">{n.actor?.username ?? "Someone"}</span>{" "}
                  {n.text ?? (n.type === "like" ? "liked your post" : n.type === "comment" ? "commented on your post" : n.type === "follow" ? "started following you" : n.type === "message" ? "sent you a message" : "did something")}
                </p>
                <p className="text-xs text-zinc-500">{timeAgo(n.created_at)}</p>
              </div>
              {!n.read && <div className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// Helper to fetch actor profile
export async function enrichNotifications(supabase: any, notifs: Notif[]): Promise<Notif[]> {
  const ids = Array.from(new Set(notifs.map((n) => n.actor_id).filter(Boolean))) as string[];
  if (ids.length === 0) return notifs;
  const { data } = await supabase.from("profiles").select("id, username, avatar_url").in("id", ids);
  const map = new Map((data ?? []).map((p: any) => [p.id, p]));
  return notifs.map((n) => ({ ...n, actor: n.actor_id ? (map.get(n.actor_id) as Notif["actor"] ?? null) : null }));
}
