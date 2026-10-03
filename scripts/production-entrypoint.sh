#!/bin/sh
set -eu

echo "todijo-entrypoint: applying Prisma migrations from the current image"
./node_modules/.bin/prisma migrate deploy
echo "todijo-entrypoint: migrations complete; starting application"
exec npm run start
