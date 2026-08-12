# --- BUILD STAGE ---
FROM node:22-slim AS base

# Instalar pnpm v9 directamente (evita problemas de compatibilidad con v11)
RUN npm install -g pnpm@9.15.4

WORKDIR /app

# Copiar archivos de dependencias
COPY package.json pnpm-lock.yaml* ./

# Instalar dependencias
RUN pnpm install --frozen-lockfile

# Copiar el resto del código de la aplicación
COPY . .

# Generar el cliente de Prisma
RUN pnpm prisma generate

# Construir la aplicación de Next.js
RUN pnpm run build

# --- RUNNER STAGE ---
FROM node:22-slim AS runner

RUN npm install -g pnpm@9.15.4

WORKDIR /app

ENV NODE_ENV=production

# Copiar los directorios compilados y módulos necesarios de la etapa base
COPY --from=base /app/.next ./.next
COPY --from=base /app/public ./public
COPY --from=base /app/package.json ./package.json
COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/prisma ./prisma
COPY --from=base /app/start.sh ./start.sh

# Dar permisos de ejecución al script de inicio
RUN chmod +x start.sh

EXPOSE 3000

CMD ["./start.sh"]
