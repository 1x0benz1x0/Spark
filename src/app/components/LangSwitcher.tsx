"use client";
import { useState } from "react";
import { Languages, Check } from "lucide-react";
import { useI18n, type LangCode } from "@/lib/i18n";

export function LangSwitcher() {
  const { lang, setLang, t } = useI18n();
  const [open, setOpen] = useState(false);

  const currentFlag = lang === "es" ? "🇪🇸" : "🇺🇸";

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-2">
      {open && (
        <div className="flex flex-col gap-1 bg-zinc-900 border border-zinc-800 rounded-2xl p-1.5 shadow-2xl shadow-black/50 min-w-[180px]">
          <button
            onClick={() => { setLang("en"); setOpen(false); }}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm transition ${lang === "en" ? "bg-blue-500/20 text-white" : "text-zinc-300 hover:bg-zinc-800"}`}
          >
            <span className="text-base">🇺🇸</span>
            <span className="flex-1 text-left">English</span>
            {lang === "en" && <Check className="w-4 h-4 text-blue-400" />}
          </button>
          <button
            onClick={() => { setLang("es"); setOpen(false); }}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm transition ${lang === "es" ? "bg-blue-500/20 text-white" : "text-zinc-300 hover:bg-zinc-800"}`}
          >
            <span className="text-base">🇪🇸</span>
            <span className="flex-1 text-left">Español</span>
            {lang === "es" && <Check className="w-4 h-4 text-blue-400" />}
          </button>
        </div>
      )}

      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Translate page"
        aria-expanded={open}
        className="flex items-center gap-2 px-3 py-2.5 rounded-full bg-zinc-900/90 backdrop-blur-xl border border-zinc-800 shadow-2xl shadow-black/50 hover:scale-105 active:scale-95 transition-transform"
      >
        <Languages className="w-5 h-5 text-zinc-300" />
        <span className="text-lg leading-none">{currentFlag}</span>
      </button>
    </div>
  );
}
