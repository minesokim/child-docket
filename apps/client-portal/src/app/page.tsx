import { buildTheme } from '@docket/ui/tokens';

export default function Page() {
  const t = buildTheme({ tone: 'editorial', fonts: 'classic' });

  return (
    <main
      style={{
        minHeight: '100vh',
        background: t.bg,
        color: t.ink,
        fontFamily: t.sans,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      <div style={{ maxWidth: 420, width: '100%' }}>
        <div
          style={{
            fontFamily: t.mono,
            fontSize: 11,
            color: t.rustInk,
            letterSpacing: 1.2,
            textTransform: 'uppercase',
            marginBottom: 14,
          }}
        >
          Docket · Client Portal
        </div>
        <h1
          style={{
            fontFamily: t.serif,
            fontSize: 44,
            color: t.ink,
            letterSpacing: -1.2,
            lineHeight: 1.05,
            margin: 0,
            marginBottom: 12,
          }}
        >
          Your tax filing, <em style={{ fontStyle: 'italic' }}>warmer</em>.
        </h1>
        <p style={{ fontSize: 16, color: t.inkSoft, lineHeight: 1.5, margin: 0 }}>
          v0 scaffold. The 36-screen intake + portal flow ports here next.
        </p>

        <div
          style={{
            marginTop: 32,
            padding: 16,
            background: t.card,
            border: `1px solid ${t.border}`,
            borderRadius: t.radius,
          }}
        >
          <div style={{ fontFamily: t.mono, fontSize: 10, color: t.muted, letterSpacing: 1, marginBottom: 6 }}>
            STATUS
          </div>
          <div style={{ fontFamily: t.serif, fontSize: 18, color: t.ink, letterSpacing: -0.2 }}>
            Scaffolding ready. Design port pending.
          </div>
        </div>
      </div>
    </main>
  );
}
