// Form field primitives. Used across personal, spouse, state, dependents,
// business screens.
//   - FieldLabel: small label + optional right-aligned hint.
//   - TextField: bottom-border input, mono optional, tel/email type optional.
//   - SSNField: three-state SSN input (editing / complete / masked-from-server).
//     Click on the masked state calls onReveal() (audit-logged plaintext fetch).
//   - EncryptedTextField: TextField wrapper with masked-server-value handling.
//     Used for EIN, bank routing, bank account.

import * as React from 'react';
import type { Theme } from '../tokens.js';
import type { StyleProp } from './_types.js';
import { Row } from './layout.js';

export function FieldLabel({
  t,
  children,
  hint,
}: {
  t: Theme;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <Row justify="space-between" align="baseline" style={{ marginBottom: 6 }}>
      <span
        style={{
          fontFamily: t.sans,
          fontSize: 12,
          color: t.muted,
          fontWeight: 500,
          letterSpacing: 0,
        }}
      >
        {children}
      </span>
      {hint && (
        <span
          style={{
            fontFamily: t.mono,
            fontSize: 10,
            color: t.muted,
            letterSpacing: 0.4,
          }}
        >
          {hint}
        </span>
      )}
    </Row>
  );
}

export function TextField({
  t,
  value,
  onChange,
  placeholder,
  mono,
  inputMode,
  type = 'text',
  readOnly,
  style,
  autoComplete,
}: {
  t: Theme;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  mono?: boolean;
  inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode'];
  type?: 'text' | 'email' | 'tel';
  readOnly?: boolean;
  style?: StyleProp;
  autoComplete?: string;
}) {
  return (
    <input
      type={type}
      inputMode={inputMode}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      readOnly={readOnly}
      autoComplete={autoComplete}
      style={{
        width: '100%',
        background: 'transparent',
        border: 'none',
        borderBottom: `1px solid ${t.border}`,
        padding: '10px 0 10px',
        fontSize: 16,
        color: t.ink,
        fontFamily: mono ? t.mono : t.sans,
        letterSpacing: mono ? 0.3 : 0,
        outline: 'none',
        ...style,
      }}
      onFocus={(e) => {
        e.target.style.borderBottomColor = t.rust;
      }}
      onBlur={(e) => {
        e.target.style.borderBottomColor = t.border;
      }}
    />
  );
}

// ────────────────────────────────────────────────────────────────
// SSNField — three states:
//   1. Editing — controlled input with auto-format XXX-XX-XXXX
//   2. Complete (just typed)  — masked display with last 4 visible
//   3. Masked (server sentinel) — display only the last 4 from the sentinel.
//      Click → calls onReveal() to fetch plaintext from the server (which
//      audit-logs the reveal), then switches to editing with plaintext.
//
// `value` semantics:
//   - 9 digits (e.g. '123456789') = freshly typed plaintext
//   - String containing MASK_CHAR (e.g. '·····6789') = server sentinel
//   - '' = empty
//
// `onReveal` is optional. If absent, masked-state click toggles to editing
// with empty input (clear-and-retype). If present, it's called to fetch the
// real plaintext when the user wants to edit a previously-entered SSN.
// ────────────────────────────────────────────────────────────────

export function SSNField({
  t,
  value,
  onChange,
  onReveal,
}: {
  t: Theme;
  value: string;
  onChange: (raw: string) => void;
  onReveal?: () => Promise<string>;
}) {
  const masked = value.includes('·');
  const complete = !masked && value.length === 9;

  const [editing, setEditing] = React.useState(!masked && !complete);
  const [revealing, setRevealing] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement | null>(null);

  const formatted = formatSsn(value);
  // Last 4 from the sentinel work the same — '·····6789'.slice(-4) = '6789'.
  const lastFour = value.length >= 4 ? value.slice(-4) : '••••';

  React.useEffect(() => {
    if (!masked && !complete) setEditing(true);
  }, [masked, complete]);

  // When the user clicks the masked display: either reveal-then-edit
  // (if onReveal provided) or clear-and-retype (legacy fallback).
  const handleStartEdit = async () => {
    if (masked && onReveal) {
      setRevealing(true);
      try {
        const plaintext = await onReveal();
        if (plaintext) onChange(plaintext);
        else onChange(''); // empty stored value — start fresh
        setEditing(true);
        setTimeout(() => inputRef.current?.focus(), 0);
      } finally {
        setRevealing(false);
      }
    } else {
      // No reveal — clear so the user retypes from scratch.
      if (masked) onChange('');
      setEditing(true);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  };

  if (editing) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '10px 0 10px',
          borderBottom: `1px solid ${t.border}`,
        }}
      >
        <input
          ref={inputRef}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          value={formatted}
          onChange={(e) => {
            const digits = e.target.value.replace(/\D/g, '').slice(0, 9);
            onChange(digits);
          }}
          onBlur={() => {
            if (complete) setEditing(false);
          }}
          placeholder="•••–••–••••"
          style={{
            flex: 1,
            background: 'transparent',
            border: 'none',
            padding: 0,
            fontFamily: t.mono,
            fontSize: 16,
            color: t.ink,
            letterSpacing: 1.5,
            outline: 'none',
          }}
        />
        <EncryptedPill t={t} />
      </div>
    );
  }

  return (
    <div
      onClick={handleStartEdit}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '10px 0 10px',
        borderBottom: `1px solid ${t.border}`,
        cursor: revealing ? 'wait' : 'text',
        opacity: revealing ? 0.6 : 1,
        transition: 'opacity 140ms cubic-bezier(.2,.8,.2,1)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flex: 1 }}>
        <span
          style={{
            fontFamily: t.mono,
            fontSize: 14,
            color: t.muted,
            letterSpacing: 2,
            lineHeight: 1,
          }}
        >
          •••
        </span>
        <span style={{ fontFamily: t.mono, fontSize: 14, color: t.muted }}>–</span>
        <span
          style={{
            fontFamily: t.mono,
            fontSize: 14,
            color: t.muted,
            letterSpacing: 2,
            lineHeight: 1,
          }}
        >
          ••
        </span>
        <span style={{ fontFamily: t.mono, fontSize: 14, color: t.muted }}>–</span>
        <span
          style={{
            fontFamily: t.mono,
            fontSize: 19,
            color: t.ink,
            letterSpacing: 1.5,
            fontWeight: 500,
          }}
        >
          {lastFour}
        </span>
      </div>
      <EncryptedPill t={t} />
    </div>
  );
}

