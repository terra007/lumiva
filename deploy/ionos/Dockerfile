# LUMIVA Web-App mit API. Gebaut aus dem Repo-Wurzelordner:
#   docker build -f deploy/ionos/Dockerfile .
FROM node:24.22.2-bookworm-slim AS bau
WORKDIR /lumiva
RUN corepack enable
COPY . .
# Nur die Web-App und ihre Pakete installieren, nicht die mobile App.
RUN pnpm install --frozen-lockfile --filter "@lumiva/web..."
RUN pnpm --filter @lumiva/web build

FROM node:24.22.2-bookworm-slim
WORKDIR /lumiva
RUN useradd --system --uid 1001 lumiva
COPY --from=bau --chown=lumiva /lumiva /lumiva
USER lumiva
ENV NODE_ENV=production PORT=3000
EXPOSE 3000
WORKDIR /lumiva/apps/web
# Direkt mit Node starten: kein pnpm-Download zur Laufzeit.
CMD ["node", "/lumiva/node_modules/next/dist/bin/next", "start"]
