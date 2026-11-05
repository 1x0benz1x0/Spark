// Spark's own session: username + password against the auth-flow edge function.
// The browser only ever stores { id, username }; passwords are salted SHA-256
// server-side and never sent or stored in the open.

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;

export type SparkUser = { id: string; username: string };
const KEY = "spark_user";

export function readMe(): SparkUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as SparkUser) : null;
  } catch {
    return null;
  }
}

export function setMe(user: SparkUser) {
  localStorage.setItem(KEY, JSON.stringify(user));
}

export function signOutMe() {
  localStorage.removeItem(KEY);
  // drop any legacy supabase session too
  localStorage.removeItem(
    `sb-${new URL(SUPABASE_URL).hostname.split(".")[0]}-auth-token`
  );
}

export async function sparkAuth(
  action: "signup" | "login",
  username: string,
  password: string
): Promise<{ ok: boolean; user?: SparkUser; error?: string }> {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/auth-flow`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, username, password }),
  });
  const data = await res.json().catch(() => ({ error: "bad response" }));
  if (!res.ok) return { ok: false, error: data.error ?? "something went wrong" };
  return { ok: true, user: data.user };
}

export async function sparkGuest(): Promise<{ ok: boolean; user?: SparkUser; error?: string }> {
  const n = Math.random().toString(36).slice(2, 8);
  const pass = crypto.randomUUID();
  return sparkAuth("signup", `guest_${n}`, pass);
}
