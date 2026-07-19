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

The start command already runs: prisma db push && next start
This adds the new Store fields to PostgreSQL during deployment.
