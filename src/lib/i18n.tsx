"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export type LangCode = "en" | "es";

const UI: Record<LangCode, Record<string, string>> = {
  en: {
    "nav.home": "Home",
    "nav.search": "Search",
    "nav.create": "Create",
    "nav.messages": "Messages",
    "nav.sparks": "Sparks",
    "nav.notifications": "Notifications",
    "nav.profile": "Profile",
    "nav.signout": "Sign out",
    "common.post": "Post",
    "common.discard": "Discard",
    "common.send": "Send",
    "common.message": "Message...",
    "common.loading": "Loading...",
    "common.cancel": "Cancel",
    "common.english": "English",
    "common.spanish": "Español",
    "feed.yourmessages": "Your messages",
    "feed.picksomeone": "Pick someone to start a chat",
    "create.upload": "Upload video",
    "create.postacc": "Post a video to your account",
    "create.select": "Select video to upload",
    "create.dragdrop": "Or drag and drop a file",
    "create.caption": "Caption",
    "create.captionph": "Describe your video",
    "create.tags": "Tags",
    "create.whowatch": "Who can watch this video",
    "create.skipUpload": "Download & post",
    "upload.tall": "Turning video tall...",
    "upload.tallSub": "Resizing to vertical format so it plays everywhere.",
    "upload.orlink": "Or download from a link",
    "upload.linksub": "Paste a video/image/audio file URL — Spark downloads it and posts it. Like a TikTok/YouTube downloader.",
    "upload.downloading": "Downloading...",
    "msg.yourchats": "Your chats",
    "msg.suggested": "Suggested",
    "msg.results": "Results",
    "msg.nomessages": "No messages yet",
    "msg.speech": "Encrypted chat",
    "msg.mategroup": "Make group chat",
    "msg.groupname": "Group name",
    "msg.groupnamePh": "e.g. Lunch crew",
    "msg.addpeople": "Search people to add",
    "msg.create": "Create group",
    "msg.creating": "Creating...",
    "msg.selatleast": "pick at least one other person.",
    "msg.selected": "selected",
    "story.add": "Add story",
  },
  es: {
    "nav.home": "Inicio",
    "nav.search": "Buscar",
    "nav.create": "Crear",
    "nav.messages": "Mensajes",
    "nav.sparks": "Sparks",
    "nav.notifications": "Notificaciones",
    "nav.profile": "Perfil",
    "nav.signout": "Cerrar sesión",
    "common.post": "Publicar",
    "common.discard": "Descartar",
    "common.send": "Enviar",
    "common.message": "Mensaje...",
    "common.loading": "Cargando...",
    "common.cancel": "Cancelar",
    "common.english": "English",
    "common.spanish": "Español",
    "feed.yourmessages": "Tus mensajes",
    "feed.picksomeone": "Elige a alguien para empezar un chat",
    "create.upload": "Subir video",
    "create.postacc": "Publica un video en tu cuenta",
    "create.select": "Selecciona un video para subir",
    "create.dragdrop": "O arrastra y suelta un archivo",
    "create.caption": "Título",
    "create.captionph": "Describe tu video",
    "create.tags": "Etiquetas",
    "create.whowatch": "Quién puede ver este video",
    "create.skipUpload": "Descargar y publicar",
    "upload.tall": "Convirtiendo el video a vertical...",
    "upload.tallSub": "Redimensionando al formato vertical para que se reproduzca en todas partes.",
    "upload.orlink": "O descarga desde un enlace",
    "upload.linksub": "Pega la URL de un archivo de video/imagen/audio — Spark lo descarga y lo publica. Como un descargador de TikTok/YouTube.",
    "upload.downloading": "Descargando...",
    "msg.yourchats": "Tus chats",
    "msg.suggested": "Sugeridos",
    "msg.results": "Resultados",
    "msg.nomessages": "Todavía no hay mensajes",
    "msg.speech": "Chat cifrado",
    "msg.mategroup": "Crear grupo",
    "msg.groupname": "Nombre del grupo",
    "msg.groupnamePh": "ej. Grupo del almuerzo",
    "msg.addpeople": "Busca personas para agregar",
    "msg.create": "Crear grupo",
    "msg.creating": "Creando...",
    "msg.selatleast": "elige al menos a una persona más.",
    "msg.selected": "seleccionados",
    "story.add": "Agregar historia",
  },
};

interface I18nCtx {
  lang: LangCode;
  setLang: (l: LangCode) => void;
  t: (key: string) => string;
}

const Ctx = createContext<I18nCtx>({ lang: "en", setLang: () => {}, t: (k: string) => k });

export const useI18n = () => useContext(Ctx);

const storageKey = "spark-lang";

export function LangProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<LangCode>("en");

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(storageKey);
      if (saved === "es" || saved === "en") setLangState(saved as LangCode);
    } catch {}
  }, []);

  const setLang = useCallback((l: LangCode) => {
    setLangState(l);
    try {
      window.localStorage.setItem(storageKey, l);
    } catch {}
  }, []);

  const t = useCallback((key: string) => UI[lang]?.[key] ?? UI.en[key] ?? key, [lang]);
  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
