"use client";

import { useEffect, useRef } from "react";

const STARTUP_CLASS = "todijoStandaloneLaunch";

export default function PwaStartupLayer() {
  const layerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const root = document.documentElement;
    const layer = layerRef.current;
    const image = imageRef.current;
    if (!layer || !image || !root.classList.contains(STARTUP_CLASS)) return;

    let cancelled = false;
    let firstFrame = 0;
    let secondFrame = 0;
    let stopWaitingForImage = () => {};
    const finish = () => {
      layer.hidden = true;
      root.classList.remove(STARTUP_CLASS);
    };
    const onTransitionEnd = (event: TransitionEvent) => {
      if (event.target === layer && event.propertyName === "opacity") finish();
    };

    const startExit = async () => {
      if (!image.complete) {
        await new Promise<void>((resolve) => {
          const done = () => { stopWaitingForImage(); resolve(); };
          stopWaitingForImage = () => {
            image.removeEventListener("load", done);
            image.removeEventListener("error", done);
          };
          image.addEventListener("load", done, { once: true });
          image.addEventListener("error", done, { once: true });
        });
      }
      if (cancelled) return;
      if (image.naturalWidth > 0) {
        try { await image.decode(); } catch { /* A loaded image can still paint when decode is unavailable. */ }
      }
      if (cancelled) return;

      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        firstFrame = window.requestAnimationFrame(finish);
        return;
      }
      layer.addEventListener("transitionend", onTransitionEnd);
      firstFrame = window.requestAnimationFrame(() => {
        secondFrame = window.requestAnimationFrame(() => layer.classList.add("isExiting"));
      });
    };
    void startExit();

    return () => {
      cancelled = true;
      stopWaitingForImage();
      window.cancelAnimationFrame(firstFrame);
      window.cancelAnimationFrame(secondFrame);
      layer.removeEventListener("transitionend", onTransitionEnd);
    };
  }, []);

  return (
    <div ref={layerRef} className="pwaStartupLayer" aria-hidden="true">
      <picture className="pwaStartupArtwork">
        <source media="(display-mode: standalone)" srcSet="/images/brand/todijo-pwa-startup.png?v=1" />
        <img
          ref={imageRef}
          src="data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs="
          alt=""
          width="941"
          height="1672"
          loading="eager"
          fetchPriority="high"
          draggable="false"
        />
      </picture>
    </div>
  );
}
