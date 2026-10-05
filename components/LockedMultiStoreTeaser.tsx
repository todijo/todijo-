import type { SellerMultiStoreTeaserCopy } from "@/i18n/seller-multi-store-teaser";

export default function LockedMultiStoreTeaser({ copy }: { copy: SellerMultiStoreTeaserCopy }) {
  return <section className="storeSetupCard lockedMultiStoreTeaser" aria-labelledby="locked-multi-store-title">
    <span className="sellerControlBadge tone-accent">{copy.badge}</span>
    <h2 id="locked-multi-store-title">{copy.title}</h2>
    <p>{copy.explanation}</p>
    <span className="sellerControlButton light" aria-disabled="true">{copy.informationalLabel}</span>
  </section>;
}
