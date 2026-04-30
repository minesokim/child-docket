// Placeholder — full page port lands in the next intake batch (step 2 of 13).
// Keeps the route reachable so the services-addons "Continue" doesn't 404.

'use client';

import { Body, Button, buildTheme, H1, IntakeHeader, Screen, Stack } from '@docket/ui';
import { usePortalNav } from '@/lib/portal-nav';

export default function PersonalPage() {
  const t = buildTheme({ tone: 'editorial', fonts: 'classic' });
  const nav = usePortalNav();

  return (
    <Screen t={t}>
      <IntakeHeader t={t} step={2} label="Personal info" />
      <div
        style={{
          padding: '40px 24px',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          minHeight: 'calc(100% - 60px)',
        }}
      >
        <Stack gap={14} style={{ flex: 1 }}>
          <H1 t={t}>Personal info coming soon</H1>
          <Body t={t} size={15}>
            This step (full personal info form) ports from the prototype in the next batch.
          </Body>
        </Stack>
        <Button
          t={t}
          variant="ghost"
          onClick={() => nav.back('/services-addons')}
          style={{ width: '100%', padding: '16px 22px', fontSize: 16 }}
        >
          Back
        </Button>
      </div>
    </Screen>
  );
}
