# CJ taxonomy root fix

This document records the root-cause remediation for large-scale CJ imports.

The current failure mode is structural: Todijo has a curated canonical taxonomy with many specific leaves, while CJ can supply products from a much broader supplier taxonomy. Exact structural mappings work well for known leaves, but products from a legitimate CJ top-level family are unnecessarily quarantined when Todijo has no exact leaf. Adding title regexes one product at a time does not scale.

The remediation is therefore family-safe fallback classification:

1. Preserve CJ category IDs and hierarchy as authoritative supplier metadata.
2. Keep exact CJ-path → Todijo-leaf mappings at highest priority.
3. Add a canonical `other` leaf to every Todijo top-level category.
4. When CJ's top-level category is deterministically equivalent to a Todijo top-level category but no precise leaf exists, route to that category's `other` leaf with accepted-but-lower confidence.
5. Explicitly keep regulated/unsafe/ambiguous health, weapon, drug and similar terms on review/quarantine paths even if the family is recognizable.
6. Product-title semantic rules remain secondary; they must not override authoritative supplier hierarchy.
7. Admin review can later promote recurring CJ category IDs to exact leaf mappings without changing product-title regexes.

This makes classification scale by supplier category identity rather than by individual product title, while preserving quarantine for genuinely unsafe or ambiguous products.
