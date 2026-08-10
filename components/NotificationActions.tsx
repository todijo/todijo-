"use client";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
export function NotificationLink({ id, href, children }: { id: string; href: string; children: ReactNode }) { const router=useRouter(); async function open(){await fetch("/api/notifications/read",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({id})});router.push(href)} return <button type="button" className="notificationOpen" onClick={open}>{children}</button> }
export function MarkAllNotificationsRead(){const t=useTranslations("Notifications"),router=useRouter(),[busy,setBusy]=useState(false);async function markAll(){setBusy(true);const response=await fetch("/api/notifications/read",{method:"POST",headers:{"Content-Type":"application/json"},body:"{}"});setBusy(false);if(response.ok)router.refresh()}return <button type="button" className="notificationMarkAll" disabled={busy} onClick={markAll}>{busy?t("working"):t("markAllRead")}</button>}
