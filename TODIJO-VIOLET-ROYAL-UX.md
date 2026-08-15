# Todijo Violet Royal marketplace UX

This source update applies the selected Violet Royal + white design direction through shared marketplace components.

Main changes:
- Wider shared desktop search in the buyer header.
- Violet Royal brand tokens shared by buyer, authentication, seller/admin legacy header, and dashboard variables.
- Horizontal always-visible marketplace filter dock on home/search result surfaces.
- Full-width category ribbon below filters with hover/focus mega-menu subcategories.
- Compact product cards inspired by high-density marketplaces: no seller name, no stock/condition clutter, icon-only cart/option action.
- Smaller, calmer heading hierarchy and responsive/mobile refinements.
- Shared components keep behavior consistent across locales; no locale-specific visual forks were introduced.

Safety preserved:
- Product variants still require Product Detail selection where necessary.
- Deferred/authoritative CJ pricing remains server-authoritative.
- Product cards do not invent variant choices or bypass Add-to-Cart gating.

Validation note:
- The supplied ZIP did not include a complete node_modules installation. A local npm install attempt in the sandbox was incomplete, so full typecheck/build could not be completed here. The source should be validated in the real repository before commit/push.
