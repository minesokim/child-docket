// Set per-tenant integration credentials in the encrypted vault.
//
// Usage (interactive — secrets prompted via TTY, never in shell history):
//
//   pnpm --filter @docket/db set-tenant-cred --tenant=vazant --kind=twilio
//
// Then paste each secret at the prompt. Values aren't echoed.
//
// One-shot variant (non-interactive — values passed as args; OK for
// dev iteration, but the values land in shell history. Don't use this
// in CI or with production tokens):
//
//   pnpm --filter @docket/db set-tenant-cred --tenant=vazant --kind=twilio \
//     --account-sid=AC... --auth-token=... --from=+18663592994
//
// Per-kind required fields:
//   twilio:    --account-sid, --auth-token, --from
//   square:    --access-token, --location-id, --environment (production|sandbox)
//   docusign:  --integration-key, --user-id, --account-id, --private-key-file
//   gmail:     --refresh-token, --scope (--access-token optional)
//
// The script resolves --tenant by slug (e.g. "vazant"), encrypts with
// that tenant's DEK, upserts the row. Idempotent — re-running with the
// same values is a no-op except for bumping rotated_at.

import { config as loadEnv } from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { eq } from 'drizzle-orm';
import * as readline from 'node:readline';
import * as fs from 'node:fs';
import { tenants } from '../src/schema.js';
import * as schema from '../src/schema.js';
import {
  setTenantCredential,
  type CredentialKind,
  type TwilioCredentials,
  type SquareCredentials,
  type DocusignCredentials,
  type GmailCredentials,
} from '../src/tenant-credentials.js';
import { asTenantId } from '@docket/shared';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
loadEnv({ path: path.resolve(__dirname, '../../../.env.local'), override: true });

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('✗ DATABASE_URL not set. Add to .env.local first.');
  process.exit(1);
}
if (!process.env.PII_ENCRYPTION_KEY) {
  console.error('✗ PII_ENCRYPTION_KEY not set. Add to .env.local first.');
  process.exit(1);
}

// ────────────────────────────────────────────────────────────────
// Argv parsing — minimal, no external dep.
// ────────────────────────────────────────────────────────────────

function parseArgs(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith('--')) {
      const eq = arg.indexOf('=');
      if (eq === -1) {
        out[arg.slice(2)] = 'true';
      } else {
        out[arg.slice(2, eq)] = arg.slice(eq + 1);
      }
    }
  }
  return out;
}

// ────────────────────────────────────────────────────────────────
// Hidden-input prompt. Standard mute trick: turn off terminal echo
// while reading the line.
// ────────────────────────────────────────────────────────────────

async function promptHidden(label: string): Promise<string> {
  process.stdout.write(`${label}: `);
  return await new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: true,
    });
    // Mute the input so the secret isn't echoed.
    const stdin = process.stdin as NodeJS.ReadStream & { isTTY?: boolean };
    const wasRaw = stdin.isRaw;
    let muted = '';
    const onKeypress = (chunk: Buffer) => {
      const ch = chunk.toString('utf8');
      if (ch === '\r' || ch === '\n') {
        process.stdout.write('\n');
        stdin.removeListener('data', onKeypress);
        if (stdin.setRawMode && wasRaw === false) stdin.setRawMode(false);
        rl.close();
        resolve(muted);
      } else if (ch === '') {
        // Ctrl-C
        process.exit(130);
      } else if (ch === '' || ch === '\b') {
        muted = muted.slice(0, -1);
      } else {
        muted += ch;
      }
    };
    if (stdin.setRawMode) stdin.setRawMode(true);
    stdin.on('data', onKeypress);
  });
}

// ────────────────────────────────────────────────────────────────
// Resolve tenant by slug.
// ────────────────────────────────────────────────────────────────

const client = postgres(DATABASE_URL, { max: 1 });
const db = drizzle(client, { schema });

async function resolveTenantId(slug: string): Promise<string> {
  const [row] = await db
    .select({ id: tenants.id, name: tenants.name })
    .from(tenants)
    .where(eq(tenants.slug, slug))
    .limit(1);
  if (!row) {
    throw new Error(`Tenant slug "${slug}" not found. Did you run \`pnpm --filter @docket/db seed\`?`);
  }
  console.log(`  ✓ tenant: ${row.name} (${row.id})`);
  return row.id;
}

// ────────────────────────────────────────────────────────────────
// Per-kind field collection. Pulls from --flags first, falls back to
// hidden prompts for any missing secrets.
// ────────────────────────────────────────────────────────────────

