#!/bin/sh
echo "=== INICIANDO SERVICIO DE CUMPLIMIENTO ==="
echo "1. Sincronizando base de datos con Prisma..."
npx prisma db push --accept-data-loss

echo "2. Iniciando Next.js en 0.0.0.0:3000..."
npx next start -H 0.0.0.0 -p 3000
