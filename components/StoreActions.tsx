"use client";

import { useState } from "react";
import Icon from "@/components/ui/Icon";

type Props = { storeName: string; storeSlug: string };

export default function StoreActions({ storeName, storeSlug }: Props) {
  const [following, setFollowing] = useState(false);
  const [shared, setShared] = useState(false);

  async function shareStore() {
    const url = `${window.location.origin}/store/${storeSlug}`;
    try {
      if (navigator.share) await navigator.share({ title: storeName, text: `Découvrez ${storeName} sur Todijo`, url });
      else await navigator.clipboard.writeText(url);
      setShared(true);
      window.setTimeout(() => setShared(false), 1800);
    } catch {
      // A cancelled native share dialog is not an error for the user.
    }
  }

  return (
    <div className="storeHeroActions" aria-label="Actions de la boutique">
      <button className={`storeActionPrimary${following ? " isFollowing" : ""}`} type="button" onClick={() => setFollowing((value) => !value)} aria-pressed={following}>
        <Icon name="heart" size={18} />{following ? "Boutique suivie" : "Suivre la boutique"}
      </button>
      <a className="storeActionSecondary" href="#seller"><Icon name="message" size={18} />Contacter</a>
      <button className="storeActionIcon" type="button" onClick={shareStore} aria-label="Partager la boutique" title="Partager">
        <Icon name="share" size={19} /><span>{shared ? "Lien copié" : "Partager"}</span>
      </button>
    </div>
  );
}
