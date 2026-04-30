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
        padding: '60px 40px',
      }}
    >
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <div
          style={{
            display: 'inline-flex',
            gap: 10,
            alignItems: 'center',
            padding: '6px 14px',
            background: t.tintAccent,
            borderRadius: 999,
            marginBottom: 20,
          }}
        >
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: t.rust }} />
          <span style={{ fontFamily: t.mono, fontSize: 11, color: t.rustInk, letterSpacing: 1 }}>
            DOCKET v0 · COMMAND ROOM
          </span>
        </div>

        <h1
          style={{
            fontFamily: t.serif,
            fontSize: 56,
            color: t.ink,
            letterSpacing: -1.4,
            lineHeight: 1.05,
            margin: 0,
            marginBottom: 14,
            maxWidth: 900,
          }}
        >
          Your practice. Every tool. <em style={{ fontStyle: 'italic' }}>One operator.</em>
        </h1>
        <p style={{ fontSize: 17, color: t.inkSoft, maxWidth: 620, lineHeight: 1.5, margin: 0 }}>
          v0 scaffold. The morning brief, unified inbox, pipeline, practice intelligence, and
          command palette ship over the next 12 weeks.
        </p>

        <div
          style={{
            marginTop: 48,
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: 20,
          }}
        >
          {[
            ['Morning brief', 'Cron-driven daily summary'],
            ['Unified inbox', 'SMS · email · portal · voicemail'],
            ['Pipeline', 'Every client, every stage'],
            ['Practice intelligence', 'Margin · friction · capacity'],
            ['Outcome prediction', 'Position-level audit risk'],
            ['Command palette', 'Every tool, one keystroke'],
          ].map(([k, v]) => (
            <div
              key={k}
              style={{
                padding: 20,
                background: t.card,
                border: `1px solid ${t.border}`,
                borderRadius: t.radius,
              }}
            >
              <div style={{ fontFamily: t.serif, fontSize: 18, color: t.ink, letterSpacing: -0.2, marginBottom: 4 }}>
                {k}
              </div>
              <div style={{ fontSize: 13, color: t.muted }}>{v}</div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
