"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { cartLineKey, normalizeCartOption, removePurchasedCartLines, type CartLineQuantity } from "@/lib/cart-line";
import {useBuyerMarket} from "@/components/BuyerMarketProvider";

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
  variantId?: string | null;
  lineKey?: string;
  freeShipping?: boolean;
  deliveryMinDays?: number | null;
  deliveryMaxDays?: number | null;
  shippingPrice?: number | null;
  shippingFreeThreshold?: number | null;
  shippingMethodName?: string | null;
  requiresAuthoritativePrice?: boolean;
  authoritativePrice?: boolean;
  pricingFailed?: boolean;
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
  updateDisplayPricing: (updates: Array<{lineKey:string;price:number;currency:string;freeShipping?:boolean;deliveryMinDays?:number|null;deliveryMaxDays?:number|null}>) => void;
  retryPricing: (lineKey: string) => void;
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
  const market=useBuyerMarket();
  const [items, setItems] = useState<CartItem[]>([]);
  const [storageKey, setStorageKey] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [pricingRetry, setPricingRetry] = useState(0);
  const storageKeyRef = useRef<string | null>(null);
  const itemsRef=useRef(items);itemsRef.current=items;
  const pricingLineSignature = items.map(item => `${item.lineKey ?? item.id}:${item.variantId ?? ""}:${item.quantity}`).join("|");
  const ordinaryCurrencyRef=useRef<string|null>(null);
  const pathname = usePathname() ?? "/";
  const clearCart = useCallback(() => setItems([]), []);

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
          setItems(Array.isArray(parsed) ? parsed.map((item) => ({ ...item, selectedColor: normalizeCartOption(item.selectedColor), selectedSize: normalizeCartOption(item.selectedSize), variantId: normalizeCartOption(item.variantId), lineKey: cartLineKey(item.id, item.selectedColor, item.selectedSize, item.variantId) })) : []);
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

  useEffect(() => {
    const snapshot = itemsRef.current;
    if (!hydrated || !snapshot.length || !market.ready) return;
    let active = true;
    const normal = snapshot.filter(item => !item.requiresAuthoritativePrice);
    const refreshNormal = ordinaryCurrencyRef.current !== market.currency || normal.some(item => item.authoritativePrice === false);
    ordinaryCurrencyRef.current = market.currency;
    const unresolved = snapshot.filter(item => item.requiresAuthoritativePrice || refreshNormal && !item.requiresAuthoritativePrice || item.authoritativePrice === false);
    setItems(current => current.map(item => unresolved.some(line => line.lineKey === item.lineKey) ? { ...item, authoritativePrice: false, pricingFailed: false } : item));
    void (async () => {
      const updates: Array<{lineKey:string;price:number;currency:string;freeShipping?:boolean;deliveryMinDays?:number|null;deliveryMaxDays?:number|null}> = [];
      const failed = new Set<string>();
      if (normal.length && refreshNormal) {
        try {
          const response = await fetch("/api/products/buyer-pricing", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ currency: market.currency, items: normal.map(item => ({ productId: item.id, variantId: item.variantId })) }), signal: AbortSignal.timeout(15_000) });
          const data = await response.json() as { prices?: Array<{productId:string;variantId:string|null;amount:string;currency:string}> };
          for (const item of normal) {
            const price = data.prices?.find(value => value.productId === item.id && value.variantId === (item.variantId ?? null));
            if (response.ok && price && Number.isFinite(Number(price.amount))) updates.push({ lineKey:item.lineKey!, price:Number(price.amount), currency:price.currency });
            else failed.add(item.lineKey!);
          }
        } catch { for (const item of normal) failed.add(item.lineKey!); }
      }
      for (const item of snapshot.filter(value => value.requiresAuthoritativePrice)) {
        if (!item.variantId) { failed.add(item.lineKey!); continue; }
        try {
          const response = await fetch(`/api/products/${encodeURIComponent(item.id)}/dropshipping-pricing`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ variantId:item.variantId, quantity:item.quantity, destinationCountry:market.country, buyerCurrency:market.currency }), cache:"no-store", signal:AbortSignal.timeout(15_000) });
          const data = await response.json() as {buyerUnitPrice?:string;buyerCurrency?:string;freeShipping?:boolean;deliveryMinDays?:number|null;deliveryMaxDays?:number|null};
          if (response.ok && data.buyerUnitPrice && data.buyerCurrency && Number.isFinite(Number(data.buyerUnitPrice))) updates.push({ lineKey:item.lineKey!, price:Number(data.buyerUnitPrice), currency:data.buyerCurrency, freeShipping:data.freeShipping, deliveryMinDays:data.deliveryMinDays, deliveryMaxDays:data.deliveryMaxDays });
          else failed.add(item.lineKey!);
        } catch { failed.add(item.lineKey!); }
      }
      if (!active) return;
      const byLine = new Map(updates.map(update => [update.lineKey, update]));
      setItems(current => current.map(item => {
        const update = byLine.get(item.lineKey ?? "");
        if (update) return { ...item, ...update, authoritativePrice:true, pricingFailed:false };
        if (failed.has(item.lineKey ?? "")) return { ...item, authoritativePrice:false, pricingFailed:true };
        return item;
      }));
    })();
    return () => { active = false; };
  }, [hydrated, market.country, market.currency, market.ready, pricingRetry, pricingLineSignature]);

  const value = useMemo<CartContextValue>(() => {
    const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
    const subtotal = items.reduce((sum, item) => sum + (item.authoritativePrice===false?0:item.price * item.quantity), 0);
    const currency = items[0]?.currency ?? "EUR";

    return {
      items,
      totalItems,
      subtotal,
      currency,
      addItem(product, quantity = 1) {
        setItems((current) => {
          const lineKey = cartLineKey(product.id, product.selectedColor, product.selectedSize, product.variantId);
          const existing = current.find((item) => item.lineKey === lineKey);
          if (!existing) {
            return [...current, { ...product, selectedColor: normalizeCartOption(product.selectedColor), selectedSize: normalizeCartOption(product.selectedSize), variantId: normalizeCartOption(product.variantId), lineKey, quantity: Math.min(Math.max(quantity, 1), product.stock) }];
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
      updateDisplayPricing(updates) {
        const byLine=new Map(updates.map(update=>[update.lineKey,update]));
        setItems(current=>{let changed=false;const next=current.map(item=>{const update=byLine.get(item.lineKey??"");if(!update)return item;if(item.price===update.price&&item.currency===update.currency&&item.freeShipping===update.freeShipping&&item.deliveryMinDays===update.deliveryMinDays&&item.deliveryMaxDays===update.deliveryMaxDays&&item.authoritativePrice===true&&!item.pricingFailed)return item;changed=true;return{...item,price:update.price,currency:update.currency,authoritativePrice:true,pricingFailed:false,freeShipping:update.freeShipping,deliveryMinDays:update.deliveryMinDays,deliveryMaxDays:update.deliveryMaxDays};});return changed?next:current;});
      },
      retryPricing(lineKey) { setItems(current => current.map(item => item.lineKey === lineKey ? { ...item, authoritativePrice:false, pricingFailed:false } : item)); setPricingRetry(value => value + 1); },
      clearCart,
    };
  }, [clearCart, items]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart must be used inside CartProvider");
  return context;
}
