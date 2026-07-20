# Todijo — Premium Store Page 3.0

This release upgrades `/store/[slug]` into a complete professional storefront while keeping the existing Prisma schema and dependencies unchanged.

## Included

- Large responsive banner and store logo
- Verified seller badge based on `emailVerified`
- Follow, contact and native share/copy-link actions
- Products, Reviews, About, Gallery and Policies tabs
- Store statistics and seller profile cards
- Trust and security panel
- Search and price sorting inside the store catalogue
- Redesigned product cards with discount, condition, stock and wishlist controls
- Responsive layouts for mobile, tablet and desktop
- Unified inline SVG icons
- No additional runtime dependency

## Deploy

1. Upload the complete project to GitHub.
2. Keep the existing Coolify environment variables:
   - `DATABASE_URL`
   - `SESSION_SECRET`
3. Redeploy the application in Coolify.

No database migration is required for this store-page release.
