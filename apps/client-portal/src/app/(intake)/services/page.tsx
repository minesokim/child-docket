'use client';

// Intake step 1A — Service path selection.
// 1-to-1 port of ScreenServicePath from the JSX prototype.

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
        : 'Pick a service below'
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
              Not sure? Pick the closest match — we can adjust once I see your documents.
            </AntonioNote>
          </Stack>
        </div>

        <Stack gap={12} style={{ padding: '24px 24px 16px', flex: 1 }}>
          {SERVICE_CATALOG.paths.map((p) => (
            <Card
              key={p.id}
              t={t}
              onClick={() => setPath(p.id)}
              selected={path === p.id}
              tinted={path === p.id}
              style={{ padding: '16px 18px' }}
            >
              <Row gap={14} align="flex-start">
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: t.tone === 'magazine' ? 4 : 10,
                    background: path === p.id ? t.rustSoft : t.bgElev,
                    border: `1px solid ${path === p.id ? t.rust : t.border}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    marginTop: 2,
                  }}
                >
                  <ServiceIcon t={t} kind={p.icon} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <Row justify="space-between" align="baseline" gap={10}>
                    <div style={{ fontSize: 16, fontWeight: 500, color: t.ink }}>{p.name}</div>
                    <div
                      style={{
                        fontFamily: t.mono,
                        fontSize: 12,
                        color: path === p.id ? t.rustInk : t.muted,
                        fontWeight: path === p.id ? 500 : 400,
                        whiteSpace: 'nowrap',
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

                  {p.id === 'other' && path === 'other' && (
                    <div
                      style={{
                        marginTop: 14,
                        paddingTop: 12,
                        borderTop: `1px dashed ${t.borderSoft}`,
                      }}
                    >
                      <div
                        style={{
                          fontFamily: t.serif,
                          fontStyle: 'italic',
                          fontSize: 13,
                          color: t.inkSoft,
                          marginBottom: 10,
                        }}
                      >
                        Which one?
                      </div>
                      <Stack gap={8}>
                        {SERVICE_CATALOG.otherSub.map((o) => (
                          <div
                            key={o.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              setOtherSub(o.id);
                            }}
                            style={{
                              display: 'flex',
                              alignItems: 'flex-start',
                              gap: 12,
                              padding: '12px',
                              background: otherSub === o.id ? t.rustSoft : t.bgElev,
                              border: `1px solid ${otherSub === o.id ? t.rust : t.border}`,
                              borderRadius: t.tone === 'magazine' ? 2 : 8,
                              cursor: 'pointer',
                            }}
                          >
                            <div
                              style={{
                                width: 16,
                                height: 16,
                                borderRadius: '50%',
                                border: `1.5px solid ${otherSub === o.id ? t.rust : t.border}`,
                                background: otherSub === o.id ? t.rust : 'transparent',
                                flexShrink: 0,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                marginTop: 2,
                              }}
                            >
                              {otherSub === o.id && (
                                <div
                                  style={{
                                    width: 6,
                                    height: 6,
                                    borderRadius: '50%',
                                    background: '#fff',
                                  }}
                                />
                              )}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <Row justify="space-between" align="baseline" gap={8} style={{ marginBottom: 2 }}>
                                <div style={{ fontSize: 14, color: t.ink, fontWeight: 500 }}>
                                  {o.name}
                                </div>
                                <div
                                  style={{
                                    fontFamily: t.mono,
                                    fontSize: 11,
                                    color: otherSub === o.id ? t.rustInk : t.muted,
                                    whiteSpace: 'nowrap',
                                    flexShrink: 0,
                                  }}
                                >
                                  {o.fee}
                                </div>
                              </Row>
                              <div style={{ fontSize: 12, color: t.muted, lineHeight: 1.4 }}>
                                {o.sub}
                              </div>
                            </div>
                          </div>
                        ))}
                      </Stack>
                    </div>
                  )}
                </div>
              </Row>
            </Card>
          ))}

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
              padding: '14px 16px',
              marginBottom: 12,
              boxShadow: '0 6px 18px rgba(60, 40, 28, 0.06)',
            }}
          >
            <Row justify="space-between" align="center">
              <div style={{ fontFamily: t.sans, fontSize: 12.5, color: t.muted }}>
                Starting estimate
              </div>
              <div
                style={{
                  fontFamily: t.serif,
                  fontSize: 20,
                  color: t.ink,
                  letterSpacing: -0.3,
                }}
              >
                {headline}
              </div>
            </Row>
          </div>
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
              {path === 'other' ? 'Continue' : 'Next — add-ons'}
            </Button>
          </Row>
        </div>
      </div>
    </Screen>
  );
}
