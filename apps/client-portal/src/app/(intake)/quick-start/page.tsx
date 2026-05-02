'use client';

// Quick-start — sequential 3-step onboarding right after Welcome.
//
// Modern SaaS onboarding feel (Linear / Notion). One question per
// "slide": name → date of birth → email. Each slide fades + slides up
// from below. Press Enter or tap Continue to advance. Saves to the
// IntakeState as you type, so /personal later auto-populates.
//
// Phone is intentionally NOT collected here — Clerk already has it from
// the OTP login.

import { Body, Button, buildTheme, Screen, TextField } from '@docket/ui';
import { useEffect, useRef, useState } from 'react';
import { usePortalNav } from '@/lib/portal-nav';
import { useIntakeField } from '@/lib/intake-context';

// DOB format helpers — display "MM / DD / YYYY", store ISO YYYY-MM-DD.
function dobShape(raw: string): string {
  const d = raw.replace(/\D/g, '').slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)} / ${d.slice(2)}`;
  return `${d.slice(0, 2)} / ${d.slice(2, 4)} / ${d.slice(4)}`;
}
function dobDisplayToIso(display: string): string {
  const d = display.replace(/\D/g, '');
  if (d.length !== 8) return '';
  return `${d.slice(4, 8)}-${d.slice(0, 2)}-${d.slice(2, 4)}`;
}
function dobIsoToDisplay(iso: string): string {
  if (!iso) return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return iso;
  return `${m[2]} / ${m[3]} / ${m[1]}`;
}

const STEP_COUNT = 3;

export default function QuickStartPage() {
  const t = buildTheme({ tone: 'editorial', fonts: 'classic' });
  const nav = usePortalNav();

  const [fullName, setFullName] = useIntakeField<string>('personal.fullName', '');
  const [dobIso, setDobIso] = useIntakeField<string>('personal.dateOfBirth', '');
  const [email, setEmail] = useIntakeField<string>('personal.email', '');

  // DOB has separate display state (MM / DD / YYYY) vs storage (ISO).
  const [dobDisplay, setDobDisplay] = useState(() => dobIsoToDisplay(dobIso));

  // Step index: 0 = name, 1 = dob, 2 = email. Skip ahead if a field is
  // already filled (returning user mid-flow).
  const initialStep = !fullName ? 0 : !dobIso ? 1 : !email ? 2 : 0;
  const [step, setStep] = useState(initialStep);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Autofocus the input on each step transition.
  useEffect(() => {
    inputRef.current?.focus();
  }, [step]);

  const canAdvance = (() => {
    if (step === 0) return fullName.trim().length >= 2;
    if (step === 1) return dobIso.length === 10; // valid ISO
    if (step === 2) return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    return false;
  })();

  const advance = () => {
    if (!canAdvance) return;
    if (step < STEP_COUNT - 1) {
      setStep(step + 1);
    } else {
      // All three filled. On to the tutorial.
      nav.next('/tutorial');
    }
  };

  const goBack = () => {
    if (step === 0) {
      nav.back('/welcome');
    } else {
      setStep(step - 1);
    }
  };

  const handleDobChange = (raw: string) => {
    const shaped = dobShape(raw);
    setDobDisplay(shaped);
    const iso = dobDisplayToIso(shaped);
    if (iso) void setDobIso(iso);
    else if (!shaped) void setDobIso(''); // user cleared field
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      advance();
    }
  };

  return (
    <Screen t={t}>
      <style>{`
        @keyframes qs-slide-in {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0);    }
        }
        .qs-slide { animation: qs-slide-in 380ms cubic-bezier(.2,.8,.2,1) both; }

        @keyframes qs-progress-fill {
          from { width: var(--qs-prev-width); }
          to   { width: var(--qs-curr-width); }
        }
        .qs-progress-fill {
          animation: qs-progress-fill 380ms cubic-bezier(.2,.8,.2,1) both;
        }
      `}</style>

      <div
        style={{
          padding: '24px 24px 28px max(24px, env(safe-area-inset-left, 24px))',
          paddingRight: 'max(24px, env(safe-area-inset-right, 24px))',
          display: 'flex',
          flexDirection: 'column',
          minHeight: '100%',
        }}
      >
        {/* Top — back arrow + 3-dot progress indicator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 32 }}>
          <button
            type="button"
            onClick={goBack}
            aria-label="Back"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 36,
              height: 36,
              borderRadius: 999,
              border: 'none',
              // Neutral surface — no green even when "active". The
              // form on this page is identity-only, so coloring it
              // would imply a state that doesn't exist here.
              background: t.ease.softNeutral,
              color: t.muted,
              cursor: 'pointer',
              padding: 0,
            }}
          >
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
              <path
                d="M9 2l-5 5 5 5"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
          <div style={{ display: 'flex', gap: 6, flex: 1 }}>
            {Array.from({ length: STEP_COUNT }).map((_, i) => (
              <div
                key={i}
                style={{
                  flex: 1,
                  height: 3,
                  borderRadius: 999,
                  background: i <= step ? t.ink : t.borderSoft,
                  transition: 'background 320ms cubic-bezier(.2,.8,.2,1)',
                }}
              />
            ))}
          </div>
        </div>

        {/* Sliding content — keyed on step so React remounts and re-runs animation */}
        <div key={step} className="qs-slide" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          {step === 0 && (
            <>
              <h1
                style={{
                  fontFamily: t.serif,
                  fontWeight: 400,
                  fontSize: 34,
                  lineHeight: 1.1,
                  letterSpacing: -0.6,
                  color: t.ink,
                  margin: 0,
                  marginBottom: 14,
                }}
              >
                What&apos;s your <span style={{ fontStyle: 'italic' }}>name?</span>
              </h1>
              <Body t={t} size={15} style={{ marginBottom: 32 }}>
                Your full legal name as it appears on your tax documents.
              </Body>
              <input
                ref={inputRef}
                type="text"
                autoComplete="name"
                placeholder="First Middle Last"
                value={fullName}
                onChange={(e) => void setFullName(e.target.value)}
                onKeyDown={handleKeyDown}
                style={{
                  width: '100%',
                  padding: '16px 18px',
                  // Neutral fill in every state — empty, filled,
                  // focused, blurred. The page is identity-only;
                  // green would imply form-validation state.
                  background: '#fffefc',
                  borderRadius: 14,
                  fontFamily: t.sans,
                  fontSize: 18,
                  color: t.ink,
                  outline: 'none',
                  border: 'none',
                  boxSizing: 'border-box',
                  boxShadow: '0 1px 4px rgba(15, 62, 23, 0.05)',
                }}
              />
            </>
          )}

          {step === 1 && (
            <>
              <h1
                style={{
                  fontFamily: t.serif,
                  fontWeight: 400,
                  fontSize: 34,
                  lineHeight: 1.1,
                  letterSpacing: -0.6,
                  color: t.ink,
                  margin: 0,
                  marginBottom: 14,
                }}
              >
                When were you <span style={{ fontStyle: 'italic' }}>born?</span>
              </h1>
              <Body t={t} size={15} style={{ marginBottom: 32 }}>
                Used to verify your identity with the IRS.
              </Body>
              <input
                ref={inputRef}
                type="text"
                inputMode="numeric"
                autoComplete="bday"
                placeholder="MM / DD / YYYY"
                value={dobDisplay}
                onChange={(e) => handleDobChange(e.target.value)}
                onKeyDown={handleKeyDown}
                style={{
                  width: '100%',
                  padding: '16px 18px',
                  background: '#fffefc',
                  borderRadius: 14,
                  fontFamily: t.sans,
                  fontSize: 18,
                  color: t.ink,
                  outline: 'none',
                  border: 'none',
                  boxSizing: 'border-box',
                  boxShadow: '0 1px 4px rgba(15, 62, 23, 0.05)',
                  fontVariantNumeric: 'tabular-nums lining-nums',
                  letterSpacing: 1,
                }}
              />
            </>
          )}

          {step === 2 && (
            <>
              <h1
                style={{
                  fontFamily: t.serif,
                  fontWeight: 400,
                  fontSize: 34,
                  lineHeight: 1.1,
                  letterSpacing: -0.6,
                  color: t.ink,
                  margin: 0,
                  marginBottom: 14,
                }}
              >
                What&apos;s your <span style={{ fontStyle: 'italic' }}>email?</span>
              </h1>
              <Body t={t} size={15} style={{ marginBottom: 32 }}>
                For tax-document delivery and reminders. We won&apos;t share or sell it.
              </Body>
              <input
                ref={inputRef}
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => void setEmail(e.target.value)}
                onKeyDown={handleKeyDown}
                style={{
                  width: '100%',
                  padding: '16px 18px',
                  background: '#fffefc',
                  borderRadius: 14,
                  fontFamily: t.sans,
                  fontSize: 18,
                  color: t.ink,
                  outline: 'none',
                  border: 'none',
                  boxSizing: 'border-box',
                  boxShadow: '0 1px 4px rgba(15, 62, 23, 0.05)',
                }}
              />
            </>
          )}
        </div>

        {/* Bottom — Continue button, sticky-feeling */}
        <div style={{ marginTop: 28 }}>
          <Button
            t={t}
            onClick={advance}
            disabled={!canAdvance}
            style={{
              width: '100%',
              padding: '15px 22px',
              fontSize: 15,
              opacity: canAdvance ? 1 : 0.45,
            }}
          >
            {step === STEP_COUNT - 1 ? 'Continue' : 'Next'}
          </Button>
          <div
            style={{
              fontFamily: t.mono,
              fontSize: 10,
              color: t.muted,
              letterSpacing: 1,
              textTransform: 'uppercase',
              textAlign: 'center',
              marginTop: 14,
            }}
          >
            Press Enter to continue
          </div>
        </div>
      </div>
    </Screen>
  );
}
