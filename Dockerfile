# syntax=docker/dockerfile:1

# --- Stage 1: build the static bundle ---
FROM node:22-alpine AS build
WORKDIR /app

# Install deps first for better layer caching
COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# --- Stage 2: serve with a minimal, hardened Nginx ---
FROM nginxinc/nginx-unprivileged:1.27-alpine AS runtime

# Nginx config with security headers and gzip
COPY --chown=nginx:nginx docker/nginx.conf /etc/nginx/conf.d/default.conf

# Static build output only — nothing else ships to the image
COPY --from=build --chown=nginx:nginx /app/dist /usr/share/nginx/html

# nginx-unprivileged already runs as the non-root "nginx" user and listens on 8080
EXPOSE 8080

USER nginx

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8080/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
