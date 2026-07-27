TODIJO STORE SYSTEM V1

Included:
- Secure store creation API
- One store per user
- Unique store name and URL slug
- Seller dashboard
- Public store page
- Country, city, currency and language fields
- Automatic CUSTOMER -> SELLER role update after store creation

Coolify requirements:
- DATABASE_URL
- SESSION_SECRET (at least 32 characters)

The application start command does not change the database schema. Follow
PRISMA-MIGRATION-RUNBOOK.md before the first migration deployment to an
existing database, then run `npm run db:migrate` separately.

STORE MEDIA UPLOAD V2
- Sellers can upload logo and banner directly from phone/computer.
- Drag and drop, preview, replace and remove are supported.
- Uses the existing NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME and NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET variables.
- Logo: JPG/PNG/WebP, max 3 MB, minimum 200x200.
- Banner: JPG/PNG/WebP, max 8 MB, minimum 800x250.
- No Prisma schema change is required.
