"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { cartLineKey, normalizeCartOption, removePurchasedCartLines, type CartLineQuantity } from "@/lib/cart-line";

export type CartProduct = {
  id: string;
  name: string;
  price: number;
  currency: string;
  image?: string;
  stock: number;
  storeName?: string;
  storeSlug?: string;
  selectedOptions?: string;
  selectedColor?: string | null;
  selectedSize?: string | null;
  lineKey?: string;
};

export type CartItem = CartProduct & { quantity: number };

type CartContextValue = {
  items: CartItem[];
  totalItems: number;
  subtotal: number;
  currency: string;
  addItem: (product: CartProduct, quantity?: number) => void;
  updateQuantity: (lineKey: string, quantity: number) => void;
  removeItem: (lineKey: string) => void;
  clearCart: () => void;
};

const STORAGE_KEY = "todijo-cart-v1";
const PENDING_CHECKOUT_PREFIX = "todijo-pending-checkout:";
const CartContext = createContext<CartContextValue | null>(null);

type PendingCheckout = { requestId: string; lines: CartLineQuantity[] };

function pendingCheckouts() {
  return Object.keys(window.localStorage).flatMap((key) => {
    if (!key.startsWith(PENDING_CHECKOUT_PREFIX)) return [];
    try {
      const value = JSON.parse(window.localStorage.getItem(key) ?? "") as PendingCheckout;
      return typeof value.requestId === "string" && Array.isArray(value.lines) ? [{ key, value }] : [];
    } catch { return []; }
  });
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [storageKey, setStorageKey] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const storageKeyRef = useRef<string | null>(null);
  const pathname = usePathname();

  useEffect(() => {
    let active = true;
    fetch("/api/auth/session", { cache: "no-store" })
      .then((response) => response.json())
      .then((session) => {
        if (!active) return;
        const nextStorageKey = session.authenticated && typeof session.userId === "string"
          ? `${STORAGE_KEY}:${session.userId}`
          : STORAGE_KEY;
        if (nextStorageKey === storageKeyRef.current) return;
        try {
          const saved = window.localStorage.getItem(nextStorageKey);
          const parsed = saved ? JSON.parse(saved) as CartItem[] : [];
          setItems(Array.isArray(parsed) ? parsed.map((item) => ({ ...item, selectedColor: normalizeCartOption(item.selectedColor), selectedSize: normalizeCartOption(item.selectedSize), lineKey: item.lineKey ?? cartLineKey(item.id, item.selectedColor, item.selectedSize) })) : []);
        } catch {
          window.localStorage.removeItem(nextStorageKey);
          setItems([]);
        }
        storageKeyRef.current = nextStorageKey;
        setStorageKey(nextStorageKey);
        setHydrated(true);
      })
      .catch(() => {
        if (active) {
          setItems([]);
          storageKeyRef.current = null;
          setStorageKey(null);
          setHydrated(false);
        }
      });
    return () => {
      active = false;
    };
  }, [pathname]);

  useEffect(() => {
    if (!hydrated || !storageKey) return;
    window.localStorage.setItem(storageKey, JSON.stringify(items));
  }, [hydrated, items, storageKey]);

  useEffect(() => {
    if (!hydrated || !storageKey) return;
    let active = true;
    let retryTimer: number | undefined;
    let retryAttempts = 0;
    const reconcileCompletedCheckouts = async () => {
      let shouldRetry = false;
      for (const pending of pendingCheckouts()) {
        try {
          const response = await fetch(`/api/checkout?requestId=${encodeURIComponent(pending.value.requestId)}`, { cache: "no-store" });
          const result = await response.json() as { completed?: boolean };
          if (!response.ok || result.completed !== true) { shouldRetry = true; continue; }
          if (!active) return;
          setItems((current) => removePurchasedCartLines(current, pending.value.lines));
          window.localStorage.removeItem(pending.key);
        } catch { shouldRetry = true; }
      }
      if (active && shouldRetry && retryAttempts < 10) {
        retryAttempts += 1;
        retryTimer = window.setTimeout(() => void reconcileCompletedCheckouts(), 3000);
      }
    };
    void reconcileCompletedCheckouts();
    return () => { active = false; if (retryTimer) window.clearTimeout(retryTimer); };
  }, [hydrated, storageKey]);

  const value = useMemo<CartContextValue>(() => {
    const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
    const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const currency = items[0]?.currency ?? "EUR";

    return {
      items,
      totalItems,
      subtotal,
      currency,
      addItem(product, quantity = 1) {
        setItems((current) => {
          const lineKey = cartLineKey(product.id, product.selectedColor, product.selectedSize);
          const existing = current.find((item) => item.lineKey === lineKey);
          if (!existing) {
            return [...current, { ...product, selectedColor: normalizeCartOption(product.selectedColor), selectedSize: normalizeCartOption(product.selectedSize), lineKey, quantity: Math.min(Math.max(quantity, 1), product.stock) }];
          }
          return current.map((item) =>
            item.lineKey === lineKey
              ? { ...item, quantity: Math.min(item.quantity + quantity, item.stock) }
              : item
          );
        });
      },
      updateQuantity(lineKey, quantity) {
        setItems((current) =>
          current
            .map((item) =>
              item.lineKey === lineKey
                ? { ...item, quantity: Math.min(Math.max(quantity, 0), item.stock) }
                : item
            )
            .filter((item) => item.quantity > 0)
        );
      },
      removeItem(lineKey) {
        setItems((current) => current.filter((item) => item.lineKey !== lineKey));
      },
      clearCart() {
        setItems([]);
      },
    };
  }, [items]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart must be used inside CartProvider");
  return context;
}
