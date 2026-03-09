# SagaArchitect — Deployment Guide

SagaArchitect is a **Next.js 14 application** with no required backend. All universe data is stored in `localStorage` on the client. The only optional external dependency is an OpenAI API key for AI-powered generation.

---

## Quick start: Vercel (recommended)

Vercel is the fastest way to deploy a Next.js app publicly.

### 1. Push your code to GitHub

If you haven't already, push the repository to GitHub.

### 2. Import the project on Vercel

1. Go to [vercel.com](https://vercel.com) and sign in.
2. Click **Add New → Project** and import your GitHub repository.
3. Vercel auto-detects Next.js — no build settings changes needed.

### 3. Set environment variables

In the Vercel project dashboard, go to **Settings → Environment Variables** and add:

| Variable | Required | Description |
|---|---|---|
| `OPENAI_API_KEY` | Optional | Enables real AI generation. Without it, the app returns mock data so the full UI is still explorable. |
| `RAINSTORMS_BASE_URL` | Optional | Public URL of your Rainstorms deployment, e.g. `https://your-rainstorms-app.vercel.app`. Required only if you use the **🌧 Sync to Rainstorms** feature. |

### 4. Deploy

Click **Deploy**. Vercel builds the app with `npm run build` and serves it at a `.vercel.app` URL.

### 5. Lock down CORS for production (important)

By default, the API allows requests from any origin (`Access-Control-Allow-Origin: *`). In production, the CORS allowed origin is automatically set to the value of `RAINSTORMS_BASE_URL` — no code changes required. Just make sure the variable is set in step 3.

See [CORS configuration](#cors-configuration) below for details.

---

## Other platforms

### Railway

1. Create a new project in [railway.app](https://railway.app) and connect your GitHub repository.
2. Set the same environment variables listed above.
3. Railway detects Next.js automatically. The default start command (`npm run start`) works as-is.

### Render

1. Create a new **Web Service** in [render.com](https://render.com) and connect your repository.
2. Set **Build Command**: `npm install && npm run build`
3. Set **Start Command**: `npm run start`
4. Add environment variables in the Render dashboard.

### Docker / self-hosted

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
EXPOSE 3000
CMD ["node", "server.js"]
```

> **Note**: To enable the `standalone` output, add `output: 'standalone'` to `next.config.ts` before building.

Pass environment variables at runtime:

```bash
docker run -p 3000:3000 \
  -e OPENAI_API_KEY=sk-... \
  -e RAINSTORMS_BASE_URL=https://your-rainstorms-app.vercel.app \
  your-image-name
```

---

## Environment variables reference

All variables live in `.env.local` (local development) or your hosting platform's environment variable settings (production). Copy `.env.example` as a starting point.

```bash
cp .env.example .env.local
```

| Variable | Default | Notes |
|---|---|---|
| `OPENAI_API_KEY` | *(empty)* | Leave empty to use mock generation. Set to a real OpenAI key for production AI features. |
| `RAINSTORMS_BASE_URL` | *(empty)* | URL of the Rainstorms backend. Only needed if users will sync universes to Rainstorms. |

> **Never commit `.env.local` to git** — it is already in `.gitignore`.

---

## CORS configuration

SagaArchitect's LoreEngine API is designed to be called by **Rainstorms** (and future tools in the ecosystem) from a different origin. The CORS headers are set in `next.config.ts`.

### Development (default)

The wildcard `*` allows any origin to call the API, which is convenient for local development where Rainstorms might run on `http://localhost:8001`.

### Production

Set `RAINSTORMS_BASE_URL` to the exact origin of your Rainstorms deployment in your hosting platform's environment settings. `next.config.ts` reads this variable automatically — no code changes are required:

```
RAINSTORMS_BASE_URL=https://your-rainstorms-app.vercel.app
```

The value is used as `Access-Control-Allow-Origin`, so only your Rainstorms instance can call the LoreEngine endpoints. The relevant line in `next.config.ts`:

```ts
const rawRainstormsUrl = process.env.RAINSTORMS_BASE_URL?.trim() ?? '';
const allowedOrigin = rawRainstormsUrl.length > 0 ? rawRainstormsUrl : '*';
```

This ensures only your Rainstorms deployment can call the LoreEngine endpoints.

---

## Deploying alongside Rainstorms

SagaArchitect and Rainstorms are separate deployments that talk to each other.

```
SagaArchitect  ←────────────────────────────────────────────────────────────
(Vercel / Railway)                                                           │
  RAINSTORMS_BASE_URL = https://rainstorms.your-domain.com ──► Rainstorms   │
                                                             (Vercel / Railway)
                                                               SAGA_ARCHITECT_BASE_URL
                                                               = https://sagaarchitect.your-domain.com
```

### Step-by-step

1. **Deploy SagaArchitect** (steps above). Note its public URL, e.g. `https://saga.your-domain.com`.
2. **Deploy Rainstorms**. In Rainstorms's environment variables, set:
   ```
   SAGA_ARCHITECT_BASE_URL=https://saga.your-domain.com
   ```
3. **In SagaArchitect**, set:
   ```
   RAINSTORMS_BASE_URL=https://rainstorms.your-domain.com
   ```
4. Redeploy both apps so the new env vars take effect.
5. Open any universe in SagaArchitect → Canon Core → **🌧 Sync to Rainstorms**. Click **Test** to verify connectivity, then click **Sync**.

> The demo universe (`demo-ashen-veil-001`) is always available without a sync. You can test the story-context endpoint immediately after deployment:
> ```
> GET https://saga.your-domain.com/api/universes/demo-ashen-veil-001/story-context
> ```

---

## Build commands

| Command | Purpose |
|---|---|
| `npm run dev` | Local development server (hot reload, no optimization) |
| `npm run build` | Production build — runs type checking and Next.js compilation |
| `npm run start` | Start the production server (requires a prior `npm run build`) |
| `npm run lint` | Run ESLint across the codebase |

---

## Troubleshooting

### AI generation returns mock data

The app intentionally falls back to mock/placeholder content when `OPENAI_API_KEY` is not set. Check that the variable is set in your hosting platform's environment settings and that you have redeployed after adding it.

### "Could not connect to Rainstorms"

- Verify `RAINSTORMS_BASE_URL` is set and points to the correct URL (no trailing slash).
- Check that Rainstorms is running and publicly accessible.
- Use the **Test** button in the Sync panel to diagnose connectivity before syncing.
- Make sure Rainstorms has CORS configured to accept requests from the SagaArchitect origin.

### "SagaArchitect returned HTTP 404 for universe"

- The universe ID does not exist in `localStorage` on the server — localStorage is browser-only. The `/api/universes/{id}/story-context` endpoint reads from a server-side cache populated by `POST /api/universes/{id}/story-context`. Make sure you call the POST endpoint first (the **🌧 Sync** button does this automatically).
- Use `demo-ashen-veil-001` to test the endpoint without syncing a real universe.

### CORS errors in the browser console

If Rainstorms (or any tool) shows CORS errors when calling the LoreEngine API:

1. Verify that `next.config.ts` includes the correct `Access-Control-Allow-Origin` value for the calling origin.
2. Redeploy SagaArchitect after any change to `next.config.ts`.
3. Ensure preflight (`OPTIONS`) requests are not blocked by a CDN or reverse proxy in front of SagaArchitect.

### Build fails with TypeScript errors

Run `npm run build` locally to see the full error output. TypeScript errors must be resolved before the production build succeeds.
