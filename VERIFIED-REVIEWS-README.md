# Todijo — Verified Reviews V1

This version replaces browser-only reviews with PostgreSQL-backed verified reviews.

Included:
- 1–5 star reviews stored in Prisma/PostgreSQL
- Reviews restricted to buyers with a PAID, PROCESSING, SHIPPED or DELIVERED order
- One review per buyer/product and one review per order item
- Public buyer name shortened; email is never exposed
- Average rating and review count
- Seller replies API
- Review reports for admin moderation
- Basic suspicious-content detection and PENDING moderation
- Order and OrderItem models prepared for the future payment flow

Deployment:
1. Upload/commit all files.
2. Redeploy in Coolify.
3. The current start script runs `prisma db push` automatically.
4. Check deployment logs for a successful Prisma schema sync.

Important: the current checkout page does not charge customers yet. Reviews become available after the future checkout/payment flow creates an Order and OrderItem with an eligible status.
