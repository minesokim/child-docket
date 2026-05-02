'use client';

// Final intake screen — completion. Confetti-adjacent success mark +
// appointment summary + "what happens next" timeline.
//
// Visual: ease.health aesthetic. Display headline (light weight 300,
// forestDark color). Appointment card uses the keylimeWash accent so
// it reads as a celebration tile rather than another generic card.
// Routes to portal home when wired.

import {
  Body,
  Button,
  buildTheme,
  Card,
  Eyebrow,
  HandCheckmark,
  Row,
  Screen,
  Stack,
} from '@docket/ui';
import type { Theme } from '@docket/ui';
import { useEffect } from 'react';
import { usePortalNav } from '@/lib/portal-nav';
import { useIntakeField } from '@/lib/intake-context';
import { completeIntake } from '@/lib/intake';

type ApptFormat = 'phone' | 'video' | 'inperson';

const DATES = [
  { d: 'Mon', n: 3, m: 'Mar' },
  { d: 'Tue', n: 4, m: 'Mar' },
  { d: 'Wed', n: 5, m: 'Mar' },
  { d: 'Thu', n: 6, m: 'Mar' },
  { d: 'Fri', n: 7, m: 'Mar' },
  { d: 'Sat', n: 8, m: 'Mar' },
  { d: 'Mon', n: 10, m: 'Mar' },
];
const TIMES = ['9:00 AM', '10:30 AM', '1:00 PM', '2:30 PM', '4:00 PM'];
const DAY_NAMES: Record<string, string> = {
  Mon: 'Monday',
  Tue: 'Tuesday',
  Wed: 'Wednesday',
  Thu: 'Thursday',
  Fri: 'Friday',
  Sat: 'Saturday',
  Sun: 'Sunday',
};
const FORMAT_LABELS: Record<ApptFormat, string> = {
  phone: 'Phone call',
  video: 'Google Meet',
  inperson: 'Claremont office',
};

function StepRow({
  t,
  n,
  title,
  sub,
  isFirst,
  isLast,
}: {
  t: Theme;
  n: number;
  title: string;
  sub: string;
  isFirst: boolean;
  isLast: boolean;
}) {
  return (
    <Row gap={14} align="flex-start" style={{ position: 'relative' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: '50%',
            background: isFirst ? t.rust : t.bgElev,
            border: `1px solid ${isFirst ? t.rust : t.border}`,
            color: isFirst ? '#fff' : t.muted,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: t.mono,
            fontSize: 12,
            fontWeight: 500,
            flexShrink: 0,
          }}
        >
          {n}
        </div>
        {!isLast && (
          <div
            style={{
              width: 1,
              flex: 1,
              background: t.border,
              minHeight: 28,
              margin: '4px 0',
            }}
          />
        )}
      </div>
      <div style={{ paddingBottom: !isLast ? 20 : 0, flex: 1 }}>
        <div style={{ fontSize: 15, color: t.ink, fontWeight: 500 }}>{title}</div>
        <div style={{ fontSize: 13, color: t.muted, marginTop: 2 }}>{sub}</div>
      </div>
    </Row>
  );
}

