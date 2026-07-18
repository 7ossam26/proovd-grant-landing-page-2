# syntax=docker/dockerfile:1

# ---- Base -------------------------------------------------------------------
FROM node:22-alpine AS base
# libc6-compat helps some native modules run under Alpine's musl libc.
RUN apk add --no-cache libc6-compat
WORKDIR /app

# ---- Dependencies -----------------------------------------------------------
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

# ---- Builder ----------------------------------------------------------------
FROM base AS builder
ENV NEXT_TELEMETRY_DISABLED=1
# Next inlines NEXT_PUBLIC_* and evaluates metadata (incl. the Search Console
# token) during the static build, so these must be present at BUILD time — not
# just runtime. Dokploy passes configured variables to the build as args; the
# ARG/ENV pairs below capture them so the values are baked into the output.
# All are optional: the site URL falls back in code, analytics/verification stay
# off until their vars are set.
ARG NEXT_PUBLIC_SITE_URL
ARG NEXT_PUBLIC_CLARITY_PROJECT_ID
ARG NEXT_PUBLIC_UMAMI_SRC
ARG NEXT_PUBLIC_UMAMI_WEBSITE_ID
ARG GOOGLE_SITE_VERIFICATION
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL \
    NEXT_PUBLIC_CLARITY_PROJECT_ID=$NEXT_PUBLIC_CLARITY_PROJECT_ID \
    NEXT_PUBLIC_UMAMI_SRC=$NEXT_PUBLIC_UMAMI_SRC \
    NEXT_PUBLIC_UMAMI_WEBSITE_ID=$NEXT_PUBLIC_UMAMI_WEBSITE_ID \
    GOOGLE_SITE_VERIFICATION=$GOOGLE_SITE_VERIFICATION
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Git does not track empty directories; guarantee public/ exists so the runner's
# COPY of it never fails even if no assets are committed yet.
RUN mkdir -p ./public
RUN npm run build

# ---- Runner -----------------------------------------------------------------
FROM base AS runner
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Run as a non-root user.
RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

# `output: "standalone"` emits a self-contained server in .next/standalone.
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
