# @sunaidi/api

NestJS application. Owns:

- `POST /webhooks/whatsapp` — verifies Meta's `X-Hub-Signature-256`, stores the raw
  event (`WebhookEvent`) and enqueues it; `GET` handles the subscription challenge.
- REST endpoints for the inbox, contacts, templates, campaigns and automations.
- The badge-sending endpoint the event registration system calls (API key per event).

Slow work (sending, broadcasts, flow runtime) is handed to `@sunaidi/worker` via
Redis/BullMQ — the API only receives, validates and enqueues.

Scaffolded in a follow-up PR.
