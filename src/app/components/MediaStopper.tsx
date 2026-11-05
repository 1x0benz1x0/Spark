"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";

function stopAllMedia() {
  document.querySelectorAll("video, audio").forEach((el) => {
    const media = el as HTMLMediaElement;
    try {
      media.pause();
    } catch {}
  });
}

export function MediaStopper() {
  const pathname = usePathname();

  // Stop media when the browser tab is switched away / window hidden or blurred
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

  // Stop media on in-app navigation too
  useEffect(() => {
    stopAllMedia();
    return () => stopAllMedia();
  }, [pathname]);

  return null;
}
