# @sunaidi/api

NestJS application. Owns:

- `GET /webhooks/whatsapp` — Meta's subscription challenge handshake.
- `POST /webhooks/whatsapp` — verifies Meta's `X-Hub-Signature-256` over the raw
  body, stores the raw event (`WebhookEvent`) and enqueues it on the
  `inbound-webhook` BullMQ queue (job id = event id, so retried deliveries are
  idempotent), then returns `200` fast.
- `GET /health` — liveness check.
- REST endpoints for the inbox, contacts, templates, campaigns and automations
  (added incrementally).
- The badge-sending endpoint the event registration system calls (API key per event).

Slow work (sending, broadcasts, flow runtime) is handed to `@sunaidi/worker` via
Redis/BullMQ — the API only receives, validates and enqueues.

## Run

```bash
cp ../../.env.example ../../.env   # fill in DATABASE_URL, REDIS_URL, WHATSAPP_* 
pnpm --filter @sunaidi/api dev
```

Needs Postgres (Supabase) and Redis reachable. Environment variables are validated
on boot (`src/config/env.ts`); the app fails fast if any are missing.
