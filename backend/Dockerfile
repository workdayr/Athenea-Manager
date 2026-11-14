# ---------- Base ----------
FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9 --activate
WORKDIR /app

# ---------- Dependencies ----------
FROM base AS deps
COPY pnpm-lock.yaml package.json ./
RUN pnpm install --frozen-lockfile

# ---------- Build ----------
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV DATABASE_URL="postgresql://placeholder:placeholder@localhost:5432/placeholder"
RUN pnpm exec prisma generate
RUN pnpm build

# ---------- Production deps only ----------
FROM base AS prod-deps
COPY pnpm-lock.yaml package.json ./
RUN pnpm install --frozen-lockfile --prod

# ---------- Runner ----------
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup -g 1001 -S nodejs && adduser -S nestjs -u 1001
# F1-08: el volumen de uploads hereda este dueno al crearse.
RUN mkdir -p /app/uploads && chown -R nestjs:nodejs /app/uploads

COPY --from=prod-deps /app/node_modules ./node_modules
# El cliente Prisma generado vive en src/generated y ya esta compilado
# dentro de dist/ (tsc, rootDir src), por lo que no se copia por separado.
COPY --from=build /app/dist ./dist
COPY --from=build /app/package.json ./package.json

USER nestjs
EXPOSE 3001
CMD ["node", "dist/main.js"]