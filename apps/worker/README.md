# @sunaidi/worker

NestJS standalone app (no HTTP server) running BullMQ workers. Owns all slow or
rate-limited work.

Live now:

- **Inbound processor** — drains the `inbound-webhook` queue. For each stored
  `WebhookEvent` it parses Meta's payload and upserts the `Contact`, upserts the
  `Conversation` (reopening a resolved one, updating the 24h-window timestamp),
  stores inbound `Message`s idempotently (keyed on Meta's `wamid`), and applies
  delivery/read/failed statuses to outbound messages. Processing is idempotent, so
  a retried job is safe.

To come: automations (welcome, out-of-office, keyword replies, auto-assignment),
outbound sending (agent replies and broadcasts) respecting Meta's throughput and
the portfolio messaging limit, and the chatbot flow runtime.

## Run

```bash
pnpm --filter @sunaidi/worker dev
```

Needs Postgres (Supabase) and Redis reachable; env is validated on boot.
