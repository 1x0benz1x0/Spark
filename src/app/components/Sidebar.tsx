"use client";
import { useEffect, useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Home, Search, Heart, PlusSquare, User, MessageCircle, Zap, LogOut } from "lucide-react";
import { NotificationsPanel, enrichNotifications } from "./NotificationsPanel";
import { readMe, signOutMe } from "@/lib/spark-auth";
import { playPop } from "@/lib/sound";
import { SparkLogo } from "./SparkLogo";

export function Sidebar() {
  const supabase = createClient();
  const pathname = usePathname();
  const router = useRouter();
  const [avatar, setAvatar] = useState<string | null>(null);
  const [showNotifs, setShowNotifs] = useState(false);
  const [showLogoutMenu, setShowLogoutMenu] = useState(false);
  const [me, setMe] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unread, setUnread] = useState(0);
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  const channelRef = useRef<any>(null);
  const meInfo = readMe();

  useEffect(() => {
    const meData = readMe();
    if (!meData) return;
    setMe(meData.id);
    supabase.from("profiles").select("avatar_url").eq("id", meData.id).single().then(({ data }) => {
      setAvatar(data?.avatar_url ?? null);
    });
    supabase
      .from("notifications")
      .select("*")
      .eq("user_id", meData.id)
      .order("created_at", { ascending: false })
      .limit(50)
      .then(async ({ data }) => {
        const enriched = await enrichNotifications(supabase, (data ?? []) as any);
        setNotifications(enriched);
        setUnread((data ?? []).filter((n: any) => !n.read).length);
      });
  }, []);

  useEffect(() => {
    if (!me) return;
    const chan = supabase
      .channel(`notifs:${me}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${me}` }, async (payload: any) => {
        const n = payload.new;
        const enriched = await enrichNotifications(supabase, [n]);
        setNotifications((prev) => [enriched[0], ...prev]);
        setUnread((u) => u + 1);
        playPop();
      })
      .subscribe();
    channelRef.current = chan;
    return () => { supabase.removeChannel(chan); };
  }, [me]);

  const navItems = [
    { key: "home", icon: <Home className="w-6 h-6" />, path: "/", label: "Home" },
    { key: "search", icon: <Search className="w-6 h-6" />, path: "/explore", label: "Search" },
    { key: "create", icon: <PlusSquare className="w-6 h-6" />, path: "/create", label: "Create" },
    { key: "messages", icon: <MessageCircle className="w-6 h-6" />, path: "/messages", label: "Messages" },
    { key: "sparks", icon: <Zap className="w-6 h-6" />, path: "/sparks", label: "Sparks" },
    { key: "notifications", icon: <Heart className="w-6 h-6" />, path: null, label: "Notifications", action: () => setShowNotifs(true) },
  ];

  function handleLogout() {
    signOutMe();
    router.push("/auth");
  }

  return (
    <>
      {/* Desktop left sidebar */}
      <aside className="fixed left-0 top-0 bottom-0 w-[72px] border-r border-zinc-800 flex flex-col z-20 max-md:hidden bg-black overflow-visible">
        <Link href="/" className="self-center pt-6 group">
          <SparkLogo className="w-6 h-6 transition-transform duration-200 group-hover:scale-110" />
        </Link>

        <div className="flex-1 flex flex-col items-center justify-center gap-6">
          {navItems.map((item) => (
            <div
              key={item.key}
              className="relative"
              onMouseEnter={() => setHoveredItem(item.key)}
              onMouseLeave={() => setHoveredItem(null)}
            >
              {item.path ? (
                <Link
                  href={item.path}
                  className={`p-2 rounded-xl transition-all duration-200 flex items-center justify-center ${pathname === item.path ? "text-white bg-zinc-800 scale-110" : "text-zinc-400 hover:text-white hover:bg-zinc-900 hover:scale-110"}`}
                >
                  {item.icon}
                </Link>
              ) : (
                <button
                  onClick={item.action}
                  className="p-2 rounded-xl transition-all duration-200 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-900 hover:scale-110 relative"
                >
                  {item.icon}
                  {item.key === "notifications" && unread > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center animate-pulse">
                      {unread > 9 ? "9+" : unread}
                    </span>
                  )}
                </button>
              )}
              <div
                className={`absolute left-full top-1/2 -translate-y-1/2 ml-3 px-3 py-1.5 bg-zinc-800 text-white text-sm rounded-lg whitespace-nowrap pointer-events-none transition-all duration-200 z-50 ${hoveredItem === item.key ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-2"}`}
              >
                {item.label}
                <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-zinc-800" />
              </div>
            </div>
          ))}
        </div>

        <div className="self-center pb-6">
          <Link href="/profile" title="Profile" className="block">
            <div className={`w-9 h-9 rounded-full overflow-hidden flex items-center justify-center transition-transform duration-200 hover:scale-110 ${avatar ? "ring-1 ring-zinc-600" : "bg-zinc-700 text-zinc-200"}`}>
              {avatar
                ? <img src={avatar} alt="" className="w-full h-full object-cover" />
                : <User className="w-5 h-5" />}
            </div>
          </Link>
        </div>
      </aside>

      {/* Mobile top-left avatar + sign-out dropdown */}
      <div className="md:hidden fixed top-4 left-4 z-30">
        <div className="relative">
          <button
            onClick={() => setShowLogoutMenu((v) => !v)}
            className="w-9 h-9 rounded-full overflow-hidden bg-zinc-800 border border-zinc-700 flex items-center justify-center"
          >
            {avatar
              ? <img src={avatar} alt="" className="w-full h-full object-cover" />
              : <User className="w-5 h-5" />}
          </button>
          {meInfo ? (
            <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-black" />
          ) : (
            <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-red-500 rounded-full border-2 border-black" />
          )}
          {showLogoutMenu && (
            <div className="absolute top-full left-0 mt-2 w-44 bg-zinc-900 border border-zinc-800 rounded-xl shadow-xl py-2 z-50">
              <div className="px-4 py-2 border-b border-zinc-800">
                <p className="font-semibold text-sm">{meInfo?.username ?? "Guest"}</p>
                <p className="text-xs text-zinc-500">Signed in</p>
              </div>
              <button onClick={handleLogout} className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-400 hover:bg-zinc-800 text-left">
                <LogOut className="w-4 h-4" /> Sign out
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Desktop top-right sign-out */}
      <div className="hidden md:block fixed top-4 right-4 z-30">
        <div className="relative">
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-[#26292D] hover:bg-[#363A3F] text-white text-sm font-semibold transition-colors"
          >
            <LogOut className="w-4 h-4" /> Sign out
          </button>
        </div>
      </div>

      {/* Mobile bottom nav — custom floating pill */}
      <nav className="md:hidden fixed bottom-4 left-1/2 -translate-x-1/2 z-30 w-[min(92vw,420px)]">
        <div className="flex items-center justify-around bg-zinc-900/90 backdrop-blur-xl border border-zinc-800 rounded-full px-4 py-2.5 shadow-2xl shadow-black/50">
          {[
            { href: "/", icon: <Home className="w-6 h-6" />, key: "home" },
            { href: "/explore", icon: <Search className="w-6 h-6" />, key: "explore" },
            { key: "create" },
            { href: "/notifications", icon: <Heart className="w-6 h-6" />, key: "notifications" },
            { href: "/profile", icon: <User className="w-6 h-6" />, key: "profile" },
          ].map((item) => {
            if (item.key === "create") {
              return (
                <Link
                  key="create"
                  href="/create"
                  className="w-12 h-12 rounded-full bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-600 flex items-center justify-center active:scale-90 transition-transform"
                  aria-label="Create post"
                >
                  <PlusSquare className="w-6 h-6 text-white" />
                </Link>
              );
            }
            const active = pathname === item.href;
            return (
              <Link
                key={item.key}
                href={item.href!}
                className={`relative p-2 rounded-full transition-all duration-200 active:scale-90 ${active ? "text-white" : "text-zinc-500 hover:text-white"}`}
              >
                {item.icon}
                {item.key === "notifications" && unread > 0 && (
                  <span className="absolute top-0 right-0 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">
                    {unread > 9 ? "9+" : unread}
                  </span>
                )}
                {active && <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-white" />}
              </Link>
            );
          })}
        </div>
      </nav>

      <NotificationsPanel open={showNotifs} onClose={() => setShowNotifs(false)} me={me} notifications={notifications} setNotifications={setNotifications} />
    </>
  );
}
