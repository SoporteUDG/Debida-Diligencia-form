#!/bin/sh
# Sincronizar el esquema de Prisma con la base de datos de producción
npx prisma db push --accept-data-loss

# Iniciar el servidor de producción de Next.js
pnpm run start
