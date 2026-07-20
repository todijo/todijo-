TODIJO PRODUCT SYSTEM V1

Included:
- Product database model with draft/published status
- Add product form
- Seller product management page
- Public product page
- Products displayed in the public store
- Dashboard product buttons enabled
- Price, stock, category, condition and up to 3 image URLs

Deployment:
The existing start command runs `prisma db push` before Next.js starts, so the database schema is updated automatically in Coolify.

Images:
This version accepts secure image URLs (https). Direct uploads will be added later with Cloudinary or S3, without changing the product database model.
