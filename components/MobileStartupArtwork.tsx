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
      if (!cancelled) window.requestAnimationFrame(() => {
        if (!cancelled) setVisible(false);
      });
    };

    if (document.readyState === "complete" || image?.complete) {
      dismiss();
      return () => { cancelled = true; };
    }

    window.addEventListener("load", dismiss, { once: true });
    image?.addEventListener("load", dismiss, { once: true });
    image?.addEventListener("error", dismiss, { once: true });

    return () => {
      cancelled = true;
      window.removeEventListener("load", dismiss);
      image?.removeEventListener("load", dismiss);
      image?.removeEventListener("error", dismiss);
    };
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
