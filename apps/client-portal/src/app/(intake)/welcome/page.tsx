'use client';

import {
  Body,
  Button,
  buildTheme,
  Row,
  Screen,
  Stack,
  TrustPill,
  VideoPlaceholder,
} from '@docket/ui';
import { usePortalNav } from '@/lib/portal-nav';

export default function WelcomePage() {
  const t = buildTheme({ tone: 'editorial', fonts: 'classic' });
  const nav = usePortalNav();

  const ic = {
    width: 11,
    height: 11,
    fill: 'none',
    stroke: t.rust,
    strokeWidth: 1.5,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };

  return (
    <Screen t={t}>
      <div
        style={{
          padding: '36px 24px 28px',
          display: 'flex',
          flexDirection: 'column',
          minHeight: '100%',
        }}
      >
        <Stack gap={26} style={{ flex: 1 }}>
          <VideoPlaceholder t={t} />

          <Stack gap={14} style={{ textAlign: 'center' }}>
            <div>
              <div
                style={{
                  fontFamily: t.serif,
                  fontWeight: 400,
                  fontSize: 26,
                  lineHeight: 1.15,
                  letterSpacing: -0.4,
                  color: t.ink,
                }}
              >
                Welcome to
                <br />
                <span style={{ fontStyle: 'italic' }}>Vazant Consulting</span>
              </div>
            </div>
            <Body t={t} size={14.5} style={{ maxWidth: 310, margin: '0 auto' }}>
              I&apos;m Antonio Vazquez, Enrolled Agent. Let&apos;s get your taxes handled.
              Answer a few questions — takes about 10 minutes.
            </Body>
          </Stack>

          <Row gap={6} justify="center" style={{ flexWrap: 'wrap' }}>
            <TrustPill
              t={t}
              icon={
                <svg {...ic} viewBox="0 0 11 11">
                  <rect x="2" y="4.5" width="7" height="5" rx="0.8" />
                  <path d="M3.5 4.5V3a2 2 0 014 0v1.5" />
                </svg>
              }
            >
              AES-256 encrypted
            </TrustPill>
            <TrustPill
              t={t}
              icon={
                <svg {...ic} viewBox="0 0 11 11">
                  <path d="M5.5 1l3 1.5v2.5c0 2-1.3 3.8-3 4.5-1.7-.7-3-2.5-3-4.5V2.5z" />
                  <path d="M4 5.5l1.2 1.2L7.5 4.2" />
                </svg>
              }
            >
              Enrolled Agent
            </TrustPill>
            <TrustPill
              t={t}
              icon={
                <svg {...ic} viewBox="0 0 11 11">
                  <circle cx="5.5" cy="5.5" r="4" />
                  <path d="M5.5 3.5v2l1.5 1" />
                </svg>
              }
            >
              ~10 minutes
            </TrustPill>
          </Row>
        </Stack>

        <Stack gap={14} style={{ marginTop: 28 }}>
          <Button
            t={t}
            onClick={() => nav.next('/tutorial')}
            style={{ width: '100%', padding: '15px 22px', fontSize: 15 }}
          >
            Let&apos;s get started
          </Button>
          <div
            style={{
              fontSize: 11.5,
              color: t.muted,
              lineHeight: 1.5,
              textAlign: 'center',
              maxWidth: 320,
              margin: '0 auto',
            }}
          >
            We&apos;ll ask about your filing status, income sources, and dependents.
            Then you&apos;ll upload your documents and sign your engagement letter.
          </div>
          <div
            style={{
              fontSize: 10,
              color: t.muted,
              letterSpacing: 0.4,
              textAlign: 'center',
              fontFamily: t.mono,
              textTransform: 'uppercase',
              paddingTop: 4,
            }}
          >
            Your information is never shared or sold
          </div>
        </Stack>
      </div>
    </Screen>
  );
}
