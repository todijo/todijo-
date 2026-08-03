"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AlertCircle, CheckCircle2, Info, TriangleAlert, X } from "lucide-react";
import { useTranslations } from "next-intl";

export type ToastTone = "success" | "warning" | "error" | "info";
type ToastInput = { message: string; tone?: ToastTone; duration?: number };
type ToastItem = ToastInput & { id: number; tone: ToastTone };

const FLASH_KEY = "todijo-toast-v1";
const ToastContext = createContext<{ showToast: (toast: ToastInput) => void } | null>(null);

export function queueToast(toast: ToastInput) {
  try { sessionStorage.setItem(FLASH_KEY, JSON.stringify(toast)); } catch {}
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const dashboard = useTranslations("DashboardPremium");
  const product = useTranslations("Product");
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(0);
  const dismiss = useCallback((id: number) => setToasts((items) => items.filter((item) => item.id !== id)), []);
  const showToast = useCallback((toast: ToastInput) => {
    const message = toast.message.trim();
    if (!message) return;
    setToasts((items) => {
      if (items.some((item) => item.message === message && item.tone === (toast.tone ?? "info"))) return items;
      return [...items.slice(-2), { ...toast, message, tone: toast.tone ?? "info", id: ++nextId.current }];
    });
  }, []);

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(FLASH_KEY);
      if (saved) { sessionStorage.removeItem(FLASH_KEY); showToast(JSON.parse(saved) as ToastInput); }
    } catch {}
  }, [showToast]);

  return <ToastContext.Provider value={useMemo(() => ({ showToast }), [showToast])}>
    {children}
    <section className="toastViewport" aria-label={dashboard("notifications")}>
      {toasts.map((toast) => <ToastCard key={toast.id} toast={toast} dismiss={dismiss} dismissLabel={product("close")}/>) }
    </section>
  </ToastContext.Provider>;
}

function ToastCard({ toast, dismiss, dismissLabel }: { toast: ToastItem; dismiss: (id: number) => void; dismissLabel: string }) {
  const Icon = toast.tone === "success" ? CheckCircle2 : toast.tone === "warning" ? TriangleAlert : toast.tone === "error" ? AlertCircle : Info;
  useEffect(() => {
    const timer = window.setTimeout(() => dismiss(toast.id), toast.duration ?? (toast.tone === "error" ? 7000 : 4500));
    return () => window.clearTimeout(timer);
  }, [dismiss, toast.duration, toast.id, toast.tone]);
  return <article className={`toastCard is-${toast.tone}`} role={toast.tone === "error" ? "alert" : "status"} aria-live={toast.tone === "error" ? "assertive" : "polite"}>
    <Icon size={21} aria-hidden="true"/><p>{toast.message}</p>
    <button type="button" onClick={() => dismiss(toast.id)} aria-label={dismissLabel}><X size={18} aria-hidden="true"/></button>
  </article>;
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used inside ToastProvider");
  return context;
}
