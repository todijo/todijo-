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
Database changes are deployed separately with the checked-in Prisma migrations.
For an existing database, follow PRISMA-MIGRATION-RUNBOOK.md before running
`npm run db:migrate`. The application start command does not change the schema.

Images:
This version accepts secure image URLs (https). Direct uploads will be added later with Cloudinary or S3, without changing the product database model.
