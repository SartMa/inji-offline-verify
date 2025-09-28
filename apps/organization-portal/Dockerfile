FROM node:20-alpine AS builder
WORKDIR /repo
ENV PNPM_HOME=/root/.local/share/pnpm
RUN corepack enable
COPY package.json pnpm-lock.yaml ./
COPY tsconfig.base.json nx.json pnpm-workspace.yaml ./
COPY packages ./packages
COPY apps/organization-portal/package.json ./apps/organization-portal/
RUN pnpm install --frozen-lockfile
COPY apps/organization-portal ./apps/organization-portal
ARG VITE_API_HOST
ARG VITE_ORGANIZATION_PREFIX
ARG VITE_WORKER_PREFIX
ARG VITE_SHARED_PREFIX
ENV VITE_API_HOST=$VITE_API_HOST \
    VITE_ORGANIZATION_PREFIX=$VITE_ORGANIZATION_PREFIX \
    VITE_WORKER_PREFIX=$VITE_WORKER_PREFIX \
    VITE_SHARED_PREFIX=$VITE_SHARED_PREFIX
RUN pnpm nx build organization-portal

FROM nginx:alpine
# Vite build outputs to the app-local ./dist (see vite.config.ts outDir './dist')
# So we copy from /repo/apps/organization-portal/dist not /repo/dist/apps/organization-portal
COPY --from=builder /repo/apps/organization-portal/dist /usr/share/nginx/html
COPY apps/organization-portal/nginx/default.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
