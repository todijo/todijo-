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

## Deployment

Push all files to GitHub, connect the repository to Coolify, select Dockerfile build, then deploy.

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

The `npm start` script automatically runs `prisma db push` before starting Next.js.


### Galerie produit

- Jusqu’à 10 photos par produit
- Réorganisation par glisser-déposer
- Choix manuel de l’image principale
- Prévisualisation responsive
- Suppression avant enregistrement
