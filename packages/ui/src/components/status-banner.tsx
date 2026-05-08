// Status banner + per-service indicator.
//
// Per docs/PRODUCTION-READINESS.md §A vendor resilience posture
// (locked 2026-05-08 after Neon Cell 6 outage). When a vendor
// degrades, the user sees a deliberate banner explaining the state
// rather than mystery-broken-buttons. When the orchestrator falls
// back from Anthropic to Bedrock, that's an info banner ("AI is
// working — using backup provider"). When Neon is read-replica-only,
// that's a warning banner ("Read-only mode — your edits won't save
// for ~30 sec"). When R2 is down, document upload gets a soft block.
//
// SHAPE
//   - StatusBanner — top-of-page bar. Severity: 'info' | 'warn' | 'error'.
//   - ServiceIndicator — small dot + label for a per-service status
//     line (status page / admin sidebar). Status: 'healthy' | 'degraded' | 'down'.
//
// Both are pure presentation. The CONSUMER is responsible for:
//   1. Polling /api/health (or subscribing to live status events) and
//      deriving severity/status from the response.
//   2. Persisting dismissal state if dismissible=true (sessionStorage,
//      localStorage, none — caller's choice).
//   3. Stacking multiple banners in the right order (most-severe first).

import * as React from 'react';
import type { Theme } from '../tokens.js';

// ────────────────────────────────────────────────────────────────
// Severity / status — type unions, not enums, so consumers compose
// without importing extra runtime values.
// ────────────────────────────────────────────────────────────────

export type StatusSeverity = 'info' | 'warn' | 'error';

export type ServiceStatus = 'healthy' | 'degraded' | 'down';

// ────────────────────────────────────────────────────────────────
// Color palette — derived inline from OKLCH lightness/chroma we can
// reason about. Matches the editorial-warm palette without expanding
// the global token set mid-feature. Each severity has a (foreground,
// background, ink) triple so contrast is predictable.
// ────────────────────────────────────────────────────────────────

const SEVERITY_PALETTE: Record<
  StatusSeverity,
  { ink: string; bg: string; border: string; dot: string }
> = {
  // Info — the brand rust at low chroma. Reads as "everything's still
  // working, just want to tell you something."
  info: {
    ink: 'oklch(28% 0.07 150)',
    bg: 'oklch(95% 0.02 150)',
    border: 'oklch(80% 0.04 150)',
    dot: 'oklch(50% 0.10 150)',
  },
  // Warn — amber. Mid-chroma so it stands apart from the rust without
  // shouting. Used for read-only mode and partial degradation.
  warn: {
    ink: 'oklch(35% 0.10 75)',
    bg: 'oklch(96% 0.03 80)',
    border: 'oklch(82% 0.08 75)',
    dot: 'oklch(62% 0.15 75)',
  },
  // Error — red. Highest chroma; reserved for "something is broken,
  // here's what's happening." Don't use for routine notifications.
  error: {
    ink: 'oklch(32% 0.13 25)',
    bg: 'oklch(95% 0.03 25)',
    border: 'oklch(78% 0.10 25)',
    dot: 'oklch(56% 0.20 25)',
  },
};

const SERVICE_STATUS_DOT: Record<ServiceStatus, string> = {
  healthy: 'oklch(50% 0.10 150)',  // forest green
  degraded: 'oklch(62% 0.15 75)',  // amber
  down: 'oklch(56% 0.20 25)',      // red
};

// ────────────────────────────────────────────────────────────────
// StatusBanner — full-width, top-of-page.
//
// Props:
//   - severity     'info' | 'warn' | 'error'
//   - title        short label, ~3-6 words
//   - description  longer prose, optional
//   - action       optional { label, onClick } for an inline CTA
//   - dismissible  if true, renders an X. Caller wires onDismiss.
//   - onDismiss    fired when dismiss is clicked
//
// Layout: title left, description below, action and dismiss at right.
// ────────────────────────────────────────────────────────────────

export interface StatusBannerProps {
  t: Theme;
  severity: StatusSeverity;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
  dismissible?: boolean;
  onDismiss?: () => void;
  /** Optional override for the dot color; defaults to severity-derived. */
  accent?: string;
}

