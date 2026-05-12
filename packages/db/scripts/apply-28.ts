// scripts/apply-28.ts
//
// One-shot apply + smoke for migration 0028 (authority_chunks.embedding).
// Follows the same pattern as scripts/apply-26-27.ts: the Drizzle journal
// is out-of-date past idx 16, so post-0016 migrations are applied
// directly via psql / pg client + verified with a focused smoke right
// after.
//
// USAGE
//   bun run packages/db/scripts/apply-28.ts                # apply + smoke
//   bun run packages/db/scripts/apply-28.ts --skip-apply   # smoke only
//
// FRESH-ENV BOOTSTRAP
//   Don't run this script directly to bootstrap a fresh DB — it only
//   applies 0028. The canonical fresh-env path is:
//
//     pnpm --filter @docket/db bootstrap
//
//   which chains: drizzle-kit migrate (covers 0000–0016 via the journal)
//   + apply-migrations-17-22.ts (covers 0017–0022) + apply-26-27.ts
//   (covers 0026 + 0027) + apply-28.ts (this script).
//
//   Until the Drizzle journal is reconciled (or the team migrates to a
//   manifest-based applier), every new migration past 0016 needs its
//   own apply script + a line added to the `bootstrap` script in
//   packages/db/package.json. Codex flagged this gap during C4 review.
//
// SAFETY
//   - Migration 0028 is purely additive: ADD COLUMN IF NOT EXISTS
//     (nullable, no default) + CREATE INDEX IF NOT EXISTS. Re-running
//     against an already-migrated DB is a no-op. Zero risk to existing
//     data.
//   - Smoke creates and tears down a synthetic authority + chunk in a
//     transaction wrapped in a try/finally so partial state never
//     leaks.
//   - Requires DATABASE_URL + PII_ENCRYPTION_KEY (the latter only
//     because @docket/db boots through the encryption module).

import { config as loadEnv } from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import postgres from 'postgres';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
loadEnv({ path: path.resolve(__dirname, '../../../.env.local'), override: true });

const RESET = '\x1b[0m';
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const DIM = '\x1b[2m';

const SKIP_APPLY = process.argv.includes('--skip-apply');

