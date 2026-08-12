# --- BUILD STAGE ---
FROM node:22-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

WORKDIR /app

# Copiar archivos de dependencias y configuración de pnpm
COPY package.json pnpm-lock.yaml* .npmrc* ./

# Instalar dependencias necesarias para construir el proyecto
RUN pnpm config set only-built-dependencies @prisma/engines,prisma,sharp,core-js,unrs-resolver && pnpm install --frozen-lockfile

# Copiar el resto del código de la aplicación
COPY . .

# Generar el cliente de Prisma
RUN pnpm prisma generate

# Construir la aplicación de Next.js
RUN pnpm run build

# --- RUNNER STAGE ---
FROM node:22-slim AS runner
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

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
