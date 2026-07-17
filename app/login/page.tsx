"use client";
import { FormEvent, useState } from "react";

export default function LoginPage() {
  const [loading,setLoading]=useState(false);
  const [message,setMessage]=useState("");
  function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault(); setLoading(true); setMessage("");
    setTimeout(()=>{setLoading(false);setMessage("پەڕەی چوونەژوورەوە ئامادەیە. هەنگاوی داهاتوو پەیوەستکردنی بە داتابەیسە.");},650);
  }
  return <main className="authPage">
    <section className="authBrand">
      <a className="authLogo" href="/">Todijo<span>.</span></a>
      <div className="authPitch"><h1>Bienvenue sur Todijo.</h1><p>Achetez, vendez et gérez votre boutique depuis un seul compte sécurisé.</p>
        <div className="authBenefits"><div className="authBenefit"><i>✓</i> Un compte pour acheter et vendre</div><div className="authBenefit"><i>✓</i> Gestion simple de votre boutique</div><div className="authBenefit"><i>✓</i> Paiements et données protégés</div></div>
      </div><small>© 2026 Todijo</small>
    </section>
    <section className="authPanel"><div className="authBox">
      <a className="authBack" href="/">← Retour à l’accueil</a><h2>Se connecter</h2><p className="authIntro">Entrez vos informations pour accéder à votre compte.</p>
      <form className="authForm" onSubmit={submit}>
        <div className="formField"><label htmlFor="email">Adresse e-mail</label><input id="email" type="email" autoComplete="email" placeholder="vous@exemple.com" required /></div>
        <div className="formField"><div className="passwordLine"><label htmlFor="password">Mot de passe</label><a href="#">Mot de passe oublié ?</a></div><input id="password" type="password" autoComplete="current-password" minLength={8} required /></div>
        {message&&<p className="authMessage">{message}</p>}
        <button className="authSubmit" type="submit" disabled={loading}>{loading?"Connexion…":"Se connecter"}</button>
      </form>
      <div className="authDivider">ou</div><button className="googleButton" type="button">G&nbsp;&nbsp; Continuer avec Google</button>
      <p className="authSwitch">Pas encore de compte ? <a href="/register">Créer un compte</a></p>
    </div></section>
  </main>;
}
