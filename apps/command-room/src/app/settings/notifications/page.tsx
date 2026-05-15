// /settings/notifications — preparer-facing notification preferences.
//
// Per CLAUDE.md §8 Notifications. Four event categories × three
// channels. V0 surface: read-only diagnostic + seed-defaults action.
// Per-category edit UI lands in v1.5.

import { sql } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { withTenant } from '@docket/db';
import type { TenantId } from '@docket/shared';
import { getCurrentDocketUser } from '@/lib/current-user';
import { CommandShell } from '@/components/command-shell';
import { SeedNotificationsButton } from './seed-button';
import '../settings.css';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Category = 'deadlines' | 'ai_alerts' | 'client_activity' | 'system';

interface NotificationRow {
  category: Category;
  sms: boolean;
  email: boolean;
  in_app: boolean;
  threshold: string;
  deadline_days_before: number;
  [key: string]: unknown;
}

const CATEGORY_LABELS: Record<
  Category,
  { name: string; description: string }
> = {
  deadlines: {
    name: 'Deadlines',
    description:
      'Engagement deadlines crossing threshold. Default: 7 days out. SMS + email + in-app.',
  },
  ai_alerts: {
    name: 'AI alerts',
    description:
      'Discovery findings + Tier 3/4 position flags. Default: email + in-app, medium threshold.',
  },
  client_activity: {
    name: 'Client activity',
    description:
      'New portal logins, message replies, doc uploads. Default: in-app only.',
  },
  system: {
    name: 'System',
    description:
      'Billing, integration failures, vendor outages. Default: email + in-app.',
  },
};

async function loadNotifications(tenantId: string): Promise<NotificationRow[]> {
  return await withTenant(tenantId as TenantId, async (db) => {
    const rows = await db.execute<NotificationRow>(sql`
      SELECT category, sms, email, in_app, threshold, deadline_days_before
      FROM notification_prefs
      WHERE tenant_id = ${tenantId}::uuid
      ORDER BY category
    `);
    return rows as unknown as NotificationRow[];
  });
}

export default async function NotificationsPage() {
  const user = await getCurrentDocketUser();
  if (!user) redirect('/sign-in');

  let prefs: NotificationRow[] = [];
  let errorMessage: string | null = null;
  try {
    prefs = await loadNotifications(user.tenantId);
  } catch (err) {
    errorMessage = err instanceof Error ? err.message : 'Failed to load notification preferences';
  }

  const canEdit = user.role === 'firm_owner';
  const prefsByCategory = new Map<Category, NotificationRow>();
  for (const p of prefs) prefsByCategory.set(p.category, p);

  return (
    <CommandShell user={user} tenantName={user.tenantName} activeHref="/settings">
      <div className="settings">
        <header className="settings-header">
          <div className="settings-eyebrow">Practice</div>
          <h1 className="settings-title">Notifications</h1>
          <p className="settings-subtitle">
            How Petal nudges preparers. Four event categories × three channels.
            Quiet Hours from AI Preferences apply: SMS + in-app suppress during
            the window; email queues for 7am delivery. Per-category edit UI
            in v1.5.
          </p>
          <div style={{ marginTop: 10 }}>
            <Link
              href="/settings"
              style={{
                fontSize: 13,
                color: 'oklch(42% 0.09 150)',
                textDecoration: 'none',
              }}
            >
              ← Back to settings
            </Link>
          </div>
        </header>

        {errorMessage && (
          <div className="settings-error" role="alert">
            <div className="settings-error-title">Couldn't load preferences</div>
            <div className="settings-error-body">{errorMessage}</div>
          </div>
        )}

        <section className="settings-section">
          <div className="settings-section-head">
            <h2 className="settings-section-title">Categories</h2>
            {canEdit && prefs.length < 4 && (
              <SeedNotificationsButton missingCount={4 - prefs.length} />
            )}
          </div>
          <ul className="settings-integrations">
            {(Object.keys(CATEGORY_LABELS) as Category[]).map((category) => {
              const pref = prefsByCategory.get(category);
              const meta = CATEGORY_LABELS[category];
              return (
                <li key={category} className="settings-integ">
                  <div className="settings-integ-main">
                    <div className="settings-integ-name">{meta.name}</div>
                    <div className="settings-integ-purpose">
                      {meta.description}
                    </div>
                    {pref && (
                      <div
                        style={{
                          marginTop: 6,
                          fontSize: 11,
                          color: 'oklch(50% 0.01 85)',
                        }}
                      >
                        {pref.sms && 'SMS · '}
                        {pref.email && 'email · '}
                        {pref.in_app && 'in-app · '}
                        threshold: {pref.threshold}
                        {category === 'deadlines' &&
                          ` · ${pref.deadline_days_before}d out`}
                      </div>
                    )}
                  </div>
                  <span
                    className={`settings-integ-status ${
                      pref ? 'settings-integ-ok' : 'settings-integ-missing'
                    }`}
                  >
                    {pref ? 'Configured' : 'Not seeded'}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      </div>
    </CommandShell>
  );
}
