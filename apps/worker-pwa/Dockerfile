FROM node:20-alpine AS builder
WORKDIR /repo
ENV PNPM_HOME=/root/.local/share/pnpm
RUN corepack enable
COPY package.json pnpm-lock.yaml ./
COPY tsconfig.base.json nx.json pnpm-workspace.yaml ./
COPY packages ./packages
COPY apps/worker-pwa/package.json ./apps/worker-pwa/
RUN pnpm install --frozen-lockfile
COPY apps/worker-pwa ./apps/worker-pwa
ARG VITE_API_HOST
ARG VITE_ORGANIZATION_PREFIX
ARG VITE_WORKER_PREFIX
ARG VITE_SHARED_PREFIX
ENV VITE_API_HOST=$VITE_API_HOST \
    VITE_ORGANIZATION_PREFIX=$VITE_ORGANIZATION_PREFIX \
    VITE_WORKER_PREFIX=$VITE_WORKER_PREFIX \
    VITE_SHARED_PREFIX=$VITE_SHARED_PREFIX
# Build shared-ui (produces declarations in its dist) before app build; ignore failure if script missing
RUN pnpm --filter @inji-offline-verify/shared-ui run build || true \
    && pnpm --filter @inji-offline-verify/shared-auth run build || true \
    && pnpm nx build worker-pwa

FROM nginx:alpine
# Vite build outputs to the app-local ./dist (see vite.config.ts) so adjust copy path
COPY --from=builder /repo/apps/worker-pwa/dist /usr/share/nginx/html
COPY apps/worker-pwa/nginx/default.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
