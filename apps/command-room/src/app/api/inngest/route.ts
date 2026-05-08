// Inngest serve handler — lazy-loaded.
//
// The standard pattern is a top-level `import { serve, inngest,
// functions }` + static export of GET/POST/PUT. That doesn't work
// here because @docket/workers transitively imports
// @docket/document-processing → sharp. Sharp's native binary is only
// loaded at runtime in production (linux-x64), but Next.js's build-
// time "collect page data" phase evaluates this route's imports
// eagerly, hitting sharp before the binary is wired up. Result:
//
//   Error: Could not load the "sharp" module using the linux-x64 runtime
//   [Error: Failed to collect page data for /api/inngest]
//
// `serverExternalPackages` in next.config tells webpack NOT to bundle
// sharp, but Next still IMPORTS the module during page-data analysis,
// which is what fails.
//
// Fix: dynamic-import the workers package + serve helper inside the
// route handlers themselves. Build phase analyzes only the wrappers
// (no sharp). At request time, the lazy imports resolve, sharp's
// binary loads from node_modules, and the actual handler runs.
//
// Cached singleton — first request initializes; subsequent requests
// reuse. No measurable cold-start penalty after the first invocation.

import { type NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type RouteHandlers = {
  GET: (req: NextRequest) => Promise<Response>;
  POST: (req: NextRequest) => Promise<Response>;
  PUT: (req: NextRequest) => Promise<Response>;
};

let _handlers: RouteHandlers | null = null;

// Production-only signing key assertion.
//
// Inngest's `serve` handler will *quietly* run unsigned in dev (which
// is fine), but in production it must reject any inbound POST that
// isn't signed by Inngest cloud. Without INNGEST_SIGNING_KEY, the serve
// handler silently degrades to "anyone on the internet can POST events
// and trigger functions." This assertion fails closed at the first
// request so a missing env var surfaces immediately as a 500 with a
// loud log line instead of an open endpoint.
function assertProdSigningKey(): void {
  if (process.env.NODE_ENV !== 'production') return;
  if (process.env.INNGEST_SIGNING_KEY && process.env.INNGEST_SIGNING_KEY.length > 0) return;
  console.error(
    '[api/inngest] INNGEST_SIGNING_KEY missing in production — refusing to serve. ' +
      'Set the env var on Vercel and redeploy.',
  );
  throw new Error('INNGEST_SIGNING_KEY is required in production');
}

async function getHandlers(): Promise<RouteHandlers> {
  if (_handlers) return _handlers;
  assertProdSigningKey();
  const [{ serve }, workers] = await Promise.all([
    import('inngest/next'),
    import('@docket/workers'),
  ]);
  _handlers = serve({
    client: workers.inngest,
    functions: workers.functions,
  }) as unknown as RouteHandlers;
  return _handlers;
}

export async function GET(req: NextRequest): Promise<Response> {
  const h = await getHandlers();
  return h.GET(req);
}

export async function POST(req: NextRequest): Promise<Response> {
  const h = await getHandlers();
  return h.POST(req);
}

export async function PUT(req: NextRequest): Promise<Response> {
  const h = await getHandlers();
  return h.PUT(req);
}
