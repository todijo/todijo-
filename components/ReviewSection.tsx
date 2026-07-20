"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type Review = { id: string; rating: number; title: string | null; body: string; sellerReply: string | null; createdAt: string; authorName: string; isOwn: boolean };
type Payload = { reviews: Review[]; summary: { average: number; count: number }; canReview: boolean; loggedIn: boolean };

export default function ReviewSection({ productId }: { productId: string }) {
  const [data, setData] = useState<Payload | null>(null);
  const [rating, setRating] = useState(5);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => { const r = await fetch(`/api/products/${productId}/reviews`, { cache: "no-store" }); if (r.ok) setData(await r.json()); }, [productId]);
  useEffect(() => { void load(); }, [load]);
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setNotice("");
    const r = await fetch(`/api/products/${productId}/reviews`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rating, title, body }) });
    const result = await r.json().catch(() => ({})); setBusy(false);
    if (!r.ok) return setNotice(result.error || "Impossible de publier l’avis.");
    setTitle(""); setBody(""); setRating(5); setNotice(result.pending ? "Avis envoyé en modération." : "Votre avis a été publié."); await load();
  }
  async function report(id: string) { const reason = window.prompt("Pourquoi signalez-vous cet avis ?"); if (!reason) return; const r = await fetch(`/api/reviews/${id}/report`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reason }) }); alert(r.ok ? "Signalement envoyé." : "Connexion requise ou signalement invalide."); }
  const summary = data?.summary || { average: 0, count: 0 };
  return <section className="reviewsSection" id="reviews">
    <div className="reviewsHeading"><div><p className="dashboardBadge">Avis clients vérifiés</p><h2>Ce qu’en pensent les acheteurs</h2></div><div className="ratingSummary"><strong>{summary.count ? summary.average.toFixed(1) : "—"}</strong><span>{summary.count ? `${"★".repeat(Math.round(summary.average))}${"☆".repeat(5-Math.round(summary.average))}` : "Aucun avis"}</span><small>{summary.count} avis vérifié{summary.count > 1 ? "s" : ""}</small></div></div>
    <div className="reviewsGrid">
      <div className="reviewForm">
        <h3>Donner votre avis</h3>
        {!data ? <p>Chargement…</p> : !data.loggedIn ? <><p>Connectez-vous pour vérifier votre achat.</p><Link className="primary" href={`/login?next=/product/${productId}%23reviews`}>Se connecter</Link></> : !data.canReview ? <div className="verifiedReviewLock"><span>✓</span><div><strong>Achat vérifié requis</strong><p>Un avis peut être publié après une commande payée de ce produit. Une seule note est autorisée par acheteur et par produit.</p></div></div> : <form onSubmit={submit}><label>Votre note<div className="starPicker">{[1,2,3,4,5].map(n=><button type="button" aria-label={`${n} étoile${n>1?"s":""}`} key={n} onClick={()=>setRating(n)} className={n<=rating?"active":""}>★</button>)}</div></label><label>Titre (facultatif)<input maxLength={120} value={title} onChange={e=>setTitle(e.target.value)} /></label><label>Votre commentaire<textarea minLength={10} maxLength={2000} value={body} onChange={e=>setBody(e.target.value)} required rows={5} /></label><button className="primary" disabled={busy} type="submit">{busy ? "Publication…" : "Publier l’avis"}</button>{notice&&<p className="formNotice">{notice}</p>}<small>Votre nom complet et votre e-mail ne sont jamais affichés.</small></form>}
      </div>
      <div className="reviewList">{!data ? <div className="noReviews"><p>Chargement des avis…</p></div> : data.reviews.length===0 ? <div className="noReviews"><span>☆</span><h3>Aucun avis vérifié</h3><p>Les futurs avis proviendront uniquement d’acheteurs ayant réellement commandé ce produit.</p></div> : data.reviews.map(r=><article key={r.id}><div><strong>{r.authorName} <em className="verifiedPurchaseBadge">✓ Achat vérifié</em></strong><span>{"★".repeat(r.rating)}{"☆".repeat(5-r.rating)}</span></div>{r.title&&<h4>{r.title}</h4>}<p>{r.body}</p><footer><small>{new Date(r.createdAt).toLocaleDateString("fr-FR")}</small>{!r.isOwn&&<button type="button" onClick={()=>report(r.id)}>Signaler</button>}</footer>{r.sellerReply&&<div className="sellerReviewReply"><strong>Réponse du vendeur</strong><p>{r.sellerReply}</p></div>}</article>)}</div>
    </div>
  </section>;
}
