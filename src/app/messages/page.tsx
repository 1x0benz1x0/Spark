"use client";
import { useEffect, useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { readMe } from "@/lib/spark-auth";
import { MessageCircle, ArrowLeft, Send, Search as SearchIcon, Lock } from "lucide-react";
import { Sidebar } from "../components/Sidebar";
import { CrownIcon, VerifiedBadge } from "../components/Badges";

type Profile = { id: string; username: string; full_name: string; avatar_url: string; verified?: boolean; is_admin?: boolean; is_owner?: boolean };
type Msg = { id: string; sender_id: string; content: string };
type Chat = { id: string; user1_id: string; user2_id: string };

const APP_SALT = "spark-chat-v1";

async function chatKeyOf(chatId: string, user1: string, user2: string): Promise<CryptoKey> {
  const base = [user1, user2].sort().join(":");
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(base + ":" + chatId + ":" + APP_SALT));
  return crypto.subtle.importKey("raw", digest, "AES-GCM", false, ["encrypt", "decrypt"]);
}

async function encrypt(plain: string, key: CryptoKey): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(plain));
  const bytes = new Uint8Array(iv.length + ct.byteLength);
  bytes.set(iv, 0);
  bytes.set(new Uint8Array(ct), iv.length);
  return btoa(String.fromCharCode(...bytes));
}

async function decrypt(payload: string, key: CryptoKey): Promise<string> {
  try {
    const bytes = Uint8Array.from(atob(payload), (c) => c.charCodeAt(0));
    const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: bytes.slice(0, 12) }, key, bytes.slice(12));
    return new TextDecoder().decode(pt);
  } catch {
    return "[encrypted]";
  }
}

