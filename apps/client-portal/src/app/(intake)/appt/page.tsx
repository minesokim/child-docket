'use client';

// Final intake step (post-13) — Schedule appointment. Format radio + date pills
// + time slots + summary card. 1-to-1 port of ScreenScheduleAppt.

import {
  AntonioNote,
  AskAntonioBar,
  Body,
  Button,
  buildTheme,
  FieldLabel,
  H1,
  IntakeBackButton,
  IntakeHeader,
  Row,
  Screen,
  Stack,
} from '@docket/ui';
import type { Theme } from '@docket/ui';
import * as React from 'react';
import { usePortalNav } from '@/lib/portal-nav';
import { useIntakeField } from '@/lib/intake-context';
import { getNextStep, getPrevStep } from '@/lib/intake-flow';

type ApptFormat = 'video' | 'inperson';

// Demo dates / times — would come from Antonio's calendar in v1
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

const FORMAT_LABELS: Record<ApptFormat, string> = {
  video: 'Video call · Google Meet',
  inperson: 'In person · Claremont',
};

// ─── Inline icons ────────────────────────────────────────────────

// Real Google Meet brand logo. Native multi-color SVG — not tinted by
// container `color`. Use at the standard meeting-app brand sizes.
function IconGoogleMeet({ size = 22 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 87.5 72"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Google Meet"
    >
      <path fill="#00832d" d="M49.5 36l8.53 9.75 11.47 7.33 2-17.02-2-16.64-11.69 6.44z" />
      <path fill="#0066da" d="M0 51.5V66c0 3.315 2.685 6 6 6h14.5l3-10.96-3-9.54-9.95-3z" />
      <path fill="#e94235" d="M20.5 0L0 20.5l10.55 3 9.95-3 2.95-9.41z" />
      <path fill="#2684fc" d="M0 20.5h20.5v31H0z" />
      <path
        fill="#00ac47"
        d="M82.6 8.68L69.5 19.42v33.66l13.13 10.79c1.97 1.54 4.85.135 4.85-2.37V11c0-2.535-2.945-3.925-4.88-2.32zM49.5 36v15.5h-29V72h43c3.315 0 6-2.685 6-6V53.08z"
      />
      <path fill="#ffba00" d="M63.5 0h-43v20.5h29V36l20-.04V6c0-3.315-2.685-6-6-6z" />
    </svg>
  );
}

function IconPin({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M8 14s5-4.5 5-8a5 5 0 10-10 0c0 3.5 5 8 5 8z" />
      <circle cx="8" cy="6" r="1.8" />
    </svg>
  );
}

function IconCalPlus({ size = 14 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="2" y="3" width="12" height="11" rx="1.5" />
      <path d="M2 6.5h12M5 2v3M11 2v3M8 8.5v3M6.5 10h3" />
    </svg>
  );
}

// ─── Format card (radio variant with icon + sub + optional badge) ─

function FormatCard({
  t,
  on,
  icon,
  label,
  sub,
  note,
  onClick,
  /** When true, the icon container stays white in both states so a
   *  multi-color brand logo (e.g. Google Meet) renders with native
   *  colors instead of being washed by a forest-green backdrop. */
  brandIcon,
}: {
  t: Theme;
  on: boolean;
  icon: React.ReactNode;
  label: string;
  sub: string;
  note?: string;
  onClick: () => void;
  brandIcon?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 14,
        width: '100%',
        padding: '14px 16px',
        background: on ? t.ease.mintGlaze : '#fffefc',
        borderRadius: t.radius,
        border: 'none',
        cursor: 'pointer',
        textAlign: 'left',
        fontFamily: t.sans,
        transition: 'background 120ms',
      }}
    >
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: 8,
          background: brandIcon ? '#fff' : on ? t.ease.forestDark : t.ease.keylimeWash,
          color: on ? '#fff' : t.inkSoft,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          marginTop: 1,
        }}
      >
        {icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 15,
            color: t.ink,
            fontWeight: 500,
            letterSpacing: -0.1,
            marginBottom: 2,
          }}
        >
          {label}
        </div>
        <div style={{ fontSize: 12.5, color: t.muted, lineHeight: 1.4 }}>{sub}</div>
        {note && (
          <div
            style={{
              marginTop: 6,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              fontFamily: t.mono,
              fontSize: 9.5,
              color: t.rustInk,
              letterSpacing: 0.7,
              textTransform: 'uppercase',
              padding: '3px 8px',
              background: on ? '#fff' : t.ease.keylimeWash,
              borderRadius: 999,
            }}
          >
            {note}
          </div>
        )}
      </div>
      <div
        style={{
          width: 20,
          height: 20,
          borderRadius: '50%',
          background: on ? t.ease.forestMid : t.ease.keylimeWash,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          marginTop: 1,
        }}
      >
        {on && <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#fff' }} />}
      </div>
    </button>
  );
}

