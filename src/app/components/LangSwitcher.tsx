"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Languages, Check } from "lucide-react";
import { useI18n, type LangCode } from "@/lib/i18n";

const STORAGE_KEY = "spark-lang-position";

export function LangSwitcher() {
  const { lang, setLang, t } = useI18n();
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);

  const wrapRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    moved: boolean;
    startX: number;
    startY: number;
    offsetX: number;
    offsetY: number;
    pointerId: number;
    posX: number;
    posY: number;
  } | null>(null);

  const [dragging, setDragging] = useState(false);
  const [justDragged, setJustDragged] = useState(false);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const { x, y } = JSON.parse(saved);
        if (typeof x === "number" && typeof y === "number") {
          // clamp into the window so the button never gets lost off-screen on load
          const w = window.innerWidth;
          const h = window.innerHeight;
          setPos({ x: Math.min(Math.max(4, x), w - 120), y: Math.min(Math.max(4, y), h - 60) });
        }
      }
    } catch {}
  }, []);

  const persist = useCallback((p: { x: number; y: number }) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
    } catch {}
  }, []);

  const onPointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const rect = wrap.getBoundingClientRect();
    dragRef.current = {
      moved: false,
      startX: e.clientX,
      startY: e.clientY,
      offsetX: e.clientX - rect.left,
      offsetY: e.clientY - rect.top,
      pointerId: e.pointerId,
      posX: rect.left,
      posY: rect.top,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    const d = dragRef.current;
    if (!d || e.pointerId !== d.pointerId) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    if (!d.moved && Math.hypot(dx, dy) > 4) {
      d.moved = true;
      setDragging(true);
      setOpen(false);
    }
    if (d.moved) {
      const next = {
        x: Math.max(4, Math.min(e.clientX - d.offsetX, window.innerWidth - 160)),
        y: Math.max(4, Math.min(e.clientY - d.offsetY, window.innerHeight - 60)),
      };
      setPos(next);
    }
  };

  const onPointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    const d = dragRef.current;
    if (!d || e.pointerId !== d.pointerId) return;
    if (d.moved) {
      setJustDragged(true);
      const el = wrapRef.current;
      if (el) {
        const rect = el.getBoundingClientRect();
        persist({ x: rect.left, y: rect.top });
      }
      setTimeout(() => setJustDragged(false), 0);
    }
    dragRef.current = null;
    setDragging(false);
  };

  const currentFlag = lang === "es" ? "🇪🇸" : "🇺🇸";

  const style: React.CSSProperties & { right?: number; bottom?: number; left?: number; top?: number } =
    pos && !dragging
      ? { left: pos.x, top: pos.y }
      : dragging && pos
        ? { left: pos.x, top: pos.y }
        : { right: 16, bottom: 16 };

  return (
    <div
      ref={wrapRef}
      style={style}
      className={`fixed z-50 flex flex-col items-end gap-2 ${dragging ? "cursor-grabbing" : ""}`}
    >
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
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onClick={(e) => {
          if (justDragged) {
            e.preventDefault();
            e.stopPropagation();
            return;
          }
          setOpen((v) => !v);
        }}
        aria-label="Translate page — drag to move"
        aria-expanded={open}
        className={`flex items-center gap-2 px-3 py-2.5 rounded-full bg-zinc-900/90 backdrop-blur-xl border border-zinc-800 shadow-2xl shadow-black/50 hover:scale-105 active:scale-95 transition-transform touch-none select-none ${dragging ? "cursor-grabbing scale-105" : "cursor-grab"}`}
      >
        <Languages className="w-5 h-5 text-zinc-300 pointer-events-none" />
        <span className="text-lg leading-none pointer-events-none">{currentFlag}</span>
      </button>
    </div>
  );
}
