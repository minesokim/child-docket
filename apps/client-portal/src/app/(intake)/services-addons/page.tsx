'use client';

// Intake step 1B - Service add-ons.
// 1-to-1 port of ScreenServiceAddons from the JSX prototype.

import {
  AntonioNote,
  AskAntonioBar,
  Body,
  Button,
  buildTheme,
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
import { useIntakeField } from '@/lib/intake-context';
import { getNextStep, getPrevStep } from '@/lib/intake-flow';

export default function ServicesAddonsPage() {
  const t = buildTheme({ tone: 'editorial', fonts: 'classic' });
  const nav = usePortalNav();

  const [path] = useIntakeField<ServicePathId>('service.kind', 'personal');
  const [addons, setAddons] = useIntakeField<string[]>('service.addons', []);

  const pathDef = SERVICE_CATALOG.paths.find((p) => p.id === path) ?? SERVICE_CATALOG.paths[0]!;
  const list = SERVICE_CATALOG.addons[path] ?? [];
  const addonsSet = new Set(addons);

  const toggleAddon = (id: string) => {
    const next = new Set(addonsSet);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setAddons([...next]);
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

  const stateSnapshot = { service: { kind: path, addons } };
  const handleNext = () => {
    const target = getNextStep('/services-addons', stateSnapshot);
    if (target) nav.next(target);
  };
  const handleBack = () => {
    const target = getPrevStep('/services-addons', stateSnapshot);
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
        <IntakeHeader t={t} step={1} subStep="B" label="Services" />
        <div style={{ padding: '32px 24px 8px' }}>
          <Stack gap={16}>
            <Stack gap={10}>
              <H1 t={t}>Anything else going on?</H1>
              <Body t={t} size={15}>
                Select what applies. Skip if none of these fit.
              </Body>
              <div
                style={{
                  marginTop: 8,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '8px 16px',
                  background: t.ease.keylimeWash,
                  borderRadius: t.tone === 'magazine' ? 2 : 999,
                  alignSelf: 'flex-start',
                }}
              >
                <ServiceIcon t={t} kind={pathDef.icon} />
                <span style={{ fontSize: 12.5, color: t.inkSoft, letterSpacing: 0.1 }}>
                  Building on{' '}
                  <span style={{ color: t.ink, fontWeight: 500 }}>{pathDef.name}</span>
                </span>
                <span
                  onClick={handleBack}
                  style={{
                    fontFamily: t.serif,
                    fontStyle: 'italic',
                    fontSize: 11,
                    color: t.ease.forestDark,
                    cursor: 'pointer',
                    textDecoration: 'underline',
                    textUnderlineOffset: 2,
                  }}
                >
                  change
                </span>
              </div>
            </Stack>
            <AntonioNote t={t}>
              If none of these apply, skip ahead - I&apos;ll catch anything we miss during review.
            </AntonioNote>
          </Stack>
        </div>

        <Stack gap={10} style={{ padding: '24px 24px 16px', flex: 1 }}>
          {list.map((item) => {
            const selected = addonsSet.has(item.id);
            return (
              <div
                key={item.id}
                onClick={() => toggleAddon(item.id)}
                style={{
                  // Selected: green-tinted entire card (highlighted box).
                  // Unselected: white.
                  background: selected ? t.ease.mintKiss : '#fffefc',
                  borderRadius: t.radius,
                  padding: '14px 16px',
                  cursor: 'pointer',
                  boxShadow: selected
                    ? '0 4px 16px rgba(15, 62, 23, 0.08)'
                    : '0 1px 4px rgba(15, 62, 23, 0.04)',
                  transition: 'all 160ms cubic-bezier(.2,.8,.2,1)',
                }}
              >
                <Row gap={14} align="center">
                  <div
                    style={{
                      width: 22,
                      height: 22,
                      flexShrink: 0,
                      borderRadius: t.tone === 'magazine' ? 3 : 5,
                      // Light mint check well - forestDark check stroke
                      // for high contrast inside the pale fill.
                      background: selected ? t.ease.mintGlaze : t.ease.softNeutral,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'background 140ms',
                    }}
                  >
                    {selected && (
                      <svg width="12" height="10" viewBox="0 0 12 10">
                        <path
                          d="M1 5l3.5 3.5L11 1"
                          stroke={t.ease.forestDark}
                          strokeWidth="2"
                          fill="none"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    )}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 500, color: t.ink, marginBottom: 2, letterSpacing: -0.1 }}>
                      {item.name}
                    </div>
                    <div style={{ fontSize: 12.5, color: t.muted, lineHeight: 1.4 }}>
                      {item.sub}
                    </div>
                  </div>
                  <div
                    style={{
                      fontFamily: t.sans,
                      fontSize: 13,
                      color: selected ? t.ease.forestDark : t.muted,
                      fontWeight: selected ? 500 : 400,
                      whiteSpace: 'nowrap',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {item.fee}
                  </div>
                </Row>
              </div>
            );
          })}

          {/* Your estimate sits inline at the bottom of the scrollable
              content - not sticky. Scrolls with the addon list above
              so the AskAntonioBar + Continue button below stay
              uncluttered. */}
          <div
            style={{
              background: '#fffefc',
              borderRadius: t.radius,
              padding: '14px 16px 6px',
              marginTop: 6,
              boxShadow: '0 6px 18px rgba(60, 40, 28, 0.06)',
            }}
          >
            <Row justify="space-between" align="flex-start">
              <div>
                <div
                  style={{
                    fontFamily: t.sans,
                    fontSize: 12,
                    color: t.muted,
                    marginBottom: 4,
                  }}
                >
                  Your estimate
                </div>
                <div
                  style={{
                    // Sans, matches /services starting estimate. Tabular
                    // nums keeps the digit columns aligned as the range
                    // updates with addon toggles.
                    fontFamily: t.sans,
                    fontSize: 22,
                    color: t.ink,
                    letterSpacing: -0.4,
                    fontWeight: 500,
                    fontVariantNumeric: 'tabular-nums',
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
                  fontFamily: t.sans,
                  fontSize: 11,
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
        </Stack>

        <div
          style={{
            position: 'sticky',
            bottom: 0,
            background: `linear-gradient(to top, ${t.bg} 70%, transparent)`,
            padding: '20px 24px 28px',
          }}
        >
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
              Continue
            </Button>
          </Row>
        </div>
      </div>
    </Screen>
  );
}
