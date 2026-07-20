# Todijo Private Messaging – MVP

This upgrade adds private buyer/seller conversations without exposing email addresses.

## Included
- “Ask seller” button on every product page
- Authentication redirect for guests
- One conversation per buyer and product
- Buyer/seller inbox at `/messages`
- Conversation page with read status
- In-app notification records for new messages
- 2,000-character message limit
- Authorization checks on every messaging API route
- Prevention of messaging your own store

## Deployment
The existing `start` script runs `prisma db push`, which creates the new tables automatically on Coolify startup.

Required environment variables remain:
- `DATABASE_URL`
- `SESSION_SECRET` (minimum 32 characters)

After deployment, sign in with two different accounts to test buyer and seller messaging.