async function main(): Promise<void> {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error(`${RED}FATAL${RESET}: DATABASE_URL not set`);
    process.exit(2);
  }

  console.log(`${YELLOW}━━ apply-28 ━━${RESET}`);
  console.log(`Target: ${dbUrl.replace(/:[^:@]+@/, ':***@')}`);

  const sql = postgres(dbUrl, { max: 1, prepare: false });

  try {
    // 1. Apply migration 0028 (unless skipped).
    if (!SKIP_APPLY) {
      const migrationPath = path.resolve(
        __dirname,
        '../migrations/0028_authority_chunks_embedding.sql',
      );
      const ddl = readFileSync(migrationPath, 'utf8');
      console.log(`${DIM}Applying ${path.basename(migrationPath)}...${RESET}`);
      // postgres.unsafe runs raw SQL — required for DDL with multiple
      // statements + non-parameterized index creation.
      await sql.unsafe(ddl);
      console.log(`  ${GREEN}PASS${RESET}  migration applied`);
    } else {
      console.log(`${DIM}Skipping apply (--skip-apply); smoke only${RESET}`);
    }

    // 2. Verify column exists.
    const columnRows = await sql<{ data_type: string; udt_name: string }[]>`
      SELECT data_type, udt_name
        FROM information_schema.columns
       WHERE table_name = 'authority_chunks'
         AND column_name = 'embedding'
    `;
    if (columnRows.length === 0) {
      throw new Error('embedding column missing after migration');
    }
    if (columnRows[0]!.udt_name !== 'vector') {
      throw new Error(
        `embedding column has wrong type: udt_name=${columnRows[0]!.udt_name} (expected: vector)`,
      );
    }
    console.log(`  ${GREEN}PASS${RESET}  column exists ${DIM}udt_name=${columnRows[0]!.udt_name}${RESET}`);

    // 3. Verify HNSW index exists.
    const indexRows = await sql<{ indexname: string; indexdef: string }[]>`
      SELECT indexname, indexdef
        FROM pg_indexes
       WHERE tablename = 'authority_chunks'
         AND indexname = 'authority_chunks_embedding_hnsw_idx'
    `;
    if (indexRows.length === 0) {
      throw new Error('HNSW index missing after migration');
    }
    if (!indexRows[0]!.indexdef.toLowerCase().includes('hnsw')) {
      throw new Error(
        `index is not HNSW: ${indexRows[0]!.indexdef}`,
      );
    }
    console.log(
      `  ${GREEN}PASS${RESET}  HNSW index exists ${DIM}${indexRows[0]!.indexname}${RESET}`,
    );

    // 4. Insertion + cosine query smoke.
    //
    // Create a synthetic global authority (tenant_id NULL) + 3 chunks
    // with hand-crafted embeddings. Query by cosine distance, verify
    // the closest match is the chunk whose embedding most closely
    // matches the query vector.
    const SYNTH_PREFIX = `smoke-c4-${Date.now()}`;
    console.log(`${DIM}Smoke: synthetic prefix=${SYNTH_PREFIX}${RESET}`);

    try {
      // Hand-crafted 1024-dim vectors with DETERMINISTIC ordering under
      // cosine distance. Earlier draft used colinear vectors (all-0.1
      // and all-0.05) — codex flagged: those have identical cosine
      // direction so Postgres could return them in any order. Using
      // unit-vector-like sparse vectors with distinct cosine angles:
      //   queryVec = (1, 0, 0, ...)        — unit vector along dim 0
      //   embA     = (1, 0, 0, ...)        — same direction (cos=1, dist=0)
      //   embB     = (0.5, 0.866, 0, ...)  — 60° from queryVec (cos=0.5, dist=0.5)
      //   embC     = (-1, 0, 0, ...)       — anti-aligned (cos=-1, dist=2)
      // Three distinct cosine distances guarantee deterministic ORDER BY.
      const sparse = (...nonZero: [number, number][]): number[] => {
        const arr = new Array<number>(1024).fill(0);
        for (const [idx, val] of nonZero) arr[idx] = val;
        return arr;
      };
      const queryVecArr = sparse([0, 1]);
      const embA = sparse([0, 1]);             // identical to query: cos=1
      const embB = sparse([0, 0.5], [1, 0.866]); // 60° rotation: cos=0.5
      const embC = sparse([0, -1]);            // anti-aligned: cos=-1

      const formatVec = (v: number[]): string => `[${v.join(',')}]`;

      // Insert synthetic authority. NULL tenant_id (global scope is
      // fine for a smoke), kind=firm_memo + jurisdiction=firm is the
      // only valid combination for unanchored synthetic content;
      // citation_label/slug/title/effective_date are NOT NULL per
      // migration 0014.
      const [authority] = await sql<{ id: string }[]>`
        INSERT INTO authorities (
          tenant_id, kind, jurisdiction,
          citation_label, title, slug,
          effective_date
        ) VALUES (
          NULL,
          'firm_memo'::authority_kind,
          'firm'::authority_jurisdiction,
          ${`${SYNTH_PREFIX}-citation`},
          'Smoke C4 synthetic authority',
          ${`${SYNTH_PREFIX}-slug`},
          '2024-01-01'::date
        )
        RETURNING id
      `;
      if (!authority) throw new Error('authority insert returned no row');
      const authId = authority.id;

      // Insert 3 chunks (the trigger fills tenant_id from authorities;
      // it will stay NULL since we set authority.tenant_id NULL).
      await sql`
        INSERT INTO authority_chunks (
          authority_id, ordinal, text, content_hash, embedding
        ) VALUES (
          ${authId}, 0, ${'chunk-A: target text'}, ${`${SYNTH_PREFIX}-hash-A`},
          ${sql.unsafe(`'${formatVec(embA)}'::vector`)}
        )
      `;
      await sql`
        INSERT INTO authority_chunks (
          authority_id, ordinal, text, content_hash, embedding
        ) VALUES (
          ${authId}, 1, ${'chunk-B: middle distance'}, ${`${SYNTH_PREFIX}-hash-B`},
          ${sql.unsafe(`'${formatVec(embB)}'::vector`)}
        )
      `;
      await sql`
        INSERT INTO authority_chunks (
          authority_id, ordinal, text, content_hash, embedding
        ) VALUES (
          ${authId}, 2, ${'chunk-C: far'}, ${`${SYNTH_PREFIX}-hash-C`},
          ${sql.unsafe(`'${formatVec(embC)}'::vector`)}
        )
      `;
      console.log(`  ${GREEN}PASS${RESET}  inserted 3 chunks with embeddings`);

      // Cosine-distance query against queryVec.
      const queryVec = formatVec(queryVecArr);
      const results = await sql<{ text: string; distance: number }[]>`
        SELECT
          text,
          (embedding <=> ${sql.unsafe(`'${queryVec}'::vector`)}) AS distance
        FROM authority_chunks
        WHERE authority_id = ${authId}
          AND embedding IS NOT NULL
        ORDER BY embedding <=> ${sql.unsafe(`'${queryVec}'::vector`)}
        LIMIT 3
      `;

      if (results.length !== 3) {
        throw new Error(`expected 3 chunks back, got ${results.length}`);
      }
      if (results[0]!.text !== 'chunk-A: target text') {
        throw new Error(
          `closest chunk should be A, got: ${results[0]!.text} (distance=${results[0]!.distance})`,
        );
      }
      console.log(
        `  ${GREEN}PASS${RESET}  cosine query returned chunks in expected order ${DIM}A→B→C${RESET}`,
      );
      console.log(
        `    ${DIM}distances: A=${results[0]!.distance.toFixed(6)} B=${results[1]!.distance.toFixed(6)} C=${results[2]!.distance.toFixed(6)}${RESET}`,
      );

      // Verify BM25 (tsv) still works on the same row — embedding column
      // must not regress existing retrieval.
      const tsvResults = await sql<{ text: string }[]>`
        SELECT text
        FROM authority_chunks
        WHERE authority_id = ${authId}
          AND tsv @@ plainto_tsquery('english', 'target')
      `;
      if (tsvResults.length !== 1 || tsvResults[0]!.text !== 'chunk-A: target text') {
        throw new Error(
          `BM25 tsv query regressed: expected 1 match (chunk-A), got ${tsvResults.length} (${tsvResults.map((r) => r.text).join('|')})`,
        );
      }
      console.log(`  ${GREEN}PASS${RESET}  BM25 (tsv) co-exists with embedding (no regression)`);
    } finally {
      // Cleanup: cascade-delete via authority (chunks FK ON DELETE CASCADE).
      await sql`
        DELETE FROM authorities
         WHERE citation_label = ${`${SYNTH_PREFIX}-citation`}
      `;
      console.log(`${DIM}Cleanup: synthetic authority + chunks removed${RESET}`);
    }

    console.log(`${GREEN}━━ all checks passed ━━${RESET}`);
  } finally {
    await sql.end();
  }
}

main().catch((err) => {
  console.error(`${RED}FATAL${RESET}:`, err);
  process.exit(1);
});
