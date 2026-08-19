# CJ ↔ Todijo canonical taxonomy coverage

## Architecture

Todijo does not mirror CJ's category count or hierarchy. CJ supplier category identity is treated as authoritative supplier metadata and resolved into Todijo's canonical buyer-facing taxonomy.

Resolution order:

1. Admin-reviewed canonical override when present.
2. Authoritative CJ category hierarchy resolution by CJ category ID/path.
3. Curated structural mapping from the resolved CJ path to an existing Todijo canonical leaf.
4. Conservative text classifier fallback only when no deterministic supplier-taxonomy mapping exists.
5. Review-required when the supplier hierarchy is generic, unsupported, ambiguous, or low-confidence.

Preview and durable import both use the centralized authoritative classification path (`classifyCjProductAuthoritatively`), so category decisions are not intentionally duplicated between those flows.

## CJ hierarchy fields supported by the normalized snapshot contract

- `categoryId` / `categoryName`
- `firstCategoryId` / `firstCategoryName`
- `secondCategoryId` / `secondCategoryName`
- `thirdCategoryId` / `thirdCategoryName`

When the product payload supplies these hierarchy fields, the snapshot contract can preserve them directly. Independently, the authoritative resolver can reconstruct the CJ first/second/third category path from the product's CJ category ID through CJ's category endpoint and cache that tree for bounded reuse.

## Representative coverage

| CJ evidence | Todijo canonical destination | Method |
| --- | --- | --- |
| Men Sports Watches | `jewelry--men-watches--montres-de-sport-pour-homme` | authoritative hierarchy mapping |
| Men Boots | `bags-shoes--men-shoes--bottes-pour-homme` | authoritative hierarchy mapping |
| Men Formal Shoes | `bags-shoes--men-shoes--chaussures-formelles` | authoritative hierarchy mapping |
| Women Handbags | `bags-shoes--women-bags--sac-a-main` | authoritative hierarchy mapping |
| Baby Rompers | `kids--baby--barboteuses-de-bebe` | authoritative hierarchy mapping |
| Baby Clothing Sets | `kids--baby--ensembles-de-vetements-pour-bebe` | authoritative hierarchy mapping |
| Car Stickers / Decals | automotive exterior parts | authoritative hierarchy mapping |
| DVR / Dash Camera | automotive electronics / dash camera | authoritative hierarchy mapping |

## Deliberately review-required examples

Generic CJ hierarchy values such as `Men Shoes`, `Women Shoes`, `Car Accessories`, or generic `Baby Clothing` do not justify a specific Todijo leaf. These remain review-required unless stronger authoritative metadata or a sufficiently specific safe fallback exists.

This prevents earlier failure modes such as generic shoes being fabricated as vulcanized shoes or insoles.

## Safety invariants

- Imported supplier products remain `DRAFT`.
- Low-confidence or unmapped products remain review-required/quarantined.
- Classification does not bypass compliance, pricing, stock, fulfillment, rate limiting, idempotency, or admin checks.
- CJ automatic fulfillment remains independently gated.
