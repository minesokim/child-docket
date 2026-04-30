# Docket

The agentic operator for a tax practice. Top-tier preparer-grade AI animates every surface; drives the existing tax stack (OLT, IRS Solutions, Xero) via browser automation.

> *Your practice. Every tool. One operator.*

## Status

v0 scaffold — first commit. See `C:\Users\minse\OneDrive\Desktop\Docket-Project-Brief.md` for the full strategic picture.

## Structure

```
apps/
  client-portal/      # mobile-first taxpayer portal (Next.js)
  command-room/       # preparer's pane (Next.js)
services/
  orchestrator/       # Claude Agent SDK + Docket layer
packages/
  ui/                 # design system (Docket tokens + primitives)
  db/                 # Drizzle schema + migrations
  shared/             # types, errors, utils
  agents/             # agent definitions
mcp-servers/          # MCP servers (added incrementally)
```

## Stack

- **TypeScript** end-to-end
- **Next.js 15** App Router for both web apps
- **Claude Agent SDK** as the reasoning + tool orchestration substrate
- **MCP gateway** as the only integration abstraction
- **Postgres + Drizzle + pgvector** (multi-tenant via RLS)
- **Clerk** auth (phone-based SMS OTP via Twilio)
- **Stripe** payments + **Stripe Identity** for KYC (8879 e-signing)
- **Cloudflare R2** for documents
- **Inngest** for durable background jobs
- **Playwright** wrapped per target as MCP servers (browser automation)

## Getting started

```bash
pnpm install
cp .env.example .env.local  # fill in keys
pnpm dev
```

## Design partner

Antonio at Vazant Consulting — California EA running both prep + rep work on OLT + IRS Solutions + Xero.
