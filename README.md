# Sunaidi WhatsApp Platform

In-house WhatsApp platform for Sunaidi Expo events, built directly on the Meta
WhatsApp Cloud API (no BSP reseller). Replaces the 5 WATI accounts — one per event
— with a single system: shared team inbox, templates, broadcasts, contacts,
automations, a chatbot builder and analytics, plus a badge-sending API for event
registration.

See the [plan document](https://claude.ai/artifact/NJ6hNdbwiB6DGjbBWWoiSQ) for the
feature map, Cloud API rules, MVP scope and roadmap.

## Monorepo layout

```
apps/
  web/      Next.js app (inbox, campaigns, dashboard) — Vercel
  api/      NestJS API (webhook receiver, REST, badge API)
  worker/   NestJS worker (webhook processing, sending, broadcasts, bots)
packages/
  db/       Prisma schema and client (@sunaidi/db)
  whatsapp/ Typed Meta Cloud API client and webhook helpers (@sunaidi/whatsapp)
```

Slow work (sending, broadcasts, flow runtime) runs in the worker via Redis/BullMQ,
so the API always acknowledges Meta's webhooks within seconds.

## Stack

Next.js · NestJS · Postgres on Supabase via Prisma · Supabase Realtime/Auth/Storage
· Redis (BullMQ) · pnpm workspaces + Turborepo · TypeScript throughout.

## Getting started

Requires Node 22+ and pnpm 10+.

```bash
pnpm install
cp .env.example .env        # fill in Supabase, Redis and Meta credentials
pnpm db:generate            # generate the Prisma client
pnpm db:migrate             # apply migrations to your database
pnpm dev                    # run all apps (added as each app is scaffolded)
```

## Status

Foundation in place: monorepo config, the database schema, and the WhatsApp Cloud
API client. The `web`, `api` and `worker` apps are stubs scaffolded in follow-up PRs,
tracked against the MVP checklist in the plan.
