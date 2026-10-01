"use client";

import { useEffect, useRef, useState } from "react";

export default function MobileStartupArtwork() {
  const imageRef = useRef<HTMLImageElement>(null);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (!window.matchMedia("(max-width: 860px)").matches) {
      setVisible(false);
      return;
    }
    let cancelled = false;
    const image = imageRef.current;
    const dismiss = () => {
      if (!cancelled) setVisible(false);
    };
    const finishWhenReady = async () => {
      if (document.readyState !== "complete") {
        await new Promise<void>((resolve) => window.addEventListener("load", () => resolve(), { once: true }));
      }
      if (image?.decode) {
        try { await image.decode(); } catch { /* The loaded image can still paint when decode is unavailable. */ }
      }
      window.requestAnimationFrame(dismiss);
    };

    void finishWhenReady();
    return () => { cancelled = true; };
  }, []);

  if (!visible) return null;
  return (
    <div className="mobileStartupArtwork" aria-hidden="true" style={{position:"fixed",inset:0,overflow:"hidden"}}>
      <img
        ref={imageRef}
        src="/images/brand/todijo-pwa-startup.png?v=1"
        alt=""
        width="941"
        height="1672"
        style={{width:"100%",height:"100%",objectFit:"contain"}}
        draggable="false"
      />
    </div>
  );
}
