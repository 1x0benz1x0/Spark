"use client";
import { useEffect, useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { readMe } from "@/lib/spark-auth";
import { MessageCircle, ArrowLeft, Send, Search as SearchIcon, Lock, Languages } from "lucide-react";
import { Sidebar } from "../components/Sidebar";
import { CrownIcon, VerifiedBadge } from "../components/Badges";
import { useI18n, type LangCode } from "@/lib/i18n";

type Profile = { id: string; username: string; full_name: string; avatar_url: string; verified?: boolean; is_admin?: boolean; is_owner?: boolean };
type Msg = { id: string; sender_id: string; content: string };
type Chat = { id: string; user1_id: string; user2_id: string };
type ChatListItem = Chat & { other: Profile; last: string; lastAt: string; isGroup?: boolean; members?: Profile[]; creatorId?: string; groupName?: string };

/** Extracts a "GRP:" group message (name + member ids + timestamp) from plaintext before encryption. */
function packGroup(groupName: string, memberIds: string[]): string {
  return "GRP:" + groupName + "|" + memberIds.join(",");
}
function unpackGroup(text: string): { groupName: string; memberIds: string[] } | null {
  if (!text.startsWith("GRP:")) return null;
  const rest = text.slice(4);
  const sep = rest.indexOf("|");
  if (sep < 0) return null;
  return { groupName: rest.slice(0, sep), memberIds: rest.slice(sep + 1).split(",").filter(Boolean) };
}

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
  const { lang, translate, isTranslating } = useI18n();
  const [me, setMe] = useState<string | null>(null);
  const [chats, setChats] = useState<ChatListItem[]>([]);
  const [suggestions, setSuggestions] = useState<Profile[]>([]);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Profile[]>([]);
  const [active, setActive] = useState<Profile | null>(null);
  const [activeGroup, setActiveGroup] = useState<{ groupName: string; members: Profile[]; creatorId: string } | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [messagesBySender, setMessagesBySender] = useState<Map<string, string>>(new Map());
  const [draft, setDraft] = useState("");
  const [chatId, setChatId] = useState<string | null>(null);
  const [sendingImage, setSendingImage] = useState(false);
  const [msgShown, setMsgShown] = useState<Record<string, boolean>>({});
  const [msgTranslated, setMsgTranslated] = useState<Record<string, string>>({});
  const [msgBusy, setMsgBusy] = useState<Record<string, boolean>>({});
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [groupDraftName, setGroupDraftName] = useState("");
  const [groupSelected, setGroupSelected] = useState<string[]>([]);
  const [groupSearch, setGroupSearch] = useState("");
  const [groupResults, setGroupResults] = useState<Profile[]>([]);
  const [creatingGroup, setCreatingGroup] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);
  const keys = useRef<Map<string, CryptoKey>>(new Map());
  const fileInputRef = useRef<HTMLInputElement>(null);

  // participants of the currently open chat/group, used for the group key derivation
  const activeParticipants = useRef<string[]>([]);
  const activeGroupRef = useRef<{ groupName: string; members: Profile[]; creatorId: string } | null>(null);

  function getChatKey(chat: Chat): Promise<CryptoKey> {
    const got = keys.current.get(chat.id);
    if (got) return Promise.resolve(got);
    return chatKeyOf(chat.id, chat.user1_id, chat.user2_id).then((k) => { keys.current.set(chat.id, k); return k; });
  }

  // group chat key: derived from the SORTED set of member ids, so every member gets the same key
  function groupKeyOf(chatId: string, memberIds: string[]): Promise<CryptoKey> {
    const base = [...memberIds].sort().join(":");
    return crypto.subtle
      .digest("SHA-256", new TextEncoder().encode("grp:" + chatId + ":" + base + ":" + APP_SALT))
      .then((digest) => crypto.subtle.importKey("raw", digest, "AES-GCM", false, ["encrypt", "decrypt"]));
  }

  async function loadChats() {
    if (!me) return;
    // get all chats I'm a member of (via group_members, backfilled for 1-1 chats)
    const { data: membership } = await supabase
      .from("group_members")
      .select("chat_id")
      .eq("user_id", me);
    const myChatIds = Array.from(new Set(((membership ?? []) as any[]).map((r) => r.chat_id)));
    let cs: Chat[] = [];
    if (myChatIds.length) {
      const { data } = await supabase
        .from("chats")
        .select("id, user1_id, user2_id")
        .in("id", myChatIds)
        .order("created_at", { ascending: false });
      cs = ((data ?? []) as unknown as Chat[]);
    }
    // members per chat
    const { data: members } = myChatIds.length
      ? await supabase.from("group_members").select("chat_id, user_id").in("chat_id", myChatIds)
      : { data: [] as any[] };
    const memberMap = new Map<string, string[]>();
    for (const m of ((members ?? []) as any[])) {
      if (!memberMap.has(m.chat_id)) memberMap.set(m.chat_id, []);
      memberMap.get(m.chat_id)!.push(m.user_id);
    }
    const allIds = Array.from(new Set([...memberMap.values()].flat()));
    const { data: ppl } = allIds.length
      ? await supabase.from("profiles").select("id, username, full_name, avatar_url, verified, is_admin, is_owner").in("id", allIds)
      : { data: [] as any };
    const byId = new Map(((ppl ?? []) as unknown as Profile[]).map((p) => [p.id, p]));

    const withMeta = await Promise.all(cs.map(async (chat) => {
      const ids = memberMap.get(chat.id) ?? [chat.user1_id, chat.user2_id];
      const isGroup = ids.length > 2;
      const memberProfiles = ids.map((id) => byId.get(id)).filter(Boolean) as Profile[];
      const others = memberProfiles.filter((p) => p.id !== me);
      const other = others[0] ?? { id: "unknown", username: "unknown", full_name: "", avatar_url: "", verified: false, is_admin: false, is_owner: false };

      const { data: last } = await supabase.from("messages").select("content, created_at, sender_id").eq("chat_id", chat.id).order("created_at", { ascending: false }).limit(1);
      let preview = "No messages yet";
      if (last && last.length > 0) {
        let key: CryptoKey | undefined;
        if (isGroup) {
          key = await groupKeyOf(chat.id, ids);
        } else {
          key = keys.current.get(chat.id) ?? (await chatKeyOf(chat.id, chat.user1_id, chat.user2_id));
        }
        keys.current.set(chat.id, key);
        const text = await decrypt(last[0].content, key);
        preview = (last[0].sender_id === me ? "You: " : "") + text;
      }
      return { ...chat, other, last: preview, lastAt: last?.[0]?.created_at ?? "", isGroup, members: memberProfiles, creatorId: chat.user1_id, groupName: "" } as ChatListItem;
    }));
    setChats(withMeta as ChatListItem[]);
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

  async function decryptMessages(chatId: string, isGroup: boolean, participantIds: string[], msgs: any[]): Promise<Msg[]> {
    const key = keys.current.get(chatId) ?? (isGroup ? await groupKeyOf(chatId, participantIds) : await chatKeyOf(chatId, participantIds[0] ?? "", participantIds[1] ?? ""));
    keys.current.set(chatId, key);
    return Promise.all(msgs.map(async (m) => ({ id: m.id, sender_id: m.sender_id, content: await decrypt(m.content, key) })));
  }

  // detect a group when its messages decrypt to a GRP: header
  async function readGroupInfo(chat: Chat): Promise<{ groupName: string; memberIds: string[] } | null> {
    const { data } = await supabase.from("group_members").select("user_id").eq("chat_id", chat.id);
    const ids = ((data ?? []) as any[]).map((r) => r.user_id);
    if (ids.length <= 2) return null;
    const { data: msgs } = await supabase.from("messages").select("content").eq("chat_id", chat.id).order("created_at").limit(1);
    if (!msgs?.length) return null;
    const key = await groupKeyOf(chat.id, ids);
    const plain = await decrypt(msgs[0].content, key);
    const info = unpackGroup(plain);
    if (!info) return null;
    return { groupName: info.groupName, memberIds: info.memberIds };
  }

  async function openChat(u: Profile) {
    if (!me) return;
    setActive(u);
    setActiveGroup(null);
    activeGroupRef.current = null;
    const a = me, b = u.id;
    const { data: existing } = await supabase
      .from("chats")
      .select("id, user1_id, user2_id")
      .or("and(user1_id.eq." + a + ",user2_id.eq." + b + "),and(user1_id.eq." + b + ",user2_id.eq." + a + ")")
      .maybeSingle();
    let chat = existing as unknown as Chat | null;
    if (!chat) {
      const firstOther = b;
      const { data, error } = await supabase.from("chats").insert({ user1_id: me, user2_id: firstOther }).select("id, user1_id, user2_id").single();
      if (error) { console.log(error); return; }
      chat = data as unknown as Chat;
      await supabase.from("group_members").insert([{ chat_id: chat.id, user_id: me }, { chat_id: chat.id, user_id: u.id }]);
    }
    setChatId(chat.id);
    activeParticipants.current = [chat.user1_id, chat.user2_id];
    const key = await chatKeyOf(chat.id, chat.user1_id, chat.user2_id);
    keys.current.set(chat.id, key);
    const { data: msgs } = await supabase
      .from("messages")
      .select("id, sender_id, content, created_at")
      .eq("chat_id", chat.id)
      .order("created_at");
    const dec = await decryptMessages(chat.id, false, [chat.user1_id, chat.user2_id], (msgs ?? []) as any[]);
    setMessages(dec);
  }

  async function openGroup(c: ChatListItem) {
    if (!me) return;
    setActive(null);
    setActiveGroup({ groupName: c.groupName || "Group", members: c.members ?? [], creatorId: c.creatorId ?? me });
    activeGroupRef.current = { groupName: c.groupName || "Group", members: c.members ?? [], creatorId: c.creatorId ?? me };
    setChatId(c.id);
    const ids = (c.members ?? []).map((m) => m.id);
    activeParticipants.current = ids;
    const { data: msgs } = await supabase
      .from("messages")
      .select("id, sender_id, content, created_at")
      .eq("chat_id", c.id)
      .order("created_at");
    const dec = await decryptMessages(c.id, true, ids, (msgs ?? []) as any[]);
    setMessages(dec);
  }

  // resolve group names lazily from the GRP: header message
  useEffect(() => {
    if (!me) return;
    (async () => {
      const groups = chats.filter((c) => c.isGroup && !c.groupName);
      if (!groups.length) return;
      const { data: membership } = await supabase.from("group_members").select("chat_id, user_id").in("chat_id", groups.map((g) => g.id));
      const memByChat = new Map<string, string[]>();
      for (const m of ((membership ?? []) as any[])) {
        if (!memByChat.has(m.chat_id)) memByChat.set(m.chat_id, []);
        memByChat.get(m.chat_id)!.push(m.user_id);
      }
      const updates = new Map<string, string>();
      for (const g of groups) {
        const ids = memByChat.get(g.id) ?? [];
        if (ids.length <= 2) continue;
        const { data: hdrs } = await supabase.from("messages").select("content").eq("chat_id", g.id).order("created_at").limit(1);
        if (!hdrs?.length) continue;
        const key = await groupKeyOf(g.id, ids);
        const plain = await decrypt(hdrs[0].content, key);
        const info = unpackGroup(plain);
        if (info?.groupName) updates.set(g.id, info.groupName);
      }
      if (updates.size) {
        setChats((prev) => prev.map((c) => (updates.has(c.id) ? { ...c, groupName: updates.get(c.id)! } : c)));
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me, chats.length]);

  async function openChatByList(c: ChatListItem) {
    if (c.isGroup) await openGroup(c);
    else await openChat(c.other);
  }

  useEffect(() => {
    if (!me || !chatId) return;
    const isGroup = activeParticipants.current.length > 2;
    const participants = [...activeParticipants.current];
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
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chats" }, () => {
        loadChats();
      })
      .subscribe();
    return () => { supabase.removeChannel(chan); };
  }, [me]);

  useEffect(() => { bottom.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  async function send() {
    if (!draft.trim() || !me || !chatId || (!active && !activeGroup)) return;
    const participants = activeParticipants.current;
    const isGroup = participants.length > 2;
    const key = keys.current.get(chatId) ?? (isGroup ? await groupKeyOf(chatId, participants) : await chatKeyOf(chatId, participants[0] ?? me, participants[1] ?? me));
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
      // notify all other participants for group chats, the other user for 1-1
      const targets = participants.filter((id) => id !== me);
      for (const targetId of targets) {
        await supabase.from("notifications").insert({
          user_id: targetId,
          actor_id: me,
          type: "message",
          entity_id: chatId,
          text: isGroup ? "sent a message in a group chat" : "sent you a message",
        });
      }
    }
  }

  async function sendImage(file: File) {
    if (!me || !chatId || (!active && !activeGroup)) return;
    setSendingImage(true);
    const path = me + "/chat-" + Date.now() + "-" + file.name;
    const { error: upErr } = await supabase.storage.from("posts").upload(path, file);
    if (upErr) { alert(upErr.message); setSendingImage(false); return; }
    const { data: { publicUrl } } = supabase.storage.from("posts").getPublicUrl(path);
    const participants = activeParticipants.current;
    const isGroup = participants.length > 2;
    const key = keys.current.get(chatId) ?? (isGroup ? await groupKeyOf(chatId, participants) : await chatKeyOf(chatId, participants[0] ?? me, participants[1] ?? me));
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
      const targets = participants.filter((id) => id !== me);
      for (const targetId of targets) {
        await supabase.from("notifications").insert({
          user_id: targetId,
          actor_id: me,
          type: "message",
          entity_id: chatId,
          text: isGroup ? "sent a photo in a group chat" : "sent you a photo",
        });
      }
    }
    setSendingImage(false);
  }

  async function translateMessage(id: string) {
    const m = messages.find((x) => x.id === id);
    if (!m || m.content.startsWith("IMG:")) return;
    setMsgBusy((b) => ({ ...b, [id]: true }));
    try {
      const res = await translate(m.content, "en", lang === "es" ? "es" : "en");
      setMsgTranslated((s) => ({ ...s, [id]: res.text }));
      setMsgShown((s) => ({ ...s, [id]: true }));
    } catch (e) {
      alert(e instanceof Error ? e.message : "Translation failed");
    } finally {
      setMsgBusy((b) => {
        const next = { ...b };
        delete next[id];
        return next;
      });
    }
  }

  // —— group chat creation ——
  useEffect(() => {
    if (!showGroupModal) return;
    const q = groupSearch.trim();
    if (!q) {
      setGroupResults(suggestions);
      return;
    }
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, username, full_name, avatar_url, verified, is_admin, is_owner")
        .or("username.ilike.%" + q + "%,full_name.ilike.%" + q + "%")
        .neq("id", me ?? "")
        .limit(30);
      setGroupResults((data as unknown as Profile[]) ?? []);
    })();
  }, [groupSearch, showGroupModal, suggestions.length, me]);

  function toggleGroupMember(id: string) {
    setGroupSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function createGroup() {
    if (!me || groupSelected.length < 1) return;
    setCreatingGroup(true);
    try {
      // chat needs user1/user2 placeholders: me + first member (the encryption/meta logic uses member ids from group_members after this)
      const firstOther = groupSelected[0];
      const { data: chat, error } = await supabase
        .from("chats")
        .insert({ user1_id: me, user2_id: firstOther })
        .select("id, user1_id, user2_id")
        .single();
      if (error || !chat) { alert(error?.message || "Couldn't create group"); return; }
      const allIds = [me, ...groupSelected];
      const rows = allIds.map((uid) => ({ chat_id: chat.id, user_id: uid }));
      const { error: mErr } = await supabase.from("group_members").insert(rows);
      if (mErr) { alert(mErr.message); return; }

      // store a GRP: header message with group name so members can read the name (encrypted with the shared group key)
      const name = groupDraftName.trim() || "Group";
      const key = await groupKeyOf(chat.id, allIds);
      keys.current.set(chat.id, key);
      const header = packGroup(name, allIds);
      const enc = await encrypt(header, key);
      await supabase.from("messages").insert({ chat_id: chat.id, sender_id: me, content: enc });

      for (const uid of groupSelected) {
        await supabase.from("notifications").insert({
          user_id: uid,
          actor_id: me,
          type: "message",
          entity_id: chat.id,
          text: "added you to a group chat",
        });
      }

      await loadChats();
      setShowGroupModal(false);
      setGroupDraftName("");
      setGroupSelected([]);
      setGroupSearch("");
      // open the new group directly
      const { data: ppl } = await supabase.from("profiles").select("id, username, full_name, avatar_url, verified, is_admin, is_owner").in("id", allIds);
      const memberProfiles = ((ppl ?? []) as unknown as Profile[]);
      const newGroup: ChatListItem = {
        id: chat.id,
        user1_id: me,
        user2_id: firstOther,
        other: memberProfiles.find((p) => p.id !== me) ?? memberProfiles[0],
        last: "No messages yet",
        lastAt: "",
        isGroup: true,
        members: memberProfiles,
        creatorId: me,
        groupName: name,
      };
      await openGroup(newGroup);
    } finally {
      setCreatingGroup(false);
    }
  }

  if (!me) return <div className="min-h-screen bg-black text-white flex items-center justify-center">Loading...</div>;

  const chatIds = new Set(chats.map((c) => c.other.id));

  return (
    <div className="h-screen bg-black text-white md:ml-[72px] flex overflow-hidden">
      <Sidebar />
      <div className={"w-full md:w-[350px] border-r border-zinc-800 flex flex-col " + (active || activeGroup ? "hidden md:flex" : "flex")}>
        <div className="flex items-center justify-between px-4 pt-3 pb-2">
          <h1 className="text-xl font-bold">Messages</h1>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowGroupModal(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-500 hover:bg-blue-600 text-white text-xs font-semibold transition" aria-label="Make group chat">
              <PlusIcon /> Make group chat
            </button>
          </div>
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
                <button
                  key={c.id}
                  onClick={() => openChatByList(c)}
                  className={`flex items-center gap-3 w-full px-4 py-2.5 text-left ${chatId === c.id ? "bg-zinc-900" : "hover:bg-zinc-900"}`}
                >
                  <div className="relative w-12 h-12 rounded-full bg-zinc-700 overflow-hidden shrink-0 flex items-center justify-center">
                    {c.isGroup ? (
                      <span className="font-semibold text-lg text-zinc-300">{(c.groupName || "G")[0].toUpperCase()}</span>
                    ) : c.other.avatar_url ? (
                      <img src={c.other.avatar_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span className="font-semibold text-lg text-zinc-300">{c.other.username ? c.other.username[0].toUpperCase() : "?"}</span>
                    )}
                    {!c.isGroup && <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-green-500 border-2 border-black" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    {c.isGroup ? (
                      <>
                        <p className="font-semibold truncate flex items-center gap-1">{c.groupName || "Group"}</p>
                        <p className="text-zinc-500 text-sm truncate">{c.last}</p>
                      </>
                    ) : (
                      <>
                        <p className="font-semibold truncate flex items-center gap-1">
                          {c.other.username || "unknown"}
                          {c.other.is_owner && <CrownIcon className="w-3.5 h-3.5" />}
                          {c.other.verified && !c.other.is_owner && <VerifiedBadge className="w-3.5 h-3.5" />}
                        </p>
                        <p className="text-zinc-500 text-sm truncate">{c.last}</p>
                      </>
                    )}
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
                <div key={m.id} className={"group relative max-w-[70%] px-4 py-2 rounded-3xl text-sm " + (m.sender_id === me ? "self-end bg-blue-500 text-white" : "self-start bg-zinc-800")}>
                  {m.content.startsWith("IMG:") ? (
                    <img src={m.content.slice(4)} alt="" className="rounded-2xl max-w-full max-h-[300px] object-cover" />
                  ) : (
                    <span>{msgShown[m.id] ? msgTranslated[m.id] ?? m.content : m.content}</span>
                  )}
                  {!m.content.startsWith("IMG:") && (
                    <button
                      onClick={() => translateMessage(m.id)}
                      className="absolute -top-2 -right-2 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-black/80 border border-zinc-700 text-[10px] text-zinc-300 opacity-0 group-hover:opacity-100 transition focus:opacity-100 first-letter:uppercase"
                      title="Translate message"
                    >
                      <Languages className="w-3 h-3" />
                      {msgBusy[m.id] ? "..." : msgShown[m.id] ? "Original" : "Translate"}
                    </button>
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
            <p className="text-sm text-center max-w-[260px]">Pick someone to start a chat, or tap "Make group chat" up top to make a group.</p>
          </div>
        )}
      </div>

      {/* group creation modal */}
      {showGroupModal && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={() => setShowGroupModal(false)}>
          <div className="w-full max-w-[420px] bg-zinc-950 border border-zinc-800 rounded-2xl p-5 flex flex-col gap-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">Make group chat</h2>
              <button onClick={() => setShowGroupModal(false)} className="p-1 text-zinc-400 hover:text-white" aria-label="Close">✕</button>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm text-zinc-400">Group name</label>
              <input
                value={groupDraftName}
                onChange={(e) => setGroupDraftName(e.target.value)}
                placeholder="e.g. Lunch crew"
                className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500"
              />
              <p className="text-xs text-zinc-600">Optional — defaults to "Group".</p>
            </div>
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2 bg-zinc-900 rounded-lg px-3 py-2">
                <SearchIcon className="w-4 h-4 text-zinc-500" />
                <input value={groupSearch} onChange={(e) => setGroupSearch(e.target.value)} placeholder="Search people to add" className="bg-transparent outline-none text-sm flex-1" />
              </div>
              {groupSelected.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {groupSelected.map((id) => {
                    const u = suggestions.find((s) => s.id === id) || groupResults.find((s) => s.id === id);
                    return (
                      <span key={id} className="flex items-center gap-1.5 bg-blue-500/20 text-blue-300 text-xs px-2.5 py-1 rounded-full">
                        {u?.username || id}
                        <button onClick={() => toggleGroupMember(id)} className="text-blue-300 hover:text-white" aria-label="Remove">✕</button>
                      </span>
                    );
                  })}
                </div>
              )}
              <p className="text-xs text-zinc-500">{groupSelected.length} selected — pick at least one other person.</p>
              <div className="flex flex-col max-h-[260px] overflow-y-auto">
                {groupResults.map((u) => {
                  const selected = groupSelected.includes(u.id);
                  return (
                    <button key={u.id} onClick={() => toggleGroupMember(u.id)} className={`flex items-center gap-3 w-full px-3 py-2 text-left rounded-lg ${selected ? "bg-blue-500/10" : "hover:bg-zinc-900"}`}>
                      <div className="w-9 h-9 rounded-full bg-zinc-700 overflow-hidden shrink-0 flex items-center justify-center">
                        {u.avatar_url
                          ? <img src={u.avatar_url} alt="" className="w-full h-full object-cover" />
                          : <span className="font-semibold text-sm text-zinc-300">{u.username ? u.username[0].toUpperCase() : "?"}</span>}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm truncate">{u.username}</p>
                        <p className="text-zinc-500 text-xs truncate">{u.full_name || ""}</p>
                      </div>
                      {selected && <span className="text-blue-500 text-sm">✓</span>}
                    </button>
                  );
                })}
                {groupResults.length === 0 && <p className="text-center text-zinc-500 text-sm py-6">No people found</p>}
              </div>
            </div>
            <div className="flex gap-3 pt-1">
              <button onClick={() => setShowGroupModal(false)} className="flex-1 py-2.5 rounded-full bg-[#26292D] hover:bg-[#363A3F] text-sm font-semibold text-white transition-colors">Cancel</button>
              <button
                onClick={createGroup}
                disabled={creatingGroup || groupSelected.length < 1}
                className="flex-1 py-2.5 rounded-full bg-blue-500 hover:bg-blue-600 text-sm font-semibold text-white transition-colors disabled:opacity-40"
              >
                {creatingGroup ? "Creating..." : "Create group"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PlusIcon() {
  return (
    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </svg>
  );
}