function formatSsn(raw: string): string {
  const d = raw.replace(/\D/g, '').slice(0, 9);
  if (d.length <= 3) return d;
  if (d.length <= 5) return `${d.slice(0, 3)}-${d.slice(3)}`;
  return `${d.slice(0, 3)}-${d.slice(3, 5)}-${d.slice(5)}`;
}

// ────────────────────────────────────────────────────────────────
// EncryptedTextField — TextField wrapper with masked-server-value handling.
//
// When the server returns a sensitive field value (EIN, bank routing,
// bank account), the value comes back as a masked sentinel string with
// MASK_CHAR ('·') as a placeholder. This wrapper detects that and shows
// a read-only display with an "Edit" affordance instead of trying to
// render the masked string in a regular input (where the user would
// type into '·······1234' and produce garbage that fails Zod
// validation).
//
// Two reveal modes:
//   - With onReveal: clicking 'Edit' fetches plaintext from the server
//     (audit-logged), populates the input, user can edit in place.
//   - Without onReveal: clicking 'Edit' clears the value, user retypes
//     from scratch. Lower friction to wire, weaker UX.
// ────────────────────────────────────────────────────────────────

export function EncryptedTextField({
  t,
  value,
  onChange,
  onReveal,
  placeholder,
  hint,
  mono = true,
  inputMode,
  style,
}: {
  t: Theme;
  value: string;
  onChange: (raw: string) => void;
  onReveal?: () => Promise<string>;
  placeholder?: string;
  hint?: string;
  mono?: boolean;
  inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode'];
  style?: React.CSSProperties;
}) {
  const masked = value.includes('·');
  const [editing, setEditing] = React.useState(!masked);
  const [revealing, setRevealing] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement | null>(null);

  // If the value flips back to masked (e.g., post-save the server
  // re-masks), drop back to masked display. If it's no longer masked
  // (user actively typing), enter editing mode.
  React.useEffect(() => {
    setEditing(!masked);
  }, [masked]);

  const handleStartEdit = async () => {
    if (onReveal) {
      setRevealing(true);
      try {
        const plaintext = await onReveal();
        onChange(plaintext ?? '');
        setEditing(true);
        setTimeout(() => inputRef.current?.focus(), 0);
      } finally {
        setRevealing(false);
      }
    } else {
      onChange('');
      setEditing(true);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  };

  if (!editing && masked) {
    // Masked display + Edit affordance.
    return (
      <div
        onClick={handleStartEdit}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '10px 0 10px',
          borderBottom: `1px solid ${t.border}`,
          cursor: revealing ? 'wait' : 'text',
          opacity: revealing ? 0.6 : 1,
          transition: 'opacity 140ms cubic-bezier(.2,.8,.2,1)',
        }}
      >
        <span
          style={{
            flex: 1,
            fontFamily: mono ? t.mono : t.sans,
            fontSize: 16,
            color: t.ink,
            letterSpacing: mono ? 1.5 : -0.05,
          }}
        >
          {value}
        </span>
        <EncryptedPill t={t} />
      </div>
    );
  }

  // Editable input — same shape as TextField for visual continuity.
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        inputMode={inputMode}
        autoComplete="off"
        style={{
          flex: 1,
          background: 'transparent',
          border: 'none',
          borderBottom: `1px solid ${t.border}`,
          padding: '10px 0',
          fontFamily: mono ? t.mono : t.sans,
          fontSize: 16,
          color: t.ink,
          letterSpacing: mono ? 1.5 : -0.05,
          outline: 'none',
          ...style,
        }}
        onFocus={(e) => {
          e.target.style.borderBottomColor = t.rust;
        }}
        onBlur={(e) => {
          e.target.style.borderBottomColor = t.border;
        }}
      />
      {hint && (
        <span
          style={{
            fontFamily: t.mono,
            fontSize: 9,
            color: t.muted,
            letterSpacing: 1,
            textTransform: 'uppercase',
            flexShrink: 0,
          }}
        >
          {hint}
        </span>
      )}
    </div>
  );
}

function EncryptedPill({ t }: { t: Theme }) {
  // Solid black pill — high contrast against the cream page so the
  // ENCRYPTED badge is unmistakable. White icon + label, no border.
  // Reads as a system tag (always-on assurance) rather than a soft
  // suggestion. The stroke-less treatment keeps it from competing
  // visually with the field's own bottom-border underline.
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        padding: '4px 9px',
        background: t.ink,
        border: 'none',
        borderRadius: 999,
        fontFamily: t.mono,
        fontSize: 9,
        color: '#fff',
        letterSpacing: 0.8,
      }}
    >
      <svg width="9" height="10" viewBox="0 0 9 10" fill="none" stroke="currentColor" strokeWidth="1.3">
        <rect x="1.5" y="4.5" width="6" height="5" rx="0.8" />
        <path d="M3 4.5V3a1.5 1.5 0 013 0v1.5" strokeLinecap="round" />
      </svg>
      ENCRYPTED
    </span>
  );
}
