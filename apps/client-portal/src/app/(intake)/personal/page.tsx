// Placeholder — full page port lands in next batch (step 2 of 13: personal info).
// For now, navigates back to keep the build green and the route reachable.

'use client';

import { useRouter } from 'next/navigation';
import { Body, Button, buildTheme, Footer, H1, IntakeHeader, Screen, Stack } from '@docket/ui';

export default function PersonalPage() {
  const t = buildTheme({ tone: 'editorial', fonts: 'classic' });
  const router = useRouter();

  return (
    <Screen t={t}>
      <IntakeHeader t={t} step={2} label="Personal info" />
      <div style={{ padding: '40px 24px', display: 'flex', flexDirection: 'column', gap: 16, minHeight: 'calc(100% - 60px)' }}>
        <Stack gap={14} style={{ flex: 1 }}>
          <H1 t={t}>Personal info coming soon</H1>
          <Body t={t} size={15}>
            This step (full personal info form) ports from the prototype in the next batch. For
            now, this is a placeholder that keeps the route reachable.
          </Body>
        </Stack>
        <Button
          t={t}
          variant="ghost"
          onClick={() => router.push('/services')}
          style={{ width: '100%', padding: '16px 22px', fontSize: 16 }}
        >
          Back
        </Button>
        <Footer t={t} />
      </div>
    </Screen>
  );
}
