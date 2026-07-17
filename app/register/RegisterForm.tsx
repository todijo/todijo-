"use client";
import { FormEvent, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

export default function RegisterForm(){
  const params=useSearchParams();
  const [role,setRole]=useState<"customer"|"seller">("customer");
  const [loading,setLoading]=useState(false);
  const [message,setMessage]=useState("");
  useEffect(()=>{if(params.get("role")==="seller")setRole("seller");},[params]);
  function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault();setLoading(true);setMessage("");
    setTimeout(()=>{setLoading(false);setMessage("فۆڕمی هەژمار دروستکردن ئامادەیە. هەنگاوی داهاتوو: PostgreSQL و پشتڕاستکردنەوەی ئیمەیل.");},650);
  }
  return <main className="authPage">
    <section className="authBrand"><a className="authLogo" href="/">Todijo<span>.</span></a>
      <div className="authPitch"><h1>Créez votre compte.</h1><p>Rejoignez Todijo comme acheteur ou lancez votre propre boutique en ligne.</p>
        <div className="authBenefits"><div className="authBenefit"><i>✓</i> Inscription rapide</div><div className="authBenefit"><i>✓</i> Boutique vendeur personnalisée</div><div className="authBenefit"><i>✓</i> Marketplace internationale</div></div>
      </div><small>© 2026 Todijo</small>
    </section>
    <section className="authPanel"><div className="authBox">
      <a className="authBack" href="/">← Retour à l’accueil</a><h2>Créer un compte</h2><p className="authIntro">Choisissez votre type de compte et complétez vos informations.</p>
      <form className="authForm" onSubmit={submit}>
        <div className="roleOptions">
          <label className="roleCard"><input type="radio" name="role" checked={role==="customer"} onChange={()=>setRole("customer")} /><strong>🛍️ Acheteur</strong><span>Découvrir et acheter des produits.</span></label>
          <label className="roleCard"><input type="radio" name="role" checked={role==="seller"} onChange={()=>setRole("seller")} /><strong>🏪 Vendeur</strong><span>Créer une boutique et vendre.</span></label>
        </div>
        <div className="formRow"><div className="formField"><label htmlFor="firstName">Prénom</label><input id="firstName" autoComplete="given-name" required /></div><div className="formField"><label htmlFor="lastName">Nom</label><input id="lastName" autoComplete="family-name" required /></div></div>
        <div className="formField"><label htmlFor="email">Adresse e-mail</label><input id="email" type="email" autoComplete="email" placeholder="vous@exemple.com" required /></div>
        {role==="seller"&&<div className="formField"><label htmlFor="storeName">Nom de la boutique</label><input id="storeName" placeholder="Ma boutique Todijo" required /></div>}
        <div className="formField"><label htmlFor="password">Mot de passe</label><input id="password" type="password" autoComplete="new-password" minLength={8} required /></div>
        <label className="terms"><input type="checkbox" required /><span>J’accepte les conditions d’utilisation et la politique de confidentialité de Todijo.</span></label>
        {message&&<p className="authMessage">{message}</p>}
        <button className="authSubmit" type="submit" disabled={loading}>{loading?"Création…":role==="seller"?"Créer ma boutique":"Créer mon compte"}</button>
      </form>
      <p className="authSwitch">Vous avez déjà un compte ? <a href="/login">Se connecter</a></p>
    </div></section>
  </main>;
}
