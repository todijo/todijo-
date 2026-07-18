"use client";

import { useEffect } from "react";

export default function LoginRedirect() {
  useEffect(() => {
    window.location.replace("/login");
  }, []);

  return (
    <main className="dashboardPage">
      <div className="dashboardCard">
        <p>Redirection vers la connexion…</p>
      </div>
    </main>
  );
}
