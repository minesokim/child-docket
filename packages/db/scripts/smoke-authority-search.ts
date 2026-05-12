// Smoke: searchAuthorities + lookupAuthorityByCitation against dev DB.
// Validates the seeded authorities are searchable + the citation-
// lookup verifier returns hits for known cites.

import { config as loadEnv } from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { sql } from 'drizzle-orm';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
loadEnv({ path: path.resolve(__dirname, '../../../.env.local'), override: true });

import {
  getAdminDb,
  searchAuthorities,
  lookupAuthorityByCitation,
} from '../src/index.js';

async function main() {
  const db = getAdminDb();
  const rows = await db.execute<{ id: string; [k: string]: unknown }>(
    sql`SELECT id::text AS id FROM tenants LIMIT 1`,
  );
  const tenants = rows as unknown as Array<{ id: string }>;
  if (tenants.length === 0) {
    console.log('No tenants on dev DB');
    process.exit(0);
  }
  const tenantId = tenants[0]!.id;
  console.log(`tenant: ${tenantId}\n`);

  // --- Search ---
  const queries = [
    'gross income',
    'home office deduction',
    'qualified business income',
    'KBA Form 8879',
    'CA residency',
    'self-employment $400',
  ];

  for (const q of queries) {
    const hits = await searchAuthorities(tenantId, q, { limit: 3 });
    console.log(`[search] "${q}" -> ${hits.length} hits`);
    for (const h of hits) {
      console.log(
        `   ${h.citation_label.padEnd(22)} rank=${h.rank.toFixed(4)}  ${h.heading?.slice(0, 50) ?? ''}`,
      );
    }
  }

  // Filter by jurisdiction
  console.log();
  const caHits = await searchAuthorities(tenantId, 'residency', {
    limit: 5,
    jurisdiction: 'CA',
  });
  console.log(`[CA-only] "residency" -> ${caHits.length} hits`);
  for (const h of caHits) {
    console.log(`   ${h.citation_label} (${h.jurisdiction})`);
  }

  // Filter by kind
  const ircHits = await searchAuthorities(tenantId, 'expense', {
    limit: 5,
    kinds: ['irc'],
  });
  console.log(`\n[IRC-only] "expense" -> ${ircHits.length} hits`);
  for (const h of ircHits) {
    console.log(`   ${h.citation_label} (${h.kind})`);
  }

  // --- Citation lookup ---
  console.log('\n--- citation lookup ---');
  const lookups = ['IRC §61(a)', 'IRC §199A', 'irc-280a-c', 'IRS Pub 1345', 'fake-cite'];
  for (const cite of lookups) {
    const found = await lookupAuthorityByCitation(tenantId, cite);
    console.log(`  "${cite}" -> ${found ? `${found.citation_label} (${found.kind})` : 'NULL'}`);
  }

  // --- reviewStatus gate (C5 round 2 P1) ---
  //
  // Verify firm_memo authorities are filtered by metadata->>'reviewStatus'
  // by default — DRAFT-DAVID must not surface to a default search call,
  // ANTONIO-VALIDATED must surface. `includeDrafts: true` opts back in to
  // unreviewed entries (dev/test/admin tooling only).
  //
  // Safety rationale: position-library ingest writes every draft as a
  // globally visible firm_memo row. Without this gate, an unreviewed
  // position would appear in Discovery / chat / audit-defense output
  // for any tenant. Default-deny posture verified here.
  console.log('\n--- reviewStatus gate (firm_memo, C5 round 2 P1) ---');
  // TOKEN is the only collision-domain on disk. Codex C5 round 3 P3
  // flagged that an earlier draft hardcoded "kalamazoo-token" in chunk
  // text and search-query, so an interrupted prior run (or any unrelated
  // row that happened to contain that phrase) would pollute the
  // assertions. Per-run unique token in BOTH text and query keeps the
  // smoke deterministic across crashes / re-runs.
  const TOKEN = `smokerevstat${Date.now()}${Math.floor(Math.random() * 1e6)}`;
  const probeQuery = TOKEN; // also the search probe — single token, no hyphens
  const draftCite = `${TOKEN}-DRAFT`;
  const valCite = `${TOKEN}-VALIDATED`;
  const draftLookupCite = `${TOKEN}-DRAFT-cite-lookup`;
  const valLookupCite = `${TOKEN}-VALIDATED-cite-lookup`;
  try {
    // Insert synthetic globals (tenant_id NULL).
    await db.execute(sql`
      INSERT INTO authorities (
        tenant_id, kind, jurisdiction,
        citation_label, title, slug, effective_date, metadata
      ) VALUES
        (NULL, 'firm_memo'::authority_kind, 'firm'::authority_jurisdiction,
         ${draftCite}, ${`Smoke draft memo about ${TOKEN}`},
         ${`${TOKEN}-draft-slug`}, '2024-01-01'::date,
         ${JSON.stringify({ reviewStatus: 'DRAFT-DAVID', positionId: 'p999' })}::jsonb),
        (NULL, 'firm_memo'::authority_kind, 'firm'::authority_jurisdiction,
         ${valCite}, ${`Smoke validated memo about ${TOKEN}`},
         ${`${TOKEN}-validated-slug`}, '2024-01-01'::date,
         ${JSON.stringify({ reviewStatus: 'ANTONIO-VALIDATED', positionId: 'p999' })}::jsonb),
        (NULL, 'firm_memo'::authority_kind, 'firm'::authority_jurisdiction,
         ${draftLookupCite}, ${`Lookup-only draft memo ${TOKEN}`},
         ${`${TOKEN}-draft-lookup-slug`}, '2024-01-01'::date,
         ${JSON.stringify({ reviewStatus: 'DRAFT-DAVID', positionId: 'p999' })}::jsonb),
        (NULL, 'firm_memo'::authority_kind, 'firm'::authority_jurisdiction,
         ${valLookupCite}, ${`Lookup-only validated memo ${TOKEN}`},
         ${`${TOKEN}-validated-lookup-slug`}, '2024-01-01'::date,
         ${JSON.stringify({ reviewStatus: 'ANTONIO-VALIDATED', positionId: 'p999' })}::jsonb)
    `);

    // Insert one chunk per authority so the search-via-tsv path returns.
    // The chunk text contains TOKEN (single token, no hyphens) so the
    // english tsvector matches `websearch_to_tsquery('english', TOKEN)`
    // deterministically without any natural-language collisions.
    await db.execute(sql`
      INSERT INTO authority_chunks (authority_id, ordinal, text, content_hash)
      SELECT id, 0, ${`Draft chunk discussing ${TOKEN} only`}, ${`${TOKEN}-draft-h`}
        FROM authorities WHERE citation_label = ${draftCite}
    `);
    await db.execute(sql`
      INSERT INTO authority_chunks (authority_id, ordinal, text, content_hash)
      SELECT id, 0, ${`Validated chunk discussing ${TOKEN} only`}, ${`${TOKEN}-val-h`}
        FROM authorities WHERE citation_label = ${valCite}
    `);

    // Default search (no includeDrafts): must return validated only.
    const defaultHits = await searchAuthorities(tenantId, probeQuery, {
      limit: 10,
    });
    const defaultCites = defaultHits.map((h) => h.citation_label).sort();
    console.log(`  [default search] -> ${defaultHits.length} hit(s): ${defaultCites.join(', ')}`);
    if (defaultHits.length !== 1 || defaultHits[0]!.citation_label !== valCite) {
      throw new Error(
        `default search should return ONLY the validated memo, got: ${defaultCites.join(',') || '(empty)'}`,
      );
    }
    console.log('  PASS  draft filtered, validated surfaces');

    // includeDrafts: true — must return both.
    const allHits = await searchAuthorities(tenantId, probeQuery, {
      limit: 10,
      includeDrafts: true,
    });
    const allCites = allHits.map((h) => h.citation_label).sort();
    console.log(`  [includeDrafts:true] -> ${allHits.length} hit(s): ${allCites.join(', ')}`);
    if (allHits.length !== 2) {
      throw new Error(
        `includeDrafts:true should return both memos, got ${allHits.length}: ${allCites.join(',')}`,
      );
    }
    console.log('  PASS  includeDrafts:true returns both draft + validated');

    // --- lookupAuthorityByCitation gate (C5 round 3 P1) ---
    //
    // Codex flagged that the lookup path was unguarded — discovery-agent
    // and notice-drafter both treat any resolved citation as verified,
    // so an injected/context-leaked draft cite would smuggle unreviewed
    // guidance into agent output even though searchAuthorities now hides
    // drafts. Defense-in-depth: lookupAuthorityByCitation defaults to
    // gated; opt-in via { includeDrafts: true } for dev/admin.
    console.log('\n--- lookupAuthorityByCitation gate (firm_memo, C5 round 3 P1) ---');
    const draftLookup = await lookupAuthorityByCitation(tenantId, draftLookupCite);
    console.log(`  [default lookup, draft cite] -> ${draftLookup ? draftLookup.citation_label : 'NULL'}`);
    if (draftLookup !== null) {
      throw new Error(
        `default lookup of a DRAFT-DAVID firm_memo cite should return NULL, got: ${draftLookup.citation_label}`,
      );
    }
    console.log('  PASS  draft cite filtered (returned NULL)');

    const valLookup = await lookupAuthorityByCitation(tenantId, valLookupCite);
    console.log(`  [default lookup, validated cite] -> ${valLookup ? valLookup.citation_label : 'NULL'}`);
    if (!valLookup || valLookup.citation_label !== valLookupCite) {
      throw new Error(
        `default lookup of an ANTONIO-VALIDATED firm_memo cite should resolve, got: ${valLookup ? valLookup.citation_label : 'NULL'}`,
      );
    }
    console.log('  PASS  validated cite resolves');

    const draftLookupOptIn = await lookupAuthorityByCitation(tenantId, draftLookupCite, {
      includeDrafts: true,
    });
    console.log(`  [includeDrafts lookup, draft cite] -> ${draftLookupOptIn ? draftLookupOptIn.citation_label : 'NULL'}`);
    if (!draftLookupOptIn || draftLookupOptIn.citation_label !== draftLookupCite) {
      throw new Error(
        `includeDrafts:true lookup of a DRAFT-DAVID firm_memo cite should resolve, got: ${draftLookupOptIn ? draftLookupOptIn.citation_label : 'NULL'}`,
      );
    }
    console.log('  PASS  includeDrafts:true restores draft cite resolution');
  } finally {
    // Cascade via authorities (authority_chunks FK ON DELETE CASCADE).
    await db.execute(sql`
      DELETE FROM authorities
       WHERE citation_label IN (
         ${draftCite}, ${valCite}, ${draftLookupCite}, ${valLookupCite}
       )
    `);
    console.log('  cleanup: synthetic firm_memo rows removed');
  }

  console.log('\nSMOKE OK');
}

main().catch((err) => {
  console.error('smoke-authority-search FAILED:', err);
  process.exit(1);
});
