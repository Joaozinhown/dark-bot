#!/bin/sh
npx prisma generate --schema=dist/prisma/schema.prisma 2>/dev/null || true
node dist/index.js