export function StatusBanner({
  t,
  severity,
  title,
  description,
  action,
  dismissible = false,
  onDismiss,
  accent,
}: StatusBannerProps) {
  const palette = SEVERITY_PALETTE[severity] ?? SEVERITY_PALETTE.info;
  return (
    <div
      role={severity === 'error' ? 'alert' : 'status'}
      aria-live={severity === 'error' ? 'assertive' : 'polite'}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 12,
        padding: '12px 16px',
        background: palette.bg,
        color: palette.ink,
        border: `1px solid ${palette.border}`,
        borderRadius: t.radius,
        fontFamily: t.sans,
        fontSize: 14,
        lineHeight: 1.45,
      }}
    >
      <span
        aria-hidden
        style={{
          width: 8,
          height: 8,
          borderRadius: 999,
          background: accent ?? palette.dot,
          marginTop: 6,
          flex: '0 0 auto',
        }}
      />
      <div style={{ flex: '1 1 auto', minWidth: 0 }}>
        <div
          style={{
            fontWeight: 600,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {title}
        </div>
        {description ? (
          <div style={{ marginTop: 2, color: palette.ink, opacity: 0.85 }}>
            {description}
          </div>
        ) : null}
      </div>
      {action ? (
        <button
          type="button"
          onClick={action.onClick}
          style={{
            flex: '0 0 auto',
            padding: '4px 10px',
            background: 'transparent',
            color: palette.ink,
            border: `1px solid ${palette.border}`,
            borderRadius: t.radius,
            fontFamily: t.sans,
            fontSize: 13,
            fontWeight: 500,
            cursor: 'pointer',
          }}
        >
          {action.label}
        </button>
      ) : null}
      {dismissible ? (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          style={{
            flex: '0 0 auto',
            width: 24,
            height: 24,
            background: 'transparent',
            color: palette.ink,
            border: 'none',
            borderRadius: 999,
            fontSize: 16,
            lineHeight: 1,
            cursor: 'pointer',
            opacity: 0.6,
          }}
        >
          ×
        </button>
      ) : null}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// ServiceIndicator — small dot + name + status. For a per-service
// status rail (e.g., admin sidebar showing Anthropic / Neon / R2 /
// Twilio rolled up).
// ────────────────────────────────────────────────────────────────

export interface ServiceIndicatorProps {
  t: Theme;
  /** Display name. */
  name: string;
  /** 'healthy' | 'degraded' | 'down'. */
  status: ServiceStatus;
  /** Optional last-checked timestamp (ISO string or human label). */
  checkedAt?: string;
}

export function ServiceIndicator({
  t,
  name,
  status,
  checkedAt,
}: ServiceIndicatorProps) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '6px 0',
        fontFamily: t.sans,
        fontSize: 13,
        color: t.ink,
      }}
    >
      <span
        aria-label={`${name}: ${status}`}
        title={`${name}: ${status}`}
        style={{
          width: 8,
          height: 8,
          borderRadius: 999,
          background: SERVICE_STATUS_DOT[status],
          flex: '0 0 auto',
        }}
      />
      <span style={{ fontWeight: 500 }}>{name}</span>
      <span style={{ color: t.muted, fontSize: 12 }}>
        {status === 'healthy' ? 'operational' : status === 'degraded' ? 'degraded' : 'unavailable'}
      </span>
      {checkedAt ? (
        <span style={{ color: t.muted, fontSize: 12, marginLeft: 'auto' }}>{checkedAt}</span>
      ) : null}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// Pre-shaped helpers for the three v1 vendor states. Consumers call
// these instead of constructing StatusBanner props from scratch so
// the wording stays consistent across surfaces.
// ────────────────────────────────────────────────────────────────

export function bedrockFallbackBanner(t: Theme): StatusBannerProps {
  return {
    t,
    severity: 'info',
    title: 'AI is working — using backup provider',
    description:
      'Anthropic API is responding slowly. Falling back to AWS Bedrock until it recovers. The same Claude model handles your request through a different control plane.',
  };
}

export function neonReadOnlyBanner(
  t: Theme,
  onRetry?: () => void,
): StatusBannerProps {
  return {
    t,
    severity: 'warn',
    title: 'Read-only mode',
    description:
      'Database is briefly unavailable. Saves are paused — wait and retry your edit, or come back in a few minutes.',
    action: onRetry ? { label: 'Retry now', onClick: onRetry } : undefined,
  };
}

export function r2UnavailableBanner(t: Theme): StatusBannerProps {
  return {
    t,
    severity: 'warn',
    title: 'Document upload paused',
    description:
      'Document storage is temporarily unavailable. You can still view existing files; new uploads will fail — try again in a few minutes.',
  };
}
