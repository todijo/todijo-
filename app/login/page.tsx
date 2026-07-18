"use client";
import { FormEvent, useState } from "react";

export default function LoginPage() {
  const [loading,setLoading]=useState(false);
  const [message,setMessage]=useState("");
  async function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault(); setLoading(true); setMessage("");
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: form.get("email"), password: form.get("password") }),
    });
    const data = await response.json();
    setLoading(false);
    if (!response.ok) return setMessage(data.error ?? "Connexion impossible.");
    window.location.assign("/dashboard");
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
        <div className="formField"><label htmlFor="email">Adresse e-mail</label><input id="email" name="email" type="email" autoComplete="email" placeholder="vous@exemple.com" required /></div>
        <div className="formField"><div className="passwordLine"><label htmlFor="password">Mot de passe</label><a href="#">Mot de passe oublié ?</a></div><input id="password" name="password" type="password" autoComplete="current-password" minLength={8} required /></div>
        {message&&<p className="authMessage">{message}</p>}
        <button className="authSubmit" type="submit" disabled={loading}>{loading?"Connexion…":"Se connecter"}</button>
      </form>
      <div className="authDivider">ou</div><button className="googleButton" type="button">G&nbsp;&nbsp; Continuer avec Google</button>
      <p className="authSwitch">Pas encore de compte ? <a href="/register">Créer un compte</a></p>
    </div></section>
  </main>;
}
