# Deployment

Deployed as a **Docker** app via **Dokploy** on a VPS, auto-deploying on push to
`main`.

## Dokploy setup

1. **Create an Application** in Dokploy pointed at this GitHub repository.
2. **Build type:** `Dockerfile` (repo root `./Dockerfile`).
3. **Branch:** `main`, with **auto-deploy on push** enabled (Dokploy webhook).
4. **Port:** the container listens on **3000** (`EXPOSE 3000`, `HOSTNAME=0.0.0.0`).
   Map it to your domain in Dokploy's Domains tab (TLS via Let's Encrypt).
5. **Environment variables:** set the ones below in the app's Environment tab.

## Required environment variables

| Variable                         | Required            | Purpose                                                             |
| -------------------------------- | ------------------- | ------------------------------------------------------------------- |
| `NEXT_PUBLIC_SITE_URL`           | Yes                 | Canonical origin (no trailing slash). Drives metadata / robots / sitemap. |
| `NEXT_PUBLIC_CLARITY_PROJECT_ID` | Optional            | Microsoft Clarity project id. Analytics load only in production when set. |
| `NEXT_PUBLIC_UMAMI_SRC`          | Optional (pair)     | Full URL of the Umami tracker script.                               |
| `NEXT_PUBLIC_UMAMI_WEBSITE_ID`   | Optional (pair)     | Umami website id (UUID). Required together with `NEXT_PUBLIC_UMAMI_SRC`. |

> `NEXT_PUBLIC_*` values are inlined at **build time**. Dokploy rebuilds the
> image on deploy, so changing them and redeploying is sufficient.

## Umami

Umami runs as its **own Dokploy app** (its own container + Postgres) on a
first-party subdomain, e.g. `https://analytics.<your-domain>`. Point
`NEXT_PUBLIC_UMAMI_SRC` at that subdomain's `/script.js` and use the website id
it generates. Self-hosting on a first-party subdomain keeps analytics
first-party and ad-blocker resilient.

## Notes

- The image is a multi-stage build on `node:22-alpine` using Next's
  `output: "standalone"` — only the minimal server, `.next/static`, and `public`
  are shipped, and it runs as a non-root user.
- No secrets are required; every variable is public (`NEXT_PUBLIC_*`).
