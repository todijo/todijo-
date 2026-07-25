"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";

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
};

export type CartItem = CartProduct & { quantity: number };

type CartContextValue = {
  items: CartItem[];
  totalItems: number;
  subtotal: number;
  currency: string;
  addItem: (product: CartProduct, quantity?: number) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  removeItem: (productId: string) => void;
  clearCart: () => void;
};

const STORAGE_KEY = "todijo-cart-v1";
const CartContext = createContext<CartContextValue | null>(null);

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
          setItems(Array.isArray(parsed) ? parsed : []);
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
          const existing = current.find((item) => item.id === product.id);
          if (!existing) {
            return [...current, { ...product, quantity: Math.min(Math.max(quantity, 1), product.stock) }];
          }
          return current.map((item) =>
            item.id === product.id
              ? { ...item, quantity: Math.min(item.quantity + quantity, item.stock) }
              : item
          );
        });
      },
      updateQuantity(productId, quantity) {
        setItems((current) =>
          current
            .map((item) =>
              item.id === productId
                ? { ...item, quantity: Math.min(Math.max(quantity, 0), item.stock) }
                : item
            )
            .filter((item) => item.quantity > 0)
        );
      },
      removeItem(productId) {
        setItems((current) => current.filter((item) => item.id !== productId));
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
