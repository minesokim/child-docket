'use client';

// Intake step 1B — Service add-ons.
// 1-to-1 port of ScreenServiceAddons from the JSX prototype.

import {
  AntonioNote,
  AskAntonioBar,
  Body,
  Button,
  buildTheme,
  Card,
  H1,
  IntakeHeader,
  Row,
  Screen,
  ServiceIcon,
  type ServicePathId,
  type ServiceOtherSubId,
  SERVICE_CATALOG,
  Stack,
} from '@docket/ui';
import { usePortalNav } from '@/lib/portal-nav';
import { usePortalState } from '@/lib/portal-state';

type ServicePick = {
  path: ServicePathId;
  otherSub: ServiceOtherSubId | null;
  addons: string[];
};

const DEFAULT_PICK: ServicePick = { path: 'personal', otherSub: null, addons: [] };

export default function ServicesAddonsPage() {
  const t = buildTheme({ tone: 'editorial', fonts: 'classic' });
  const nav = usePortalNav();
  const [pick, setPick] = usePortalState<ServicePick>('service-pick', DEFAULT_PICK);

  const pathDef =
    SERVICE_CATALOG.paths.find((p) => p.id === pick.path) ?? SERVICE_CATALOG.paths[0]!;
  const list = SERVICE_CATALOG.addons[pick.path] ?? [];
  const addonsSet = new Set(pick.addons);

  const toggleAddon = (id: string) => {
    const next = new Set(addonsSet);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setPick({ ...pick, addons: [...next] });
  };

  // Build breakdown
  const breakdown: Array<{ id: string; name: string; fee: string; lo: number; hi: number }> = [
    { id: pathDef.id, name: pathDef.name, fee: pathDef.fee, lo: pathDef.lo, hi: pathDef.hi },
  ];
  for (const a of list) {
    if (addonsSet.has(a.id)) {
      breakdown.push({ id: a.id, name: a.name, fee: a.fee, lo: a.lo, hi: a.hi });
    }
  }
  const lo = breakdown.reduce((acc, s) => acc + s.lo, 0);
  const hi = breakdown.reduce((acc, s) => acc + s.hi, 0);

  const handleNext = () => {
    nav.next('/personal');
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
        <IntakeHeader t={t} step={1} subStep="B" label="Services" />
        <div style={{ padding: '32px 24px 8px' }}>
          <Stack gap={10}>
            <H1 t={t}>Anything else going on?</H1>
            <Body t={t} size={15}>
              Select what applies. Skip if none of these fit.
            </Body>
            <div
              style={{
                marginTop: 6,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '6px 10px',
                background: t.bgElev,
                border: `1px solid ${t.borderSoft}`,
                borderRadius: t.tone === 'magazine' ? 2 : 999,
                alignSelf: 'flex-start',
              }}
            >
              <ServiceIcon t={t} kind={pathDef.icon} />
              <span style={{ fontSize: 12.5, color: t.inkSoft }}>
                Building on{' '}
                <span style={{ color: t.ink, fontWeight: 500 }}>{pathDef.name}</span>
              </span>
              <span
                onClick={() => nav.back('/services')}
                style={{
                  fontFamily: t.serif,
                  fontStyle: 'italic',
                  fontSize: 12,
                  color: t.rustInk,
                  cursor: 'pointer',
                  textDecoration: 'underline',
                  textUnderlineOffset: 2,
                }}
              >
                change
              </span>
            </div>
          </Stack>
        </div>

        <Stack gap={10} style={{ padding: '24px 24px 16px', flex: 1 }}>
          {list.map((item) => {
            const selected = addonsSet.has(item.id);
            return (
              <Card
                key={item.id}
                t={t}
                onClick={() => toggleAddon(item.id)}
                selected={selected}
                tinted={selected}
                style={{ padding: '14px 16px' }}
              >
                <Row gap={14} align="center">
                  <div
                    style={{
                      width: 22,
                      height: 22,
                      flexShrink: 0,
                      borderRadius: t.tone === 'magazine' ? 3 : 5,
                      border: `1.5px solid ${selected ? t.rust : t.border}`,
                      background: selected ? t.rust : t.card,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {selected && (
                      <svg width="12" height="10" viewBox="0 0 12 10">
                        <path
                          d="M1 5l3.5 3.5L11 1"
                          stroke="#fff"
                          strokeWidth="2"
                          fill="none"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    )}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 500, color: t.ink, marginBottom: 2 }}>
                      {item.name}
                    </div>
                    <div style={{ fontSize: 12.5, color: t.muted, lineHeight: 1.4 }}>
                      {item.sub}
                    </div>
                  </div>
                  <div
                    style={{
                      fontFamily: t.mono,
                      fontSize: 12,
                      color: selected ? t.rustInk : t.muted,
                      fontWeight: selected ? 500 : 400,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {item.fee}
                  </div>
                </Row>
              </Card>
            );
          })}

          <div style={{ marginTop: 6 }}>
            <AntonioNote t={t}>
              If none of these apply, skip ahead — we&apos;ll catch anything I missed during review.
            </AntonioNote>
          </div>
        </Stack>

        <div
          style={{
            position: 'sticky',
            bottom: 0,
            background: `linear-gradient(to top, ${t.bg} 70%, transparent)`,
            padding: '20px 24px 28px',
          }}
        >
          <div
            style={{
              background: t.card,
              border: `1px solid ${t.border}`,
              borderRadius: t.radius,
              padding: '14px 16px 6px',
              marginBottom: 12,
              boxShadow: '0 6px 18px rgba(60, 40, 28, 0.06)',
            }}
          >
            <Row justify="space-between" align="flex-start">
              <div>
                <div
                  style={{
                    fontFamily: t.serif,
                    fontStyle: 'italic',
                    fontSize: 12.5,
                    color: t.muted,
                    marginBottom: 4,
                  }}
                >
                  Your estimate
                </div>
                <div
                  style={{
                    fontFamily: t.serif,
                    fontSize: 22,
                    color: t.ink,
                    letterSpacing: -0.4,
                  }}
                >
                  {lo === hi
                    ? lo === 0
                      ? 'Free'
                      : `$${lo.toLocaleString()}`
                    : `$${lo.toLocaleString()} – $${hi.toLocaleString()}`}
                </div>
              </div>
              <div
                style={{
                  fontFamily: t.serif,
                  fontStyle: 'italic',
                  fontSize: 11.5,
                  color: t.muted,
                  textAlign: 'right',
                  lineHeight: 1.4,
                  maxWidth: 140,
                  paddingTop: 2,
                }}
              >
                final quote after Antonio reviews
              </div>
            </Row>

            <div
              style={{
                marginTop: 12,
                paddingTop: 10,
                borderTop: `1px dashed ${t.borderSoft}`,
              }}
            >
              {breakdown.map((item) => (
                <div
                  key={item.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '7px 6px',
                    margin: '0 -6px',
                    borderRadius: 6,
                  }}
                >
                  <span style={{ color: t.rust, fontSize: 10, lineHeight: 1 }}>●</span>
                  <span
                    style={{
                      flex: 1,
                      minWidth: 0,
                      fontSize: 12.5,
                      color: t.inkSoft,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {item.name}
                  </span>
                  <span
                    style={{
                      fontFamily: t.mono,
                      fontSize: 11.5,
                      color: t.rustInk,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {item.fee}
                  </span>
                </div>
              ))}
            </div>
          </div>
          <div style={{ marginBottom: 12 }}>
            <AskAntonioBar t={t} />
          </div>
          <Row gap={10}>
            <Button
              t={t}
              variant="ghost"
              onClick={() => nav.back('/services')}
              style={{ flex: '0 0 auto' }}
            >
              Back
            </Button>
            <Button t={t} onClick={handleNext} style={{ flex: 1 }}>
              Continue
            </Button>
          </Row>
        </div>
      </div>
    </Screen>
  );
}
