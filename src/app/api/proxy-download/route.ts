import { NextResponse } from "next/server";

// Same-origin proxy so the browser can download media from hosts that block CORS.
// The caller validates the URL looks like a media file first; we only proxy media back.
type MediaKind = "video" | "image" | "audio";

const ALLOWED_URL = (url: string): MediaKind | null => {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return null;
  const ext = u.pathname.split(".").pop()?.toLowerCase();
  if (ext && ["mp4", "webm", "mov", "m4v", "ogg"].includes(ext)) return "video";
  if (ext && ["mp3", "wav", "m4a", "aac"].includes(ext)) return "audio";
  if (ext && ["png", "jpg", "jpeg", "gif", "webp", "avif"].includes(ext)) return "image";
  const host = u.hostname.toLowerCase();
  if (
    host.includes("tiktok") ||
    host.includes("youtube") ||
    host.includes("youtu.be") ||
    host.includes("vimeo") ||
    host.includes("instagram") ||
    host.includes("twitter") ||
    host.includes("x.com") ||
    host.includes("facebook") ||
    host.includes("reddit") ||
    host.includes("twitch") ||
    host.includes("supabase")
  ) {
    return "video";
  }
  return null;
};

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const url = searchParams.get("url") || "";
  if (!url || !ALLOWED_URL(url)) {
    return NextResponse.json({ error: "Invalid target URL" }, { status: 400 });
  }

  try {
    const init: RequestInit = {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
      },
    };
    const rangeHeader = req.headers.get("range");
    if (rangeHeader) (init.headers as Record<string, string>)["Range"] = rangeHeader;
    const upstream = await fetch(url, init);
    if (!upstream.ok && upstream.status !== 206) {
      return NextResponse.json({ error: `Upstream failed (${upstream.status})` }, { status: 502 });
    }
    const ct = upstream.headers.get("content-type") || "application/octet-stream";
    const headers: Record<string, string> = {
      "Content-Type": ct,
      "Cache-Control": "no-store",
      "Access-Control-Allow-Origin": "*",
    };
    const len = upstream.headers.get("content-length");
    if (len) headers["Content-Length"] = len;
    const range = upstream.headers.get("content-range");
    if (range) headers["Content-Range"] = range;
    const accept = upstream.headers.get("accept-ranges");
    if (accept) headers["Accept-Ranges"] = accept;
    const disp = upstream.headers.get("content-disposition");
    if (disp) headers["Content-Disposition"] = disp;
    return new NextResponse(upstream.body, { status: upstream.status, headers });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Upstream fetch failed" },
      { status: 502 },
    );
  }
}
