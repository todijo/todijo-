"use client";

import { useEffect, useState } from "react";
import TodijoUmbrellaMark from "@/components/TodijoUmbrellaMark";

const SESSION_KEY = "todijo-mobile-splash-seen-v1";
const FALLBACK_MS = 2950;

export default function TodijoLaunchSplash() {
  const [visible, setVisible] = useState(true);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mobile = window.matchMedia("(max-width: 860px)").matches;
    if (!mobile || window.sessionStorage.getItem(SESSION_KEY) === "1") { setVisible(false); return; }
    window.sessionStorage.setItem(SESSION_KEY, "1");
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setReducedMotion(reduced);
    const done = window.setTimeout(() => setVisible(false), reduced ? 280 : 2750);
    const fallback = window.setTimeout(() => setVisible(false), FALLBACK_MS);
    return () => { window.clearTimeout(done); window.clearTimeout(fallback); };
  }, []);

  if (!visible) return null;
  return <div className={`todijoLaunchSplash${reducedMotion ? " isReducedMotion" : ""}`} aria-hidden="true">
    <TodijoUmbrellaMark className="todijoLaunchMark" animated={!reducedMotion}/>
  </div>;
}
