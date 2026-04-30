---
name: Docket Repo Paths
description: Where the Docket repo, design source, and key working files live on disk
type: reference
originSessionId: d8e77b0b-2644-4132-9c90-4769d6f50780
---
**Repo:** `C:\Users\minse\projects\docket\`
- Monorepo (Turborepo + pnpm workspaces)
- Apps: `apps/client-portal` (mobile-first), `apps/command-room` (preparer pane)
- Services: `services/orchestrator` (Claude Agent SDK + Docket layer)
- Packages: `packages/ui`, `packages/db`, `packages/agents`, `packages/shared`

**GitHub:** Private repo `child-docket` under user's gh account.

**Design source files:** `C:\Users\minse\Downloads\docket-portal-design\`
- `Docket Client Portal - Standalone.html` — full standalone prototype (2.6MB, all screens inline)
- `components/*.jsx` — 23 React components covering all 36 screens
- `components/tokens.jsx` — design tokens (Fraunces, DM Sans, oklch greens, editorial/minimal/magazine variants)
- `components/app-shell.jsx` — top-level routing + PhoneShell + canvas overview
- `components/portal-screens.jsx` — returning client portal (Home, Docs, Messages, Sign, Profile)
- `components/intake-screens.jsx` — login, OTP, welcome, tutorial, services
- Per-screen component files (personal-info, dependents, deductions, etc.)
- `assets/antonio.webp` — Antonio's headshot for AvatarSlot

**Strategic brief:** `C:\Users\minse\OneDrive\Desktop\Docket-Project-Brief.md`

**Memory anchors:** All `project_docket_*.md` in `C:\Users\minse\.claude\projects\C--Users-minse\memory\`