async function collectTwilio(args: Record<string, string>): Promise<TwilioCredentials> {
  const accountSid = args['account-sid'] || (await promptHidden('Twilio Account SID (starts with AC)'));
  const authToken = args['auth-token'] || (await promptHidden('Twilio Auth Token'));
  const fromNumber = args.from || (await promptHidden('From number in E.164 (e.g. +18663592994)'));
  return { accountSid: accountSid.trim(), authToken: authToken.trim(), fromNumber: fromNumber.trim() };
}

async function collectSquare(args: Record<string, string>): Promise<SquareCredentials> {
  const accessToken = args['access-token'] || (await promptHidden('Square Access Token'));
  const locationId = args['location-id'] || (await promptHidden('Square Location ID'));
  const environment = (args.environment || 'production').trim();
  if (environment !== 'production' && environment !== 'sandbox') {
    throw new Error('Square environment must be "production" or "sandbox"');
  }
  return { accessToken: accessToken.trim(), locationId: locationId.trim(), environment };
}

async function collectDocusign(args: Record<string, string>): Promise<DocusignCredentials> {
  const integrationKey = args['integration-key'] || (await promptHidden('DocuSign Integration Key'));
  const userId = args['user-id'] || (await promptHidden('DocuSign User GUID'));
  const accountId = args['account-id'] || (await promptHidden('DocuSign Account GUID'));
  const privateKeyFile = args['private-key-file'];
  let privateKey: string;
  if (privateKeyFile) {
    privateKey = fs.readFileSync(privateKeyFile, 'utf8');
  } else {
    console.log('  Paste DocuSign private key (PEM). End with a single line containing only `END`:');
    privateKey = await readUntilSentinel('END');
  }
  return {
    integrationKey: integrationKey.trim(),
    userId: userId.trim(),
    accountId: accountId.trim(),
    privateKey: privateKey.trim(),
  };
}

async function collectGmail(args: Record<string, string>): Promise<GmailCredentials> {
  const clientId =
    args['client-id'] ||
    (await promptHidden('OAuth Client ID (.apps.googleusercontent.com)'));
  const clientSecret =
    args['client-secret'] || (await promptHidden('OAuth Client Secret (GOCSPX-...)'));
  const refreshToken =
    args['refresh-token'] || (await promptHidden('Gmail OAuth Refresh Token'));
  const accessToken = args['access-token'] || undefined;
  const scope = args.scope || (await promptHidden('Granted scopes (space-separated)'));
  return {
    clientId: clientId.trim(),
    clientSecret: clientSecret.trim(),
    refreshToken: refreshToken.trim(),
    accessToken,
    scope: scope.trim(),
  };
}

async function readUntilSentinel(sentinel: string): Promise<string> {
  return await new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const lines: string[] = [];
    rl.on('line', (line) => {
      if (line.trim() === sentinel) {
        rl.close();
        resolve(lines.join('\n'));
      } else {
        lines.push(line);
      }
    });
  });
}

// ────────────────────────────────────────────────────────────────
// Main.
// ────────────────────────────────────────────────────────────────

async function main() {
  const args = parseArgs();
  const tenantSlug = args.tenant;
  const kind = args.kind as CredentialKind | undefined;

  if (!tenantSlug) {
    console.error('✗ --tenant=<slug> required (e.g. --tenant=vazant)');
    process.exit(1);
  }
  if (!kind) {
    console.error('✗ --kind=<integration> required (twilio | square | docusign | gmail)');
    process.exit(1);
  }

  console.log(`▸ set-tenant-cred kind=${kind} tenant=${tenantSlug}`);
  const tenantId = await resolveTenantId(tenantSlug);

  let creds: TwilioCredentials | SquareCredentials | DocusignCredentials | GmailCredentials;
  switch (kind) {
    case 'twilio':
      creds = await collectTwilio(args);
      break;
    case 'square':
      creds = await collectSquare(args);
      break;
    case 'docusign':
      creds = await collectDocusign(args);
      break;
    case 'gmail':
      creds = await collectGmail(args);
      break;
    default:
      console.error(`✗ Unknown --kind: ${kind}. Use twilio | square | docusign | gmail.`);
      process.exit(1);
  }

  // setTenantCredential validates the shape, encrypts with the tenant's
  // DEK, upserts the row.
  await setTenantCredential(db, asTenantId(tenantId), kind, creds as never);

  console.log(`  ✓ ${kind} credentials saved (encrypted with tenant DEK)`);
  console.log(`  → ${kind} integration is now live for tenant=${tenantSlug}`);
}

main()
  .catch((err) => {
    console.error('✗ set-tenant-cred failed:', err.message ?? err);
    process.exit(1);
  })
  .finally(async () => {
    await client.end();
  });
