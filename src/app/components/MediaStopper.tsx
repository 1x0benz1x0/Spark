"use client";
import { useEffect } from "react";

function stopAllMedia() {
  document.querySelectorAll("video, audio").forEach((el) => {
    const media = el as HTMLMediaElement;
    try {
      media.pause();
    } catch {}
  });
}

export function MediaStopper() {
  // Stop media when the browser tab is switched away / window hidden or blurred.
  // In-app navigation unmounts pages, which stops media on its own.
  useEffect(() => {
    function onVisibility() {
      if (document.visibilityState === "hidden") stopAllMedia();
    }
    function onBlur() {
      stopAllMedia();
    }
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("blur", onBlur);
    window.addEventListener("pagehide", stopAllMedia);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("pagehide", stopAllMedia);
    };
  }, []);

  return null;
}