export default function ApptPage() {
  const t = buildTheme({ tone: 'editorial', fonts: 'classic' });
  const nav = usePortalNav();
  const [format, setFormat] = useIntakeField<ApptFormat>('appointment.format', 'video');
  const [dateIdx, setDateIdx] = useIntakeField<number>('appointment.dateIdx', 2);
  const [timeIdx, setTimeIdx] = useIntakeField<number>('appointment.timeIdx', 1);

  const selDate = DATES[dateIdx] ?? DATES[0]!;
  const selTime = TIMES[timeIdx] ?? TIMES[0]!;

  // Gate the appointment summary card behind first interaction. The card
  // sticks around once any of {format, date, time} changes — we don't
  // want it to flicker away if the user clicks back to the same value.
  // Reveals with a subtle bottom-to-top slide.
  const [touched, setTouched] = React.useState(false);
  const touch = () => setTouched(true);

  const onFormat = (f: ApptFormat) => {
    setFormat(f);
    touch();
  };
  const onDate = (i: number) => {
    setDateIdx(i);
    touch();
  };
  const onTime = (i: number) => {
    setTimeIdx(i);
    touch();
  };

  const handleNext = () => {
    const target = getNextStep('/appt', {});
    if (target) nav.next(target);
  };
  const handleBack = () => {
    const target = getPrevStep('/appt', {});
    if (target) nav.back(target);
  };

  return (
    <Screen t={t}>
      <div
        style={{
          padding: '24px 0 0',
          display: 'flex',
          flexDirection: 'column',
          minHeight: '100%',
        }}
      >
        <IntakeHeader t={t} label="Schedule" total={13} />

        <div style={{ padding: '22px 24px 0' }}>
          <IntakeBackButton t={t} onClick={handleBack} />
        </div>

        <div style={{ padding: '18px 24px 8px' }}>
          <Stack gap={16}>
            <Stack gap={10}>
              <H1 t={t}>Let&apos;s book your appointment</H1>
              <Body t={t} size={15}>
                Most returns take one 30-minute session.
              </Body>
            </Stack>
            <AntonioNote t={t}>
              Pick whatever works. If none of these times work, message me and I&apos;ll open additional slots.
            </AntonioNote>
          </Stack>
        </div>

        <Stack gap={24} style={{ padding: '22px 24px 16px', flex: 1 }}>
          <div>
            <FieldLabel t={t}>Format</FieldLabel>
            <Stack gap={10}>
              <FormatCard
                t={t}
                on={format === 'video'}
                onClick={() => onFormat('video')}
                icon={<IconGoogleMeet size={22} />}
                brandIcon
                label="Video call (Google Meet)"
                sub="Meet online, share screen"
              />
              <FormatCard
                t={t}
                on={format === 'inperson'}
                onClick={() => onFormat('inperson')}
                icon={<IconPin />}
                label="In person"
                sub="My Claremont office, 35 mins from LA"
                note="Opening next month"
              />
            </Stack>
          </div>

          <div>
            <Row justify="space-between" align="baseline" style={{ marginBottom: 10 }}>
              <span
                style={{
                  fontFamily: t.sans,
                  fontSize: 14,
                  color: t.muted,
                }}
              >
                Pick a date
              </span>
              <span
                style={{
                  fontFamily: t.mono,
                  fontSize: 11,
                  color: t.muted,
                  letterSpacing: 0.4,
                }}
              >
                Mar 2026
              </span>
            </Row>
            <div
              style={{
                display: 'flex',
                gap: 8,
                overflowX: 'auto',
                paddingBottom: 4,
                marginLeft: -24,
                marginRight: -24,
                paddingLeft: 24,
                paddingRight: 24,
                scrollbarWidth: 'none',
              }}
            >
              {DATES.map((d, i) => {
                const on = dateIdx === i;
                return (
                  <button
                    key={i}
                    onClick={() => onDate(i)}
                    style={{
                      flex: '0 0 auto',
                      width: 58,
                      padding: '10px 0 12px',
                      borderRadius: 10,
                      border: 'none',
                      // Selected: lighter saturated mid-green (was the
                      // heavy forestDark slab). Reads as 'this is the
                      // day' without competing with the appointment
                      // summary card below.
                      background: on ? t.ease.mintGlaze : '#fffefc',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 2,
                      fontFamily: t.sans,
                      transition: 'background 120ms',
                      boxShadow: on
                        ? '0 2px 8px rgba(15, 62, 23, 0.10)'
                        : '0 1px 3px rgba(15, 62, 23, 0.04)',
                    }}
                  >
                    <span
                      style={{
                        fontFamily: t.mono,
                        fontSize: 10,
                        letterSpacing: 0.8,
                        color: on ? t.ease.forestDark : t.muted,
                        textTransform: 'uppercase',
                      }}
                    >
                      {d.d}
                    </span>
                    <span
                      style={{
                        fontFamily: t.sans,
                        fontSize: 20,
                        fontWeight: 500,
                        color: on ? t.ease.forestDark : t.ink,
                        letterSpacing: -0.3,
                        lineHeight: 1,
                        fontFeatureSettings: '"tnum" 1, "lnum" 1',
                      }}
                    >
                      {d.n}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <FieldLabel t={t}>Available times</FieldLabel>
            <Stack gap={8}>
              {TIMES.map((tm, i) => {
                const on = timeIdx === i;
                return (
                  <button
                    key={i}
                    onClick={() => onTime(i)}
                    style={{
                      padding: '14px 16px',
                      borderRadius: t.radius,
                      border: 'none',
                      background: on ? t.ease.mintGlaze : '#fffefc',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      fontFamily: t.sans,
                    }}
                  >
                    <span
                      style={{
                        fontFamily: t.mono,
                        fontSize: 14,
                        color: t.ink,
                        letterSpacing: 0.3,
                        fontWeight: on ? 500 : 400,
                      }}
                    >
                      {tm}
                    </span>
                    <div
                      style={{
                        width: 18,
                        height: 18,
                        borderRadius: '50%',
                        background: on ? t.ease.forestMid : t.ease.keylimeWash,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {on && (
                        <div
                          style={{
                            width: 9,
                            height: 9,
                            borderRadius: '50%',
                            background: '#fff',
                          }}
                        />
                      )}
                    </div>
                  </button>
                );
              })}
            </Stack>
          </div>

        </Stack>

        <div
          style={{
            position: 'sticky',
            bottom: 0,
            background: `linear-gradient(to top, ${t.bg} 75%, transparent)`,
            padding: '16px 24px 28px',
            marginTop: 12,
          }}
        >
          <style>{`
            @keyframes docket-appt-rise {
              from { opacity: 0; transform: translateY(16px); }
              to   { opacity: 1; transform: translateY(0); }
            }
          `}</style>
          {touched && (
            <div
              style={{
                padding: '14px 16px',
                background: t.ink,
                borderRadius: t.radius,
                color: '#fff',
                marginBottom: 12,
                animation: 'docket-appt-rise 320ms cubic-bezier(.2,.8,.2,1) both',
                willChange: 'opacity, transform',
              }}
            >
              <Row justify="space-between" align="flex-start">
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontFamily: t.sans,
                      fontSize: 11,
                      color: 'rgba(255,255,255,0.55)',
                      letterSpacing: 0.6,
                      textTransform: 'uppercase',
                      marginBottom: 6,
                    }}
                  >
                    Your appointment
                  </div>
                  <div
                    style={{
                      fontFamily: t.sans,
                      fontSize: 18,
                      fontWeight: 500,
                      letterSpacing: -0.3,
                      lineHeight: 1.2,
                      marginBottom: 4,
                    }}
                  >
                    {selDate.d}, {selDate.m} {selDate.n} · {selTime}
                  </div>
                  <div
                    style={{
                      fontSize: 12.5,
                      color: 'rgba(255,255,255,0.7)',
                    }}
                  >
                    {FORMAT_LABELS[format]} · 30 min
                  </div>
                </div>
                <button
                  style={{
                    flexShrink: 0,
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    border: 'none',
                    background: 'rgba(255,255,255,0.1)',
                    color: '#fff',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  aria-label="Add to calendar"
                >
                  <IconCalPlus size={14} />
                </button>
              </Row>
            </div>
          )}

          <div style={{ marginBottom: 12 }}>
            <AskAntonioBar t={t} />
          </div>
          <Row gap={10}>
            <Button
              t={t}
              variant="ghost"
              onClick={handleBack}
              style={{ flex: '0 0 auto' }}
            >
              Back
            </Button>
            <Button t={t} onClick={handleNext} style={{ flex: 1 }}>
              Continue to deposit
            </Button>
          </Row>
        </div>
      </div>
    </Screen>
  );
}
