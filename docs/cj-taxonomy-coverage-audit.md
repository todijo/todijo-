# CJ ↔ Todijo canonical taxonomy coverage

## Architecture

Todijo does not mirror CJ's category count or hierarchy. CJ supplier category identity is preserved as authoritative metadata and resolved into Todijo's canonical buyer-facing taxonomy.

Resolution order:

1. Admin-reviewed canonical override.
2. Exact CJ hierarchy signal: canonical ID, unique canonical leaf label, or curated supplier-name mapping.
3. High-confidence text classifier fallback.
4. Review-required when the supplier hierarchy is generic, unsupported, ambiguous, or low-confidence.

Preview and durable import both use `resolveCjCatalogCategory`, so they cannot intentionally diverge.

## Preserved CJ hierarchy fields

- `categoryId` / `categoryName`
- `firstCategoryId` / `firstCategoryName`
- `secondCategoryId` / `secondCategoryName`
- `thirdCategoryId` / `thirdCategoryName`

They are stored in the normalized snapshot and copied into `rawMetadata` for durable supplier metadata.

## Representative coverage

| CJ evidence | Todijo canonical destination | Method |
| --- | --- | --- |
| Men Sports Watches | `jewelry--men-watches--montres-de-sport-pour-homme` | authoritative hierarchy mapping |
| Men Boots | `bags-shoes--men-shoes--bottes-pour-homme` | authoritative hierarchy mapping |
| Men Formal Shoes | `bags-shoes--men-shoes--chaussures-formelles` | authoritative hierarchy mapping |
| Women Handbags | `bags-shoes--women-bags--sac-a-main` | authoritative hierarchy mapping |
| Baby Rompers | `kids--baby--barboteuses-de-bebe` | authoritative hierarchy mapping |
| Baby Clothing Sets | `kids--baby--ensembles-de-vetements-pour-bebe` | authoritative hierarchy mapping |

## Deliberately review-required examples

Generic CJ hierarchy values such as `Men Shoes`, `Women Shoes`, `Car Accessories`, or generic `Baby Clothing` do not justify a specific Todijo leaf. These remain review-required unless stronger authoritative metadata or a sufficiently specific safe fallback exists.

This prevents earlier failure modes such as generic shoes being fabricated as vulcanized shoes or insoles.

## Safety invariants

- Imported supplier products remain `DRAFT`.
- Low-confidence or unmapped products remain review-required/quarantined.
- Classification does not bypass compliance, pricing, stock, fulfillment, rate limiting, idempotency, or admin checks.
- CJ automatic fulfillment remains independently gated.
