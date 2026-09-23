#!/bin/sh
set -e

echo "=== INICIANDO SERVICIO DE CUMPLIMIENTO ==="
echo "1. Aplicando migraciones pendientes con Prisma..."
npx prisma migrate deploy

echo "2. Verificando usuario administrador inicial..."
node prisma/ensure-admin.js

echo "3. Iniciando Next.js en 0.0.0.0:3003..."
exec npx next start -H 0.0.0.0 -p 3003
