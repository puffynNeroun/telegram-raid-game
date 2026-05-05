FROM node:22-alpine AS builder

WORKDIR /app

RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json

RUN pnpm install --frozen-lockfile

COPY . .

RUN pnpm --filter @raid-game/shared build
RUN pnpm --filter @raid-game/api build

ENV NODE_ENV=production
WORKDIR /app/apps/api

CMD ["node", "dist/server.js"]