# CJ → Todijo taxonomy mapping architecture

## Principle

Todijo's taxonomy is authoritative for buyer-facing navigation. CJ's taxonomy is authoritative supplier metadata. The two taxonomies do **not** need equal category counts or identical labels.

CJ API v2 exposes a three-level supplier taxonomy through `GET /product/getCategory` (`categoryFirstName` → `categorySecondName` → third-level `categoryId`/`categoryName`). Product List V2 can also return first-, second-, and third-level category information when `enable_category` is requested.

## Mapping contract

1. Never classify a CJ product by comparing category counts.
2. Prefer an exact mapping from CJ third-level `categoryId` to a Todijo canonical leaf ID.
3. If an exact mapping is unavailable, use explicit product evidence (product type, age/audience, gender, subtype) only when it uniquely supports an existing Todijo leaf.
4. Generic family evidence must never fabricate a specific subtype. Example: `men's shoes` cannot become `Chaussure de vulcanisation` without vulcanization evidence.
5. If Todijo lacks a suitable leaf, keep the product in `NEEDS_REVIEW`/quarantine instead of forcing a wrong category.
6. Add a new Todijo leaf only when it represents a useful buyer-facing family/subtype, not merely to mirror every CJ leaf.
7. Manual overrides always store a Todijo canonical leaf ID and remain authoritative for that reviewed import.
8. Imports remain `DRAFT`; classification never bypasses compliance, pricing, inventory, publication, or admin review safeguards.

## Recommended next implementation

Persist/cache the CJ Category List server-side and maintain an explicit `CJ third-level categoryId → Todijo canonical leaf ID` mapping table with an unmapped-gap report. The gap report should count CJ leaves that have no safe Todijo destination and help admins decide whether to add a useful Todijo leaf or leave the mapping review-only.

This mapping layer should precede title-based classification. Title/description rules are fallback evidence, not the primary taxonomy bridge.