export default function DonePage() {
  const t = buildTheme({ tone: 'editorial', fonts: 'classic' });
  const nav = usePortalNav();

  const [format] = useIntakeField<ApptFormat>('appointment.format', 'video');
  const [dateIdx] = useIntakeField<number>('appointment.dateIdx', 2);
  const [timeIdx] = useIntakeField<number>('appointment.timeIdx', 1);
  const [fullName] = useIntakeField<string>('personal.fullName', '');

  // Mark intake complete on first arrival here.
  useEffect(() => {
    void completeIntake();
  }, []);

  const firstName = (fullName || '').split(' ')[0] || 'friend';
  const selDate = DATES[dateIdx] ?? DATES[0]!;
  const selTime = TIMES[timeIdx] ?? TIMES[0]!;
  const dayName = DAY_NAMES[selDate.d] ?? selDate.d;

  const steps = [
    { n: 1, title: 'Antonio reviews your intake', sub: 'Within 24 hours' },
    { n: 2, title: 'You get a confirmation text & email', sub: 'From (951) 555-0234' },
    { n: 3, title: 'Upload remaining documents', sub: 'In the portal — W-2s, 1099s, etc.' },
    {
      n: 4,
      title: 'Antonio prepares your return',
      sub: "You'll review & e-sign Form 8879",
    },
  ];

  return (
    <Screen t={t}>
      <div
        style={{
          padding: '48px 24px 32px',
          display: 'flex',
          flexDirection: 'column',
          minHeight: '100%',
        }}
      >
        <Stack gap={28} style={{ flex: 1 }}>
          <Row justify="center">
            <HandCheckmark t={t} size={128} />
          </Row>

          <Stack gap={12} style={{ textAlign: 'center', padding: '0 8px' }}>
            {/* Display headline at ease's light weight (300). The whole
                screen is a celebratory hero — let the type carry it. */}
            <div
              style={{
                fontFamily: t.serif,
                fontWeight: 300,
                fontSize: 38,
                lineHeight: 1.1,
                letterSpacing: -1.2,
                color: t.ease.forestDark,
                margin: 0,
              }}
            >
              You&apos;re all set, <span style={{ fontStyle: 'italic' }}>{firstName}</span>
            </div>
            <Body t={t} size={15}>
              Antonio will review your submission within 24 hours and reach out to confirm your
              appointment. You&apos;ll receive a text and email when he&apos;s reviewed your info.
            </Body>
          </Stack>

          {/* Appointment card with keylimeWash accent — reads as a
              celebration tile, not a generic info card. The eyebrow
              line drops the rust band; the accent fill carries the
              same job with less visual chrome. */}
          <Card t={t} accent="keylimeWash" style={{ padding: 0, overflow: 'hidden' }}>
            <div
              style={{
                padding: '14px 20px 0',
                fontFamily: t.mono,
                fontSize: 10,
                color: t.ease.forestDark,
                letterSpacing: 1.2,
                textTransform: 'uppercase',
                opacity: 0.7,
              }}
            >
              Your appointment
            </div>
            <div style={{ padding: '8px 20px 20px' }}>
              <Stack gap={14}>
                <div>
                  <div
                    style={{
                      fontFamily: t.serif,
                      fontWeight: 400,
                      fontSize: 26,
                      lineHeight: 1.15,
                      color: t.ease.forestDark,
                      letterSpacing: -0.78,
                    }}
                  >
                    {dayName}, {selDate.m} {selDate.n}
                  </div>
                  <div
                    style={{
                      fontFamily: t.sans,
                      fontSize: 14,
                      color: t.ease.forestDark,
                      opacity: 0.75,
                      marginTop: 4,
                      letterSpacing: -0.42,
                    }}
                  >
                    {selTime} PT · {FORMAT_LABELS[format]}
                  </div>
                </div>
                <Row gap={8}>
                  <Button
                    t={t}
                    variant="ghost"
                    style={{
                      flex: 1,
                      padding: '10px 14px',
                      fontSize: 13,
                      // Override Card-accent context: keep the ghost
                      // button readable on the keylime fill.
                      background: '#fffefc',
                      border: `1px solid ${t.ease.forestDark}33`,
                      color: t.ease.forestDark,
                    }}
                  >
                    Add to calendar
                  </Button>
                  <Button
                    t={t}
                    variant="ghost"
                    style={{
                      flex: 1,
                      padding: '10px 14px',
                      fontSize: 13,
                      background: '#fffefc',
                      border: `1px solid ${t.ease.forestDark}33`,
                      color: t.ease.forestDark,
                    }}
                  >
                    Reschedule
                  </Button>
                </Row>
              </Stack>
            </div>
          </Card>

          <div>
            <Eyebrow t={t} style={{ marginBottom: 14 }}>
              What happens next
            </Eyebrow>
            <Stack gap={0}>
              {steps.map((s, i) => (
                <StepRow
                  key={i}
                  t={t}
                  n={s.n}
                  title={s.title}
                  sub={s.sub}
                  isFirst={i === 0}
                  isLast={i === steps.length - 1}
                />
              ))}
            </Stack>
          </div>

          <Button
            t={t}
            onClick={() => nav.jump('/portal/home')}
            style={{ width: '100%', padding: '16px' }}
          >
            Go to your portal →
          </Button>
        </Stack>

        <div
          style={{
            marginTop: 20,
            textAlign: 'center',
            fontFamily: t.mono,
            fontSize: 10,
            color: t.muted,
            letterSpacing: 0.5,
          }}
        >
          ANTONIO VAZQUEZ, ENROLLED AGENT · CLAREMONT, CA
        </div>
      </div>
    </Screen>
  );
}
