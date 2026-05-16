'use client';

// Form 8879 e-file authorization sign flow — index route.
//
// HISTORICAL: this file previously housed a `Sign8879Mock` flow gated
// behind `NEXT_PUBLIC_ENABLE_MOCK_8879=true`. The mock displayed
// HARDCODED tax figures (AGI / refund / SSN suffix / bank destination)
// that were NOT the taxpayer's real return, and used a fake signature
// pad to flip `engagement.signed = true` without DocuSign and without
// the IRS Pub 1345-required credit-bureau KBA.
//
// Mock removed 2026-05-15 per audit + PRODUCTION-READINESS §D
// pre-public-launch checklist. Even with the env gate, a single
// `vercel env add NEXT_PUBLIC_ENABLE_MOCK_8879 true production`
// turned the route into a legally-effectless 8879 issuer in front of
// real California taxpayers. Deleting the mock surface is the only
// SOC 2 + IRS-Pub-1345 compliant move.
//
// The real KBA-backed flow lives at `[id]/sign-iframe.tsx`. Real
// taxpayers reach it via the DocuSign envelope URL (which carries the
// envelope id, generated upstream in command-room by
// `apps/command-room/src/components/sign-8879-form.tsx` calling
// `request-sign-8879.ts`). The bare `/portal/sign-8879` URL (no id)
// was the destination of 4 in-app CTAs (signatures page, portal home,
// portal-stage map, _portal-frame.tsx pathname guard); those CTAs are
// now disabled at the source (Task 3 follow-up — see home/page.tsx
// + signatures/page.tsx + portal-stage.ts edits in this commit) so
// users no longer reach this placeholder via loop. Direct URL entry
// or a stale link is the only remaining path here, and the back
// button returns cleanly to /portal/home.
//
// The `NEXT_PUBLIC_ENABLE_MOCK_8879` env var is no longer read by any
// code path. It's been removed from `.env.example`.

import {
  Body,
  Button,
  buildTheme,
  Eyebrow,
  H1,
  Screen,
  Stack,
} from '@docket/ui';
import { useRouter } from 'next/navigation';

export default function Sign8879IndexPage() {
  const t = buildTheme({ tone: 'editorial', fonts: 'classic' });
  const router = useRouter();
  return (
    <Screen t={t}>
      <div
        style={{
          padding: '40px 24px 32px',
          display: 'flex',
          flexDirection: 'column',
          minHeight: '100%',
        }}
      >
        <Stack gap={20} style={{ flex: 1 }}>
          <Eyebrow t={t}>E-file authorization</Eyebrow>
          <H1 t={t}>We&apos;re wiring this up</H1>
          <Body t={t} size={15}>
            Your Form 8879 will be ready to sign once Antonio finishes preparing your
            return. We use DocuSign with identity verification (a short set of
            knowledge-based questions) so the IRS accepts the e-file authorization.
          </Body>
          <Body t={t} size={14}>
            We&apos;ll text and email you the moment it&apos;s your turn — no need to
            check back here.
          </Body>
        </Stack>
        <Button t={t} onClick={() => router.push('/portal/home')} style={{ width: '100%' }}>
          Back to portal
        </Button>
      </div>
    </Screen>
  );
}
