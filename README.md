# Todijo

Todijo is a multilingual marketplace starter built with Next.js App Router and TypeScript.

## Included

- Responsive marketplace home page
- Automatic browser-language detection
- Kurdish, English, French and Arabic
- Manual language selector saved in local storage
- Seller subscription section
- Product cards and categories
- Dockerfile ready for Coolify

## Local development

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Quality checks

Pull requests and pushes to `main` run the GitHub Actions quality gate in
`.github/workflows/ci.yml`. It installs the exact `package-lock.json`
dependency tree, generates and validates the Prisma client/schema, checks
TypeScript and ESLint, runs the safe automated test suite, and creates a
production build.

Run the equivalent checks locally with:

```bash
npm ci
DATABASE_URL="postgresql://ci:ci@127.0.0.1:5432/todijo_ci?schema=public" npx prisma validate
npm run typecheck
npm run lint
npm test
DATABASE_URL="postgresql://ci:ci@127.0.0.1:5432/todijo_ci?schema=public" APP_URL="http://localhost:3000" SESSION_SECRET="local-validation-secret-at-least-32-characters" npm run build
```

The placeholder database URL is parsed during validation/build only. These
checks do not start a database, run migrations, seed data, contact Stripe, or
require production secrets.

## Deployment

Push all files to GitHub, connect the repository to Coolify, select Dockerfile build, then deploy.

Database deployments use the checked-in Prisma migration chain. Follow
`PRISMA-MIGRATION-RUNBOOK.md` before the first deployment to an existing
database, then use `npm run db:migrate` (`prisma migrate deploy`).

## Authentication UI v1

- `/login` login page
- `/register` customer/seller registration page
- Homepage buttons connected to the new routes
- PostgreSQL/backend connection is the next milestone

## Real authentication v2

This version includes:
- PostgreSQL database via Prisma
- Secure bcrypt password hashing
- Signed HttpOnly session cookie
- Real registration and login APIs
- Customer and seller roles
- Protected `/dashboard`
- Logout

Required Coolify environment variables:
- `DATABASE_URL`
- `SESSION_SECRET` (at least 32 random characters)

The `npm start` script starts Next.js and does not change the database schema.
Apply reviewed migrations separately by following `PRISMA-MIGRATION-RUNBOOK.md`.


### Galerie produit

- Jusqu’à 10 photos par produit
- Réorganisation par glisser-déposer
- Choix manuel de l’image principale
- Prévisualisation responsive
- Suppression avant enregistrement

## Professional commerce upgrade

This version adds a professional responsive header, persistent wishlist, native sharing, product choices, optional compare-at pricing and discount display, related products, buyer protection UI, customer reviews (local-device v1), an improved cart and a complete checkout interface prepared for future Stripe/PayPal keys.

These fields are part of the historical baseline. Existing production
databases must be manually verified and baselined according to
`PRISMA-MIGRATION-RUNBOOK.md`; new databases are created with
`prisma migrate deploy`.

## Product discovery sprint

This version adds database-backed marketplace discovery:
- Search by product, description, category, seller/store, city and country
- Category filtering
- Price, condition, city and country filters
- Newest, oldest, low-price and high-price sorting
- Server-side pagination (24 products per page)
- Wishlist controls on every product card (localStorage)
- Responsive product discovery interface

No Prisma schema change is required for this sprint.
