"use client";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { supportStatuses } from "@/lib/support-request";

export default function AdminSupportRequestAction({ requestId, status }: { requestId: string; status: string }) {
  const t = useTranslations("HelpCenter"), router = useRouter(); const [busy,setBusy]=useState(false);
  async function submit(event:FormEvent<HTMLFormElement>){event.preventDefault();setBusy(true);const body=Object.fromEntries(new FormData(event.currentTarget));const response=await fetch(`/api/admin/support-requests/${requestId}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});setBusy(false);if(response.ok)router.refresh();}
  return <form className="adminForm" onSubmit={submit}><select name="status" defaultValue={status}>{supportStatuses.map(value=><option key={value}>{value}</option>)}</select><label>{t("note")}<textarea name="note" maxLength={1500}/></label><button disabled={busy}>{t("save")}</button></form>;
}
