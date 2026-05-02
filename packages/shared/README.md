# @docket/shared

Cross-app types, validators, and pure helpers. Imported by `apps/client-portal`, `apps/command-room`, every `services/*`, every `mcp-servers/*`, and `@docket/db`.

**Rule of thumb:** if more than one workspace package needs it AND it has no Next.js / Drizzle / React dependency, it lives here.

## What's inside

| Module | Why it's here |
|---|---|
| `intake.ts` | The canonical `IntakeState` shape + `getNextStep` / `getAtPath` / `setAtPath` traversal helpers. Both apps walk the same tree. |
| `intake-schemas.ts` | Zod schemas matching every leaf of `IntakeState`. `saveIntakeField` runs each write through `getSchemaForPath()` before any DB call — schema rejection happens before encryption. |
| `format.ts` | Strict digit-only filter + auto-format for EIN, money, ZIP, year, count fields. Used at the `onChange` boundary so the UI never accepts garbage that the Zod schema would later reject. 22 unit tests lock in real-world inputs. |
| `masking.ts` | `MASK_CHAR` (`·`) sentinel + `maskSensitiveFields(tree)` that replaces SSN/EIN/bank values with `·····6789`-style strings before any tree leaves the server. The server-side `revealIntakeField` action reverses it under audit logging. |
| `tax-year.ts` | `taxYearForDate(d, tz)` with the IRS rule baked in: April 15 cutover, Pacific timezone for Antonio's California firm. Pure — no `Date.now()` reads inside the function so tests are deterministic. |
| `rate-limit.ts` | In-process token-bucket limiter for abusable server actions + API routes (`revealIntakeField`, `/api/intake/flush`, OTP). Per-instance for v0; swap to Upstash Redis when traffic justifies. |
| `sentry-scrubber.ts` | `beforeSend` hook for Sentry. Last-line defense before events leave our processes — strips SSN/EIN/email/phone substrings + redacts whole values for sensitive-looking field names. **Every Sentry init in the monorepo MUST wire this in.** |
| `index.ts` | Branded ID types (`TenantId`, `ClientId`, `UserId`, …), `ActionLogEntry`, agent registry (`AgentId`), trust levels, issue/engagement/signature/channel taxonomies. |

## Branded IDs

Every domain ID flows through a brand to prevent mix-ups at compile time:

```ts
import { asTenantId, asClientId, type TenantId } from '@docket/shared';

const t: TenantId = asTenantId(row.tenant_id);
// const c: ClientId = t;  // ← compile error: TenantId is not ClientId
```

These are zero-cost at runtime — the `__brand` field is a phantom type. Helpers `asTenantId / asClientId / asUserId` are the only sanctioned way to mint one (always at the trust boundary, e.g., right after a Postgres read).

## Issue taxonomy

The 11 v0 issue types Antonio works through in the Triage view are declared in `index.ts`:

```ts
type IssueType =
  | 'doc_mismatch' | 'doc_gap' | 'ero_pending' | 'prep_decision'
  | 'signature_pending' | 'extension_risk' | 'payment_status'
  | 'meeting_prep' | 'missing_info' | 'quick_reply' | 'irs_notice';
```

Default ETAs (`ISSUE_DEFAULT_ETA_MINUTES`) drive the time-to-clear estimate on each Triage card. v0 is a constant per type; v1 refines from accumulated history.

## Tests

Run from the package root:

```bash
cd packages/shared
bun test
```

98 tests across `format`, `intake-schemas`, `masking`, `rate-limit`, `sentry-scrubber`, `tax-year`. The matrix locks in:

- Format pad/truncate/strip behavior on real-world garbage inputs
- Zod rejection of malformed SSN/EIN/ZIP/email/phone before they reach the DB
- `maskSensitiveFields` covers every flagged path even when a parent is missing
- Token-bucket refill math under burst + sustained load
- Sentry scrubber redacts SSN-looking strings inside breadcrumb messages
- April-15 cutover edge cases across DST + leap years

## What does NOT belong here

- React components → `@docket/ui`
- Drizzle schema → `@docket/db`
- Server-only secrets / environment access → app-level `lib/`
- Knowledge-graph types (Authority / TaxConcept / etc.) → `@docket/tax-graph` (lands in Phase 2)

Adding a new file means: zero `next/*`, zero `drizzle-orm`, zero `react`. If the import graph picks any of those up, it's in the wrong package.
