"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useLocale } from "next-intl";
import { useToast } from "./ToastProvider";

type Review = { id: string; rating: number; title: string | null; body: string; sellerReply: string | null; createdAt: string; authorName: string; isOwn: boolean };
type Payload = { reviews: Review[]; summary: { average: number; count: number }; canReview: boolean; loggedIn: boolean };

export default function ReviewSection({ productId }: { productId: string }) {
  const locale = useLocale();
  const { showToast } = useToast();
  const [data, setData] = useState<Payload | null>(null);
  const [rating, setRating] = useState(5);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const load = useCallback(async () => {
    setLoadError(false);
    try {
      const response = await fetch(`/api/products/${productId}/reviews`, { cache: "no-store" });
      if (!response.ok) throw new Error();
      setData(await response.json());
    } catch { setLoadError(true); }
  }, [productId]);
  useEffect(() => { void load(); }, [load]);

  async function submit(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setNotice("");
    try {
      const response = await fetch(`/api/products/${productId}/reviews`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rating, title, body }) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) { const text = result.error || "Impossible de publier l’avis. Réessayez."; setNotice(text); showToast({ message: text, tone: "error" }); return; }
      const text = result.pending ? "Avis envoyé en modération." : "Votre avis a été publié.";
      setTitle(""); setBody(""); setRating(5); setNotice(text); showToast({ message: text, tone: "success" }); await load();
    } catch { const text = "Impossible de publier l’avis. Vérifiez votre connexion."; setNotice(text); showToast({ message: text, tone: "error" }); }
    finally { setBusy(false); }
  }

  async function report(id: string) {
    const reason = window.prompt("Pourquoi signalez-vous cet avis ?"); if (!reason) return;
    try { const response = await fetch(`/api/reviews/${id}/report`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reason }) }); showToast({ message: response.ok ? "Signalement envoyé." : "Connexion requise ou signalement invalide.", tone: response.ok ? "success" : "error" }); }
    catch { showToast({ message: "Le signalement n’a pas pu être envoyé.", tone: "error" }); }
  }

  const summary = data?.summary || { average: 0, count: 0 };
  const skeleton = <div className="reviewSkeleton" role="status" aria-live="polite"><span className="srOnly">Chargement des avis</span><i/><i/><i/></div>;
  return <section className="reviewsSection" id="reviews">
    <div className="reviewsHeading"><div><p className="dashboardBadge">Avis clients vérifiés</p><h2>Ce qu’en pensent les acheteurs</h2></div><div className="ratingSummary"><strong>{summary.count ? summary.average.toFixed(1) : "—"}</strong><span>{summary.count ? `${"★".repeat(Math.round(summary.average))}${"☆".repeat(5-Math.round(summary.average))}` : "Aucun avis"}</span><small>{summary.count} avis vérifié{summary.count > 1 ? "s" : ""}</small></div></div>
    <div className="reviewsGrid">
      <div className="reviewForm"><h3>Donner votre avis</h3>
        {loadError ? <div className="reviewLoadError" role="alert"><p>Les avis ne sont pas disponibles pour le moment.</p><button type="button" onClick={() => void load()}>Réessayer</button></div> : !data ? skeleton : !data.loggedIn ? <><p>Connectez-vous pour vérifier votre achat.</p><Link className="primary" href={`/${locale}/login?next=/${locale}/product/${productId}%23reviews`}>Se connecter</Link></> : !data.canReview ? <div className="verifiedReviewLock"><span>✓</span><div><strong>Achat vérifié requis</strong><p>Un avis peut être publié après une commande payée de ce produit. Une seule note est autorisée par acheteur et par produit.</p></div></div> : <form onSubmit={submit} aria-busy={busy}><label>Votre note<div className="starPicker">{[1,2,3,4,5].map((value)=><button type="button" aria-label={`${value} étoile${value>1?"s":""}`} key={value} onClick={()=>setRating(value)} className={value<=rating?"active":""}>★</button>)}</div></label><label>Titre (facultatif)<input maxLength={120} value={title} onChange={(event)=>setTitle(event.target.value)}/></label><label>Votre commentaire<textarea minLength={10} maxLength={2000} value={body} onChange={(event)=>setBody(event.target.value)} required rows={5}/></label><button className="primary" disabled={busy} aria-busy={busy} type="submit">{busy ? "Publication…" : "Publier l’avis"}</button>{notice&&<p className="formNotice" role="status">{notice}</p>}<small>Votre nom complet et votre e-mail ne sont jamais affichés.</small></form>}
      </div>
      <div className="reviewList">{loadError ? <div className="noReviews"><p>Réessayez pour afficher les avis.</p></div> : !data ? skeleton : data.reviews.length===0 ? <div className="noReviews"><span>☆</span><h3>Aucun avis vérifié</h3><p>Les futurs avis proviendront uniquement d’acheteurs ayant réellement commandé ce produit.</p><Link className="primary" href={`/${locale}`}>Découvrir d’autres produits</Link></div> : data.reviews.map((review)=><article key={review.id}><div><strong>{review.authorName} <em className="verifiedPurchaseBadge">✓ Achat vérifié</em></strong><span>{"★".repeat(review.rating)}{"☆".repeat(5-review.rating)}</span></div>{review.title&&<h4>{review.title}</h4>}<p>{review.body}</p><footer><small>{new Date(review.createdAt).toLocaleDateString(locale)}</small>{!review.isOwn&&<button type="button" onClick={()=>report(review.id)}>Signaler</button>}</footer>{review.sellerReply&&<div className="sellerReviewReply"><strong>Réponse du vendeur</strong><p>{review.sellerReply}</p></div>}</article>)}</div>
    </div>
  </section>;
}
