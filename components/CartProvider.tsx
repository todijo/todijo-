"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

export type CartProduct = {
  id: string;
  name: string;
  price: number;
  currency: string;
  image?: string;
  stock: number;
  storeName?: string;
  storeSlug?: string;
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
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as CartItem[];
        if (Array.isArray(parsed)) setItems(parsed);
      }
    } catch {
      window.localStorage.removeItem(STORAGE_KEY);
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [hydrated, items]);

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