export default function MessagesPage() {
  const supabase = createClient();
  const router = useRouter();
  const [me, setMe] = useState<string | null>(null);
  const [chats, setChats] = useState<(Chat & { other: Profile; last: string; lastAt: string })[]>([]);
  const [suggestions, setSuggestions] = useState<Profile[]>([]);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Profile[]>([]);
  const [active, setActive] = useState<Profile | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [draft, setDraft] = useState("");
  const [chatId, setChatId] = useState<string | null>(null);
  const [sendingImage, setSendingImage] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);
  const keys = useRef<Map<string, CryptoKey>>(new Map());
  const fileInputRef = useRef<HTMLInputElement>(null);

  function getChatKey(chat: Chat): Promise<CryptoKey> {
    const got = keys.current.get(chat.id);
    if (got) return Promise.resolve(got);
    return chatKeyOf(chat.id, chat.user1_id, chat.user2_id).then((k) => { keys.current.set(chat.id, k); return k; });
  }

  async function loadChats() {
    if (!me) return;
    const { data: cs } = await supabase
      .from("chats")
      .select("id, user1_id, user2_id")
      .or("user1_id.eq." + me + ",user2_id.eq." + me)
      .order("created_at", { ascending: false });
    const list = ((cs ?? []) as unknown as Chat[]).map((c) => ({ chat: c, otherId: c.user1_id === me ? c.user2_id : c.user1_id }));
    const others = Array.from(new Set(list.map((l) => l.otherId)));
    const { data: ppl } = others.length ? await supabase.from("profiles").select("id, username, full_name, avatar_url, verified, is_admin, is_owner").in("id", others) : { data: [] as any };
    const byId = new Map(((ppl ?? []) as unknown as Profile[]).map((p) => [p.id, p]));
    const withMeta = await Promise.all(list.map(async ({ chat, otherId }) => {
      const { data: last } = await supabase.from("messages").select("content, created_at, sender_id").eq("chat_id", chat.id).order("created_at", { ascending: false }).limit(1);
      let preview = "No messages yet";
      if (last && last.length > 0) {
        const key = keys.current.get(chat.id) ?? (await chatKeyOf(chat.id, chat.user1_id, chat.user2_id));
        keys.current.set(chat.id, key);
        const text = await decrypt(last[0].content, key);
        preview = (last[0].sender_id === me ? "You: " : "") + text;
      }
      return { ...chat, other: byId.get(otherId) ?? { id: otherId, username: "unknown", full_name: "", avatar_url: "", verified: false, is_admin: false, is_owner: false }, last: preview, lastAt: last?.[0]?.created_at ?? "" };
    }));
    setChats(withMeta);
  }

  useEffect(() => {
    (async () => {
      const meData = readMe();
      if (!meData) { router.push("/auth"); return; }
      setMe(meData.id);
      await loadChats();
      const { data: sug } = await supabase.from("profiles").select("id, username, full_name, avatar_url, verified, is_admin, is_owner").neq("id", meData.id).limit(30);
      setSuggestions((sug as unknown as Profile[]) ?? []);
      setResults((sug as unknown as Profile[]) ?? []);
    })();
  }, []);

  useEffect(() => {
    (async () => {
      if (!query.trim()) { setResults(suggestions); return; }
      const { data } = await supabase
        .from("profiles")
        .select("id, username, full_name, avatar_url, verified, is_admin, is_owner")
        .or("username.ilike.%" + query.trim() + "%,full_name.ilike.%" + query.trim() + "%")
        .neq("id", me ?? "")
        .limit(20);
      setResults((data as unknown as Profile[]) ?? []);
    })();
  }, [query, suggestions.length, me]);

  async function openChat(u: Profile) {
    if (!me) return;
    setActive(u);
    const a = me, b = u.id;
    const { data: existing } = await supabase
      .from("chats")
      .select("id, user1_id, user2_id")
      .or("and(user1_id.eq." + a + ",user2_id.eq." + b + "),and(user1_id.eq." + b + ",user2_id.eq." + a + ")")
      .maybeSingle();
    let chat = existing as unknown as Chat | null;
    if (!chat) {
      const { data, error } = await supabase.from("chats").insert({ user1_id: me, user2_id: u.id }).select("id, user1_id, user2_id").single();
      if (error) { console.log(error); return; }
      chat = data as unknown as Chat;
    }
    setChatId(chat.id);
    const key = await chatKeyOf(chat.id, chat.user1_id, chat.user2_id);
    keys.current.set(chat.id, key);
    const { data: msgs } = await supabase
      .from("messages")
      .select("id, sender_id, content, created_at")
      .eq("chat_id", chat.id)
      .order("created_at");
    const dec = await Promise.all(((msgs ?? []) as any[]).map(async (m) => ({ id: m.id, sender_id: m.sender_id, content: await decrypt(m.content, key) })));
    setMessages(dec);
  }

  useEffect(() => {
    if (!me || !chatId) return;
    const chan = supabase
      .channel("chat:" + chatId)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: "chat_id=eq." + chatId }, async (payload: any) => {
        const m = payload.new;
        if (m.sender_id === me) return;
        const key = keys.current.get(chatId);
        if (!key) return;
        const text = await decrypt(m.content, key);
        setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, { id: m.id, sender_id: m.sender_id, content: text }]));
      })
      .subscribe();
    return () => { supabase.removeChannel(chan); };
  }, [me, chatId]);

  useEffect(() => {
    if (!me) return;
    const chan = supabase
      .channel("chats-list")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, () => {
        loadChats();
      })
      .subscribe();
    return () => { supabase.removeChannel(chan); };
  }, [me]);

  useEffect(() => { bottom.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  async function send() {
    if (!draft.trim() || !me || !active || !chatId) return;
    const key = keys.current.get(chatId) ?? (await chatKeyOf(chatId, me, active.id));
    keys.current.set(chatId, key);
    const enc = await encrypt(draft.trim(), key);
    const { data } = await supabase
      .from("messages")
      .insert({ chat_id: chatId, sender_id: me, content: enc })
      .select("id")
      .single();
    if (data) {
      setMessages((p) => [...p, { id: data.id, sender_id: me, content: draft.trim() }]);
      setDraft("");
      loadChats();
      if (active && active.id !== me) {
        await supabase.from("notifications").insert({
          user_id: active.id,
          actor_id: me,
          type: "message",
          entity_id: chatId,
          text: "sent you a message",
        });
      }
    }
  }

  async function sendImage(file: File) {
    if (!me || !active || !chatId) return;
    setSendingImage(true);
    const path = me + "/chat-" + Date.now() + "-" + file.name;
    const { error: upErr } = await supabase.storage.from("posts").upload(path, file);
    if (upErr) { alert(upErr.message); setSendingImage(false); return; }
    const { data: { publicUrl } } = supabase.storage.from("posts").getPublicUrl(path);
    const key = keys.current.get(chatId) ?? (await chatKeyOf(chatId, me, active.id));
    keys.current.set(chatId, key);
    const marker = "IMG:" + publicUrl;
    const enc = await encrypt(marker, key);
    const { data } = await supabase
      .from("messages")
      .insert({ chat_id: chatId, sender_id: me, content: enc })
      .select("id")
      .single();
    if (data) {
      setMessages((p) => [...p, { id: data.id, sender_id: me, content: marker }]);
      loadChats();
      if (active && active.id !== me) {
        await supabase.from("notifications").insert({
          user_id: active.id,
          actor_id: me,
          type: "message",
          entity_id: chatId,
          text: "sent you a photo",
        });
      }
    }
    setSendingImage(false);
  }

  if (!me) return <div className="min-h-screen bg-black text-white flex items-center justify-center">Loading...</div>;

  const chatIds = new Set(chats.map((c) => c.other.id));

  return (
    <div className="h-screen bg-black text-white md:ml-[72px] flex overflow-hidden">
      <Sidebar />
      <div className={"w-full md:w-[350px] border-r border-zinc-800 flex flex-col " + (active ? "hidden md:flex" : "flex")}>
        <div className="flex items-center justify-between px-4 pt-3 pb-2">
          <h1 className="text-xl font-bold">Messages</h1>
          <MessageCircle className="w-6 h-6" />
        </div>
        <div className="px-3 pb-2">
          <div className="flex items-center gap-2 bg-zinc-900 rounded-lg px-3 py-2">
            <SearchIcon className="w-4 h-4 text-zinc-500" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search people" className="bg-transparent outline-none text-sm flex-1" />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {chats.length > 0 && (
            <>
              <p className="px-4 pt-2 pb-1 text-xs font-semibold text-zinc-500">Your chats</p>
              {chats.map((c) => (
                <button key={c.id} onClick={() => openChat(c.other)} className="flex items-center gap-3 w-full px-4 py-2.5 hover:bg-zinc-900 text-left">
                  <div className="relative w-12 h-12 rounded-full bg-zinc-700 overflow-hidden shrink-0 flex items-center justify-center">
                    {c.other.avatar_url
                      ? <img src={c.other.avatar_url} alt="" className="w-full h-full object-cover" />
                      : <span className="font-semibold text-lg text-zinc-300">{c.other.username ? c.other.username[0].toUpperCase() : "?"}</span>}
                    <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-green-500 border-2 border-black" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold truncate flex items-center gap-1">
                      {c.other.username || "unknown"}
                      {c.other.is_owner && <CrownIcon className="w-3.5 h-3.5" />}
                      {c.other.verified && !c.other.is_owner && <VerifiedBadge className="w-3.5 h-3.5" />}
                    </p>
                    <p className="text-zinc-500 text-sm truncate">{c.last}</p>
                  </div>
                </button>
              ))}
            </>
          )}
          <p className="px-4 pt-2 pb-1 text-xs font-semibold text-zinc-500">{query.trim() ? "Results" : "Suggested"}</p>
          {results.map((u) => (
            <button key={u.id} onClick={() => openChat(u)} className="flex items-center gap-3 w-full px-4 py-2.5 hover:bg-zinc-900 text-left">
              <div className="w-12 h-12 rounded-full bg-zinc-700 overflow-hidden shrink-0 flex items-center justify-center">
                {u.avatar_url
                  ? <img src={u.avatar_url} alt="" className="w-full h-full object-cover" />
                  : <span className="font-semibold text-lg text-zinc-300">{u.username ? u.username[0].toUpperCase() : "?"}</span>}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold truncate flex items-center gap-1">
                  {u.username || "unknown"}
                  {u.is_owner && <CrownIcon className="w-3.5 h-3.5" />}
                  {u.verified && !u.is_owner && <VerifiedBadge className="w-3.5 h-3.5" />}
                </p>
                <p className="text-zinc-500 text-sm truncate">{u.full_name || "Tap to chat"}</p>
              </div>
            </button>
          ))}
          {results.length === 0 && <p className="text-center text-zinc-500 text-sm py-8">No people found</p>}
        </div>
      </div>

      <div className={"flex-1 flex flex-col " + (active ? "flex" : "hidden md:flex")}>
        {active ? (
          <>
            <div className="flex items-center gap-3 px-4 py-3 border-b border-zinc-800">
              <button onClick={() => { setActive(null); setChatId(null); }} className="md:hidden p-1"><ArrowLeft className="w-6 h-6" /></button>
              <div className="w-9 h-9 rounded-full bg-zinc-700 overflow-hidden flex items-center justify-center">
                {active.avatar_url
                  ? <img src={active.avatar_url} alt="" className="w-full h-full object-cover" />
                  : <span className="font-semibold">{active.username ? active.username[0].toUpperCase() : "?"}</span>}
              </div>
              <div>
                <p className="font-semibold flex items-center gap-1">
                  {active.username}
                  {active.is_owner && <CrownIcon className="w-4 h-4" />}
                  {active.verified && !active.is_owner && <VerifiedBadge className="w-4 h-4" />}
                </p>
                <p className="text-xs text-green-500 flex items-center gap-1"><Lock className="w-3 h-3" />Encrypted chat</p>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-2">
              {messages.length === 0 && <p className="text-center text-zinc-500 text-sm m-auto">Say hi</p>}
              {messages.map((m) => (
                <div key={m.id} className={"max-w-[70%] px-4 py-2 rounded-3xl text-sm " + (m.sender_id === me ? "self-end bg-blue-500 text-white" : "self-start bg-zinc-800")}>
                  {m.content.startsWith("IMG:") ? (
                    <img src={m.content.slice(4)} alt="" className="rounded-2xl max-w-full max-h-[300px] object-cover" />
                  ) : (
                    m.content
                  )}
                </div>
              ))}
              <div ref={bottom} />
            </div>
            <div className="flex items-center gap-2 px-4 py-3 border-t border-zinc-800 max-md:pb-16">
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={sendingImage}
                className="p-2 text-zinc-400 hover:text-white transition text-xl leading-none"
              >
                {sendingImage ? "..." : "+"}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) sendImage(f);
                  e.target.value = "";
                }}
              />
              <input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} placeholder="Message..." className="flex-1 bg-zinc-900 rounded-full px-4 py-2 text-sm outline-none" />
              <button onClick={send} className="text-blue-500 font-semibold text-sm">Send</button>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-zinc-500">
            <MessageCircle className="w-10 h-10 mb-3" />
            <p>Your messages</p>
            <p className="text-sm">Pick someone to start a chat</p>
          </div>
        )}
      </div>
    </div>
  );
}
