'use client';

import { useRouter } from 'next/navigation';
import {
  AntonioNote,
  Body,
  BottomBar,
  Button,
  buildTheme,
  Footer,
  H1,
  Screen,
  Stack,
} from '@docket/ui';

function VideoCard({ t }: { t: ReturnType<typeof buildTheme> }) {
  return (
    <div
      style={{
        width: '100%',
        aspectRatio: '16 / 9',
        borderRadius: t.radius,
        overflow: 'hidden',
        position: 'relative',
        background: 'linear-gradient(135deg, #1a3a26 0%, #0c1f15 70%, #050a07 100%)',
        cursor: 'pointer',
        boxShadow: '0 8px 24px rgba(12, 31, 21, 0.18)',
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(ellipse at 25% 20%, rgba(120, 180, 140, 0.12), transparent 55%)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.015) 2px, rgba(255,255,255,0.015) 3px)',
          mixBlendMode: 'overlay',
        }}
      />
      <div style={{ position: 'absolute', top: 14, left: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
        <div
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: '#d94545',
            boxShadow: '0 0 0 3px rgba(217, 69, 69, 0.22)',
          }}
        />
        <span
          style={{
            fontFamily: t.mono,
            fontSize: 9.5,
            color: 'rgba(255,255,255,0.75)',
            letterSpacing: 1.2,
            textTransform: 'uppercase',
          }}
        >
          REC · ANTONIO
        </span>
      </div>

      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 14,
        }}
      >
        <div
          style={{
            width: 68,
            height: 68,
            borderRadius: '50%',
            background: 'rgba(255, 255, 255, 0.15)',
            border: '1.5px solid rgba(255, 255, 255, 0.35)',
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.25)',
            transition: 'transform 0.15s',
          }}
        >
          <svg width="22" height="24" viewBox="0 0 22 24" fill="none" style={{ marginLeft: 4 }}>
            <path d="M2 2 L20 12 L2 22 Z" fill="#fff" />
          </svg>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              fontFamily: t.serif,
              fontSize: 17,
              color: '#fff',
              letterSpacing: -0.2,
              fontStyle: 'italic',
              marginBottom: 4,
            }}
          >
            A message from Antonio
          </div>
          <div
            style={{
              fontFamily: t.mono,
              fontSize: 10.5,
              color: 'rgba(255,255,255,0.6)',
              letterSpacing: 0.8,
            }}
          >
            1:12 · TAP TO PLAY
          </div>
        </div>
      </div>

      <div
        style={{
          position: 'absolute',
          bottom: 10,
          left: 14,
          right: 14,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <span
          style={{
            fontFamily: t.mono,
            fontSize: 9,
            color: 'rgba(255,255,255,0.55)',
            letterSpacing: 0.5,
          }}
        >
          0:00
        </span>
        <div style={{ flex: 1, height: 2, borderRadius: 2, background: 'rgba(255,255,255,0.2)' }} />
        <span
          style={{
            fontFamily: t.mono,
            fontSize: 9,
            color: 'rgba(255,255,255,0.55)',
            letterSpacing: 0.5,
          }}
        >
          1:12
        </span>
      </div>
    </div>
  );
}

export default function WelcomePage() {
  const t = buildTheme({ tone: 'editorial', fonts: 'classic' });
  const router = useRouter();

  return (
    <Screen t={t}>
      <div
        style={{
          padding: '40px 24px 0',
          display: 'flex',
          flexDirection: 'column',
          minHeight: '100%',
        }}
      >
        <Stack gap={28} style={{ flex: 1 }}>
          <Stack gap={14}>
            <H1 t={t}>You&apos;re in.</H1>
            <Body t={t} size={16}>
              Before you start, take a minute. Antonio recorded a short message for you about how this works.
            </Body>
          </Stack>

          <VideoCard t={t} />

          <AntonioNote t={t}>
            Most filing apps make you fight a form. We do it differently — I&apos;ll guide
            you, and we&apos;ll get it right the first time.
          </AntonioNote>
        </Stack>

        <BottomBar t={t}>
          <Button
            t={t}
            onClick={() => router.push('/services')}
            style={{ width: '100%', padding: '16px 22px', fontSize: 16 }}
          >
            Continue
          </Button>
        </BottomBar>

        <Footer t={t} />
      </div>
    </Screen>
  );
}
