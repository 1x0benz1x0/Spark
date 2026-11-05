import { NextResponse } from "next/server";

type Lang = "en" | "es";

const SUPPORTED: Lang[] = ["en", "es"];

function pickTarget(raw: string | null): Lang {
  if (!raw) return "es";
  const v = raw.toUpperCase();
  if (v.startsWith("EN")) return "en";
  if (v.startsWith("ES")) return "es";
  return "es";
}

function pickSource(raw: string | null, target: Lang): Lang {
  if (!raw) return target === "es" ? "en" : "es";
  const v = raw.toUpperCase();
  if (v.startsWith("EN")) return "en";
  if (v.startsWith("ES")) return "es";
  return target === "es" ? "en" : "es";
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const { text, source, target } = (body || {}) as {
    text?: string;
    source?: string;
    target?: string;
  };
  if (!text || !text.trim()) {
    return NextResponse.json({ error: "Missing text" }, { status: 400 });
  }
  const targetLang = pickTarget(target || null);
  const sourceLang = pickSource(source || null, targetLang);
  if (sourceLang === targetLang) {
    return NextResponse.json({ text, detected: sourceLang });
  }

  const key = process.env.DEEPL_API_KEY;
  if (!key) {
    return NextResponse.json(
      { error: "Translation not configured. Set DEEPL_API_KEY on the server." },
      { status: 503 },
    );
  }

  const endpoint = key.endsWith(":fx")
    ? "https://api-free.deepl.com/v2/translate"
    : "https://api.deepl.com/v2/translate";

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `DeepL-Auth-Key ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text: [text],
        target_lang: targetLang.toUpperCase(),
        source_lang: sourceLang.toUpperCase(),
        formality: "less",
      }),
    });
    const data = (await res.json().catch(() => ({}))) as any;
    if (!res.ok || !data?.translations?.[0]?.text) {
      const msg =
        data?.message ||
        (res.status === 401
          ? "Invalid DeepL API key (401). Check DEEPL_API_KEY."
          : res.status === 456
            ? "DeepL free quota exceeded (456). Try again next month."
            : `DeepL error ${res.status}`);
      return NextResponse.json({ error: msg }, { status: res.status || 502 });
    }
    return NextResponse.json({
      text: data.translations[0].text as string,
      detected: (data.translations[0].detected_source_language as string | undefined)?.toLowerCase(),
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Upstream translate fetch failed" },
      { status: 502 },
    );
  }
}
