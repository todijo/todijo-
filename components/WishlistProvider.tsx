"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";

const STORAGE_PREFIX = "todijo-wishlist-v1";

type WishlistContextValue = { ids: string[]; ready: boolean; isSaved: (productId: string) => boolean; toggle: (productId: string) => boolean };
const WishlistContext = createContext<WishlistContextValue | null>(null);

function storageKey(userId: string | null) { return userId ? `${STORAGE_PREFIX}:user:${userId}` : `${STORAGE_PREFIX}:guest`; }
function readIds(key: string) {
  try { const value = JSON.parse(window.localStorage.getItem(key) ?? "[]") as unknown; return Array.isArray(value) ? [...new Set(value.filter((id): id is string => typeof id === "string" && id.length > 0))] : []; }
  catch { return []; }
}

export function WishlistProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "/";
  const [ids, setIds] = useState<string[]>([]);
  const [activeKey, setActiveKey] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setIds([]); setActiveKey(null);
    fetch("/api/auth/session", { cache: "no-store" }).then((response) => response.json()).then((session) => {
      if (!active) return;
      const userId = session.authenticated && typeof session.userId === "string" ? session.userId : null;
      const nextKey = storageKey(userId); setIds(readIds(nextKey)); setActiveKey(nextKey);
    }).catch(() => { if (active) { const nextKey = storageKey(null); setIds(readIds(nextKey)); setActiveKey(nextKey); } });
    return () => { active = false; };
  }, [pathname]);

  const value = useMemo<WishlistContextValue>(() => ({ ids, ready: activeKey !== null, isSaved: (productId) => ids.includes(productId), toggle: (productId) => {
    if (!activeKey) return false;
    const saved = ids.includes(productId);
    setIds((current) => {
      const next = current.includes(productId) ? current.filter((id) => id !== productId) : [...new Set([...current, productId])];
      window.localStorage.setItem(activeKey, JSON.stringify(next));
      return next;
    });
    return !saved;
  } }), [activeKey, ids]);
  return <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>;
}

export function useWishlist() { const context = useContext(WishlistContext); if (!context) throw new Error("useWishlist must be used inside WishlistProvider"); return context; }
