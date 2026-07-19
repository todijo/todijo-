"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export type CartProduct = {
  id: string;
  name: string;
  price: number;
  currency: string;
  image?: string;
  stock: number;
  storeName: string;
  storeSlug: string;
};

export type CartItem = CartProduct & { quantity: number };

type CartContextValue = {
  items: CartItem[];
  itemCount: number;
  isReady: boolean;
  addItem: (product: CartProduct, quantity?: number) => void;
  removeItem: (productId: string) => void;
  setQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
};

const STORAGE_KEY = "todijo-cart-v1";
const CartContext = createContext<CartContextValue | null>(null);

function normalizeItems(value: unknown): CartItem[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((candidate) => {
    if (!candidate || typeof candidate !== "object") return [];
    const item = candidate as Partial<CartItem>;
    if (
      typeof item.id !== "string" ||
      typeof item.name !== "string" ||
      typeof item.price !== "number" ||
      typeof item.currency !== "string" ||
      typeof item.stock !== "number" ||
      typeof item.storeName !== "string" ||
      typeof item.storeSlug !== "string"
    ) return [];

    const max = Math.max(1, Math.floor(item.stock));
    const quantity = Math.min(max, Math.max(1, Math.floor(item.quantity ?? 1)));
    return [{ ...item, quantity } as CartItem];
  });
}

export default function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) setItems(normalizeItems(JSON.parse(saved)));
    } catch {
      window.localStorage.removeItem(STORAGE_KEY);
    } finally {
      setIsReady(true);
    }
  }, []);

  useEffect(() => {
    if (!isReady) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items, isReady]);

  const addItem = useCallback((product: CartProduct, quantity = 1) => {
    setItems((current) => {
      const existing = current.find((item) => item.id === product.id);
      const safeQuantity = Math.max(1, Math.floor(quantity));

      if (existing) {
        return current.map((item) =>
          item.id === product.id
            ? { ...item, ...product, quantity: Math.min(product.stock, item.quantity + safeQuantity) }
            : item,
        );
      }

      return [...current, { ...product, quantity: Math.min(product.stock, safeQuantity) }];
    });
  }, []);

  const removeItem = useCallback((productId: string) => {
    setItems((current) => current.filter((item) => item.id !== productId));
  }, []);

  const setQuantity = useCallback((productId: string, quantity: number) => {
    setItems((current) => current.map((item) => {
      if (item.id !== productId) return item;
      return { ...item, quantity: Math.min(item.stock, Math.max(1, Math.floor(quantity))) };
    }));
  }, []);

  const clearCart = useCallback(() => setItems([]), []);
  const itemCount = useMemo(() => items.reduce((total, item) => total + item.quantity, 0), [items]);
  const value = useMemo(
    () => ({ items, itemCount, isReady, addItem, removeItem, setQuantity, clearCart }),
    [items, itemCount, isReady, addItem, removeItem, setQuantity, clearCart],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const value = useContext(CartContext);
  if (!value) throw new Error("useCart must be used inside CartProvider");
  return value;
}
