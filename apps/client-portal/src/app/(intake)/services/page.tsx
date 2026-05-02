'use client';

// Intake step 1A - Service path selection.
// 1-to-1 port of ScreenServicePath from the JSX prototype.

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
import type { ServiceOtherSubKind } from '@docket/shared';

export default function ServicesPathPage() {
  const t = buildTheme({ tone: 'editorial', fonts: 'classic' });
  const nav = usePortalNav();

  const [path, setPathField] = useIntakeField<ServicePathId>('service.kind', 'personal');
  const [otherSub, setOtherSub] = useIntakeField<ServiceOtherSubKind | ''>(
    'service.otherSub',
    '',
  );

  const setPath = (id: ServicePathId) => {
    setPathField(id);
    // When switching off 'other', clear the otherSub (only relevant for 'other' path).
    if (id !== 'other' && otherSub) setOtherSub('');
  };

  const currentPath = SERVICE_CATALOG.paths.find((p) => p.id === path) ?? SERVICE_CATALOG.paths[0]!;
  const currentOther = otherSub
    ? SERVICE_CATALOG.otherSub.find((o) => o.id === otherSub) ?? null
    : null;

  const headline =
    path === 'other'
      ? currentOther
        ? currentOther.fee
        : 'Pick a service above'
      : currentPath.fee;

  const canContinue = path !== 'other' || !!otherSub;

  const stateSnapshot = { service: { kind: path, otherSub: otherSub || undefined } };
  const handleNext = () => {
    const target = getNextStep('/services', stateSnapshot);
    if (target) nav.next(target);
  };
  const handleBack = () => {
    const target = getPrevStep('/services', stateSnapshot);
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
        <IntakeHeader t={t} step={1} subStep="A" label="Services" />
        <div style={{ padding: '32px 24px 8px' }}>
          <Stack gap={16}>
            <Stack gap={10}>
              <H1 t={t}>What brings you in this year?</H1>
              <Body t={t} size={15}>
                Pick the one that fits best. I&apos;ll ask about add-ons next.
              </Body>
            </Stack>
            <AntonioNote t={t}>
              Not sure? Pick the closest match - we can adjust once I see your documents.
            </AntonioNote>
          </Stack>
        </div>

        <Stack gap={12} style={{ padding: '24px 24px 16px', flex: 1 }}>
          {SERVICE_CATALOG.paths.map((p) => {
            const on = path === p.id;
            // 'Something else' gets a neutral wash on select instead of
            // mintKiss - the sub-options below already carry green
            // accents, doubling up made the whole row feel saturated.
            const selectedBg = p.id === 'other' ? t.ease.softNeutral : t.ease.mintKiss;
            return (
            <div
              key={p.id}
              onClick={() => setPath(p.id)}
              style={{
                background: on ? selectedBg : '#fffefc',
                borderRadius: t.radius,
                padding: '16px 18px',
                cursor: 'pointer',
                boxShadow: on
                  ? '0 4px 20px rgba(15, 62, 23, 0.10)'
                  : '0 1px 4px rgba(15, 62, 23, 0.04)',
                // Slower easing curve so the highlight reads as gliding
                // between tiles when the user clicks across options. The
                // ease-out-quint tail (.16, 1, .3, 1) gives the feeling
                // of the selection settling into place rather than
                // snapping.
                transition: 'background 480ms cubic-bezier(.16, 1, .3, 1), box-shadow 360ms cubic-bezier(.2,.8,.2,1)',
              }}
            >
              <Row gap={16} align="center">
                <div
                  style={{
                    flexShrink: 0,
                    color: t.ease.forestDark,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <ServiceIcon t={t} kind={p.icon} size={44} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <Row justify="space-between" align="baseline" gap={10}>
                    <div style={{ fontSize: 16, fontWeight: 500, color: t.ink, letterSpacing: -0.1 }}>{p.name}</div>
                    <div
                      style={{
                        fontFamily: t.sans,
                        fontSize: 13,
                        color: on ? t.ease.forestDark : t.muted,
                        fontWeight: on ? 500 : 400,
                        whiteSpace: 'nowrap',
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      {p.fee}
                    </div>
                  </Row>
                  <div
                    style={{
                      fontSize: 13,
                      color: t.muted,
                      lineHeight: 1.45,
                      marginTop: 3,
                    }}
                  >
                    {p.sub}
                  </div>
                </div>
              </Row>

              {p.id === 'other' && path === 'other' && (
                <div style={{ marginTop: 18, paddingTop: 16 }}>
                  <div
                    style={{
                      fontFamily: t.sans,
                      fontSize: 12,
                      fontWeight: 400,
                      color: t.muted,
                      letterSpacing: 0,
                      marginBottom: 12,
                    }}
                  >
                    Which one?
                  </div>
                  <Stack gap={8}>
                    {SERVICE_CATALOG.otherSub.map((o) => {
                      const subOn = otherSub === o.id;
                      return (
                        <div
                          key={o.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            setOtherSub(o.id);
                          }}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 14,
                            padding: '14px 16px',
                            background: '#fffefc',
                            borderRadius: t.tone === 'magazine' ? 2 : 12,
                            cursor: 'pointer',
                            boxShadow: subOn
                              ? '0 2px 12px rgba(15, 62, 23, 0.10)'
                              : '0 1px 4px rgba(15, 62, 23, 0.04)',
                            transition: 'box-shadow 140ms cubic-bezier(.2,.8,.2,1)',
                          }}
                        >
                          <div
                            style={{
                              width: 22,
                              height: 22,
                              borderRadius: '50%',
                              background: subOn ? t.ease.forestMid : t.ease.softNeutral,
                              flexShrink: 0,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              transition: 'background 140ms',
                            }}
                          >
                            {subOn && (
                              <svg width="11" height="9" viewBox="0 0 11 9" fill="none">
                                <path
                                  d="M1 4.5l3 3L10 1"
                                  stroke="#fff"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                              </svg>
                            )}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <Row
                              justify="space-between"
                              align="baseline"
                              gap={8}
                              style={{ marginBottom: 2 }}
                            >
                              <div
                                style={{
                                  fontSize: 14,
                                  color: t.ink,
                                  fontWeight: subOn ? 500 : 400,
                                  letterSpacing: -0.1,
                                }}
                              >
                                {o.name}
                              </div>
                              <div
                                style={{
                                  fontFamily: t.sans,
                                  fontSize: 12,
                                  fontWeight: subOn ? 500 : 400,
                                  color: subOn ? t.ease.forestDark : t.muted,
                                  whiteSpace: 'nowrap',
                                  flexShrink: 0,
                                  fontVariantNumeric: 'tabular-nums',
                                }}
                              >
                                {o.fee}
                              </div>
                            </Row>
                            <div
                              style={{
                                fontSize: 12.5,
                                color: t.muted,
                                lineHeight: 1.4,
                              }}
                            >
                              {o.sub}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </Stack>
                </div>
              )}
            </div>
            );
          })}

          {/* Starting estimate sits inline at the bottom of the
              scrollable content - not sticky. Scrolls with the cards
              above so it doesn't compete with the AskAntonioBar +
              Continue button below. */}
          <div
            style={{
              background: '#fffefc',
              borderRadius: t.radius,
              padding: '14px 16px',
              marginTop: 6,
              boxShadow: '0 6px 18px rgba(60, 40, 28, 0.06)',
            }}
          >
            <Row justify="space-between" align="center">
              <div style={{ fontFamily: t.sans, fontSize: 12.5, color: t.muted }}>
                Starting estimate
              </div>
              <div
                style={{
                  fontFamily: t.sans,
                  fontSize: 20,
                  fontWeight: 500,
                  color: t.ink,
                  letterSpacing: -0.6,
                  fontFeatureSettings: '"tnum" 1, "lnum" 1',
                }}
              >
                {headline}
              </div>
            </Row>
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
            <Button t={t} onClick={handleNext} style={{ flex: 1 }} disabled={!canContinue}>
              {path === 'other' ? 'Continue' : 'Next - add-ons'}
            </Button>
          </Row>
        </div>
      </div>
    </Screen>
  );
}
