"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

export default function AdminModerationAction({ reportId }: { reportId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const action = String(form.get("action"));
    if (action === "UNPUBLISH" && !window.confirm("Hide this listing from all public surfaces?")) return;
    setBusy(true); setMessage("");
    const response = await fetch(`/api/admin/moderation/product-reports/${reportId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(Object.fromEntries(form.entries())) });
    setBusy(false); setMessage(response.ok ? "Moderation decision saved." : "The decision could not be saved.");
    if (response.ok) router.refresh();
  }
  return <form className="adminForm moderationAction" onSubmit={submit}>
    <label>Status<select name="status" defaultValue="UNDER_REVIEW"><option value="UNDER_REVIEW">Under review</option><option value="RESOLVED">Resolved</option><option value="DISMISSED">Dismissed</option></select></label>
    <label>Action<select name="action" defaultValue="NONE"><option value="NONE">No listing action</option><option value="UNPUBLISH">Hide / unpublish listing</option></select></label>
    <label>Internal decision note<textarea name="note" maxLength={1000} rows={2}/></label>
    <button disabled={busy}>{busy ? "Saving…" : "Save decision"}</button>{message && <small role="status">{message}</small>}
  </form>;
}
