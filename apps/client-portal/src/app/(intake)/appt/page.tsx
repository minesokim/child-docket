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
import { usePortalNav } from '@/lib/portal-nav';
import { usePortalState } from '@/lib/portal-state';

type ApptFormat = 'phone' | 'video' | 'inperson';

type ApptInfo = {
  format: ApptFormat;
  dateIdx: number;
  timeIdx: number;
};

const DEFAULT: ApptInfo = { format: 'video', dateIdx: 2, timeIdx: 1 };

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
  phone: 'Phone call',
  video: 'Video call · Google Meet',
  inperson: 'In person · Claremont',
};

// ─── Inline icons ────────────────────────────────────────────────

function IconPhone({ size = 16 }: { size?: number }) {
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
      <path d="M3 3h3l1 3-1.5 1a8 8 0 004 4l1-1.5 3 1v3a1 1 0 01-1 1A11 11 0 012 4a1 1 0 011-1z" />
    </svg>
  );
}

function IconVideo({ size = 16 }: { size?: number }) {
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
      <rect x="1.5" y="4" width="9" height="8" rx="1" />
      <path d="M10.5 7l4-2v6l-4-2z" />
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
}: {
  t: Theme;
  on: boolean;
  icon: React.ReactNode;
  label: string;
  sub: string;
  note?: string;
  onClick: () => void;
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
        background: on ? t.tintAccent : t.card,
        border: `1px solid ${on ? t.rust : t.border}`,
        borderRadius: t.radius,
        cursor: 'pointer',
        textAlign: 'left',
        fontFamily: t.sans,
        transition: 'border-color 120ms, background 120ms',
      }}
    >
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: 8,
          background: on ? t.rust : t.bgElev,
          border: `1px solid ${on ? 'transparent' : t.borderSoft}`,
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
              background: on ? '#fff' : t.tintAccent,
              border: `1px solid ${t.rustSoft}`,
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
          border: `1.5px solid ${on ? t.rust : t.border}`,
          background: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          marginTop: 1,
        }}
      >
        {on && <div style={{ width: 10, height: 10, borderRadius: '50%', background: t.rust }} />}
      </div>
    </button>
  );
}

export default function ApptPage() {
  const t = buildTheme({ tone: 'editorial', fonts: 'classic' });
  const nav = usePortalNav();
  const [info, setInfo] = usePortalState<ApptInfo>('appt', DEFAULT);

  const selDate = DATES[info.dateIdx] ?? DATES[0]!;
  const selTime = TIMES[info.timeIdx] ?? TIMES[0]!;

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
          <IntakeBackButton t={t} onClick={() => nav.back('/consent')} />
        </div>

        <div style={{ padding: '18px 24px 8px' }}>
          <Stack gap={10}>
            <H1 t={t}>Let&apos;s book your appointment</H1>
            <Body t={t} size={15}>
              Most returns take one 30-minute session.
            </Body>
          </Stack>
        </div>

        <Stack gap={24} style={{ padding: '22px 24px 16px', flex: 1 }}>
          <div>
            <FieldLabel t={t}>Format</FieldLabel>
            <Stack gap={10}>
              <FormatCard
                t={t}
                on={info.format === 'phone'}
                onClick={() => setInfo({ ...info, format: 'phone' })}
                icon={<IconPhone />}
                label="Phone call"
                sub="We'll go through your return over the phone"
              />
              <FormatCard
                t={t}
                on={info.format === 'video'}
                onClick={() => setInfo({ ...info, format: 'video' })}
                icon={<IconVideo />}
                label="Video call (Google Meet)"
                sub="Meet online, share screen"
              />
              <FormatCard
                t={t}
                on={info.format === 'inperson'}
                onClick={() => setInfo({ ...info, format: 'inperson' })}
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
                const on = info.dateIdx === i;
                return (
                  <button
                    key={i}
                    onClick={() => setInfo({ ...info, dateIdx: i })}
                    style={{
                      flex: '0 0 auto',
                      width: 58,
                      padding: '10px 0 12px',
                      borderRadius: 10,
                      background: on ? t.rust : t.card,
                      border: `1px solid ${on ? t.rust : t.border}`,
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 2,
                      fontFamily: t.sans,
                      transition: 'background 120ms, border-color 120ms',
                    }}
                  >
                    <span
                      style={{
                        fontFamily: t.mono,
                        fontSize: 10,
                        letterSpacing: 0.8,
                        color: on ? 'rgba(255,255,255,0.75)' : t.muted,
                        textTransform: 'uppercase',
                      }}
                    >
                      {d.d}
                    </span>
                    <span
                      style={{
                        fontFamily: t.serif,
                        fontSize: 22,
                        fontWeight: 500,
                        color: on ? '#fff' : t.ink,
                        letterSpacing: -0.5,
                        lineHeight: 1,
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
                const on = info.timeIdx === i;
                return (
                  <button
                    key={i}
                    onClick={() => setInfo({ ...info, timeIdx: i })}
                    style={{
                      padding: '14px 16px',
                      borderRadius: t.radius,
                      background: on ? t.tintAccent : t.card,
                      border: `1px solid ${on ? t.rust : t.border}`,
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
                        border: `1.5px solid ${on ? t.rust : t.border}`,
                        background: '#fff',
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
                            background: t.rust,
                          }}
                        />
                      )}
                    </div>
                  </button>
                );
              })}
            </Stack>
          </div>

          <AntonioNote t={t}>
            Pick whatever works. If none of these times work, message me and I&apos;ll open
            additional slots.
          </AntonioNote>
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
          <div
            style={{
              padding: '14px 16px',
              background: t.ink,
              borderRadius: t.radius,
              color: '#fff',
              marginBottom: 12,
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
                    fontFamily: t.serif,
                    fontSize: 18,
                    letterSpacing: -0.3,
                    lineHeight: 1.15,
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
                  {FORMAT_LABELS[info.format]} · 30 min
                </div>
              </div>
              <button
                style={{
                  flexShrink: 0,
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  background: 'rgba(255,255,255,0.1)',
                  border: '1px solid rgba(255,255,255,0.15)',
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

          <div style={{ marginBottom: 12 }}>
            <AskAntonioBar t={t} />
          </div>
          <Row gap={10}>
            <Button
              t={t}
              variant="ghost"
              onClick={() => nav.back('/consent')}
              style={{ flex: '0 0 auto' }}
            >
              Back
            </Button>
            <Button t={t} onClick={() => nav.next('/deposit')} style={{ flex: 1 }}>
              Continue to deposit
            </Button>
          </Row>
        </div>
      </div>
    </Screen>
  );
}
