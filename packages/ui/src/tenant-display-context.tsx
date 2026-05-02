'use client';

// Tenant display context — surfaces the firm owner's name + avatar +
// tenant display name to UI components without prop-drilling.
//
// Why it lives in @docket/ui (not in the client-portal app):
//
//   AskAntonioBar / AskAntonioChat / AntonioNote / AvatarSlot are the
//   components that need this data, and they all live in @docket/ui.
//   They're used in 27+ pages across the client-portal — passing
//   firmOwner as a prop everywhere would be a massive footgun. Cross-
//   package context lets the components read directly while the
//   client-portal layout wraps the tree once.
//
// What's in scope:
//
//   - tenantName  — e.g., "Vazant Consulting", surfaces in /welcome
//   - firmOwner   — name + first name + avatar URL of the firm's
//                   firm_owner role user. Drives the AskAntonio*
//                   labels and the AvatarSlot image.
//
// What's NOT in scope:
//
//   - intake answers — those live in IntakeContext (client-portal app)
//   - any preparer-side data — command-room has its own user resolver
//
// Server flow:
//
//   1. Layout calls resolveClient() (server-side, in client-portal/lib/intake/auth.ts)
//   2. Layout extracts { tenantName, firmOwner } from the result
//   3. Layout wraps children with <TenantDisplayProvider value={...}>
//   4. Components inside consume via useFirmOwner() / useTenantName()
//
// Fallbacks: every consumer hook returns `null` when the provider
// isn't mounted (or when the data is genuinely null). UI components
// fall back to the legacy "Antonio Vazquez" / antonio.webp defaults
// so a missing-owner case never crashes a render — important during
// dev when the schema is mid-migration.

import * as React from 'react';

export type FirmOwner = {
  name: string;
  /** First-name slice for "Ask {firstName}" copy. */
  firstName: string;
  /** Profile picture URL. NULL → consumer renders initials of name. */
  avatarUrl: string | null;
};

type TenantDisplayContextValue = {
  tenantName: string | null;
  firmOwner: FirmOwner | null;
};

const TenantDisplayContext = React.createContext<TenantDisplayContextValue>({
  tenantName: null,
  firmOwner: null,
});

export function TenantDisplayProvider({
  tenantName = null,
  firmOwner = null,
  children,
}: {
  tenantName?: string | null;
  firmOwner?: FirmOwner | null;
  children: React.ReactNode;
}) {
  // Memoize so consumers don't re-render on unrelated parent updates.
  const value = React.useMemo(
    () => ({ tenantName, firmOwner }),
    [tenantName, firmOwner],
  );
  return (
    <TenantDisplayContext.Provider value={value}>
      {children}
    </TenantDisplayContext.Provider>
  );
}

export function useTenantName(): string | null {
  return React.useContext(TenantDisplayContext).tenantName;
}

export function useFirmOwner(): FirmOwner | null {
  return React.useContext(TenantDisplayContext).firmOwner;
}

/**
 * Compute initials from a person's display name. Used by AvatarSlot
 * when the firm owner has no avatarUrl set yet.
 *
 *   initialsOf('Antonio Vazquez')        // 'AV'
 *   initialsOf('Minseo Kim')             // 'MK'
 *   initialsOf('madonna')                // 'M'
 *   initialsOf('Jean-Luc Picard')        // 'JP'
 *   initialsOf('')                       // ''
 *   initialsOf(null)                     // ''
 */
export function initialsOf(name: string | null | undefined): string {
  if (!name) return '';
  const parts = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);
  return parts
    .map((p) => p[0]?.toUpperCase() ?? '')
    .filter(Boolean)
    .join('');
}
