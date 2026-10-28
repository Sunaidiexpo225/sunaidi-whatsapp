# @sunaidi/worker

NestJS standalone app running BullMQ processors. Owns all slow or rate-limited work:

- Process queued webhook events into contacts, conversations and messages.
- Run automations (welcome, out-of-office, keyword replies, auto-assignment).
- Send outbound messages (agent replies and broadcasts) through `@sunaidi/whatsapp`,
  respecting Meta's throughput and the portfolio messaging limit, with retries.
- Chatbot flow runtime (`BotFlow` / `BotSession`).

Scaffolded in a follow-up PR.
