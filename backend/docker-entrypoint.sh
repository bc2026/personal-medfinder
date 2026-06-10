#!/bin/sh
set -e

npx prisma db push --skip-generate

if [ "$SEED_DATABASE" = "true" ]; then
  npx prisma db seed
fi

exec "$@"
