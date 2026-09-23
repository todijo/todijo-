"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function AdminSellerCjCategoryReview({ productId, initialCategory, options }: {
  productId: string;
  initialCategory: string;
  options: Array<{ id: string; label: string }>;
}) {
  const router = useRouter();
  const [category, setCategory] = useState(initialCategory);
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const visible = options.filter(option => option.id === category || (search && option.label.toLocaleLowerCase().includes(search.toLocaleLowerCase()))).slice(0, 21);
  async function approve() {
    if (!category || busy || !window.confirm("Confirm this canonical category and release the seller draft for normal publication checks?")) return;
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/admin/supplier-products/${encodeURIComponent(productId)}/review-seller-category`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ category }),
      });
      if (!response.ok) throw new Error("Category review failed");
      router.refresh();
    } catch { setError("Category review failed"); }
    finally { setBusy(false); }
  }
  return <div>
    <label>Find canonical category <input value={search} disabled={busy} onChange={event => setSearch(event.target.value)} /></label>
    <label>Canonical category <select value={category} disabled={busy} onChange={event => setCategory(event.target.value)}>
      <option value="">Select a category</option>
      {visible.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}
    </select></label>
    <button type="button" disabled={!category || busy} onClick={() => void approve()}>Approve category (keep draft)</button>
    {error && <p role="alert">{error}</p>}
  </div>;
}
