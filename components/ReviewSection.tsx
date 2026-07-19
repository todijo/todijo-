"use client";

import { useEffect, useMemo, useState } from "react";
type Review = { id: string; name: string; rating: number; comment: string; date: string };
export default function ReviewSection({ productId }: { productId: string }) {
  const key = `todijo-reviews-${productId}`;
  const [reviews, setReviews] = useState<Review[]>([]);
  const [name, setName] = useState(""); const [comment, setComment] = useState(""); const [rating, setRating] = useState(5);
  useEffect(() => { try { setReviews(JSON.parse(localStorage.getItem(key) || "[]")); } catch {} }, [key]);
  const average = useMemo(() => reviews.length ? reviews.reduce((s,r)=>s+r.rating,0)/reviews.length : 0, [reviews]);
  function submit(e: React.FormEvent) { e.preventDefault(); if (!name.trim() || !comment.trim()) return; const next=[{id:crypto.randomUUID(),name:name.trim(),comment:comment.trim(),rating,date:new Date().toLocaleDateString("fr-FR")},...reviews]; setReviews(next); localStorage.setItem(key,JSON.stringify(next)); setName(""); setComment(""); setRating(5); }
  return <section className="reviewsSection" id="reviews">
    <div className="reviewsHeading"><div><p className="dashboardBadge">Avis clients</p><h2>Ce qu’en pensent les acheteurs</h2></div><div className="ratingSummary"><strong>{reviews.length ? average.toFixed(1) : "—"}</strong><span>{reviews.length ? "★★★★★" : "Aucun avis"}</span><small>{reviews.length} avis</small></div></div>
    <div className="reviewsGrid">
      <form className="reviewForm" onSubmit={submit}><h3>Donner votre avis</h3><label>Votre note<div className="starPicker">{[1,2,3,4,5].map(n=><button type="button" key={n} onClick={()=>setRating(n)} className={n<=rating?"active":""}>★</button>)}</div></label><label>Votre nom<input value={name} onChange={e=>setName(e.target.value)} required /></label><label>Votre commentaire<textarea value={comment} onChange={e=>setComment(e.target.value)} required rows={4} /></label><button className="primary" type="submit">Publier l’avis</button><small>Les avis sont enregistrés sur cet appareil dans cette première version.</small></form>
      <div className="reviewList">{reviews.length===0?<div className="noReviews"><span>☆</span><h3>Soyez le premier à donner votre avis</h3><p>Partagez votre expérience avec la communauté Todijo.</p></div>:reviews.map(r=><article key={r.id}><div><strong>{r.name}</strong><span>{"★".repeat(r.rating)}{"☆".repeat(5-r.rating)}</span></div><p>{r.comment}</p><small>{r.date}</small></article>)}</div>
    </div>
  </section>;
}
