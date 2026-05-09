'use client';

// DepositForm — Square Web Payments SDK card form.
//
// Replaces the Stripe placeholder on /deposit/page.tsx. Loads
// Square's SDK via <script>, mounts a card iframe in `#deposit-card`,
// and on submit tokenizes + charges via chargePaymentToken server
// action.
//
// PCI POSTURE
//   - Card form lives in a Square-controlled iframe. PAN never
//     reaches Docket's React tree.
//   - Single-use token returned by card.tokenize() — even if
//     intercepted, can charge once for the authorized amount only.
//   - Server-side amount validation in chargePaymentToken
//     (re-derives from engagement + firm_profile; client-supplied
//     expectedAmountCents is just a sanity check).
//
// CSP NOTE
//   This component requires the Vercel CSP (or Next.js default) to
//   allow:
//     script-src https://web.squarecdn.com https://js.squareup.com
//     frame-src  https://web.squarecdn.com https://js.squareup.com
//   v0 Next.js doesn't ship a strict CSP by default, so this works
//   out of the box. Pre-public-launch hardening adds explicit CSP
//   headers (PRODUCTION-READINESS §A).

import * as React from 'react';
import Script from 'next/script';
import {
  chargePaymentToken,
  type ChargePaymentTokenResult,
} from '@/lib/square/charge-payment-token';

interface SquareCardForm {
  attach(selector: string): Promise<void>;
  tokenize(): Promise<{
    status: 'OK' | 'Cancel' | 'ErrorField' | 'NotAllowed' | string;
    token?: string;
    errors?: Array<{ message: string; field?: string; type?: string }>;
  }>;
  destroy(): Promise<void>;
}

interface SquarePayments {
  card(): Promise<SquareCardForm>;
}

declare global {
  interface Window {
    Square?: {
      payments(applicationId: string, locationId: string): SquarePayments;
    };
  }
}

interface Props {
  applicationId: string;
  locationId: string;
  environment: 'sandbox' | 'production';
  amountCents: number;
  taxYear: number;
  engagementId: string | null;
  onSuccess: () => void;
}

type State =
  | { kind: 'loading' }
  | { kind: 'ready' }
  | { kind: 'tokenizing' }
  | { kind: 'charging' }
  | { kind: 'error'; message: string }
  | { kind: 'success' };

export function DepositForm({
  applicationId,
  locationId,
  environment,
  amountCents,
  taxYear,
  engagementId,
  onSuccess,
}: Props) {
  const [state, setState] = React.useState<State>({ kind: 'loading' });
  const cardRef = React.useRef<SquareCardForm | null>(null);
  const initializedRef = React.useRef(false);

  // SDK URL — sandbox vs production. The SDK serves from different
  // CDNs depending on environment.
  const sdkUrl =
    environment === 'sandbox'
      ? 'https://sandbox.web.squarecdn.com/v1/square.js'
      : 'https://web.squarecdn.com/v1/square.js';

  const initSquare = React.useCallback(async () => {
    if (initializedRef.current) return;
    if (typeof window === 'undefined' || !window.Square) return;
    initializedRef.current = true;
    try {
      const payments = window.Square.payments(applicationId, locationId);
      const card = await payments.card();
      await card.attach('#deposit-card');
      cardRef.current = card;
      setState({ kind: 'ready' });
    } catch (err) {
      setState({
        kind: 'error',
        message: err instanceof Error ? err.message : 'Could not load payment form. Refresh and try again.',
      });
    }
  }, [applicationId, locationId]);

  React.useEffect(() => {
    return () => {
      // Best-effort destroy on unmount.
      if (cardRef.current) {
        cardRef.current.destroy().catch(() => {
          // already destroyed; ignore
        });
        cardRef.current = null;
      }
    };
  }, []);

  const onSubmit = React.useCallback(async () => {
    if (!cardRef.current || state.kind !== 'ready') return;
    setState({ kind: 'tokenizing' });
    let result: Awaited<ReturnType<SquareCardForm['tokenize']>>;
    try {
      result = await cardRef.current.tokenize();
    } catch (err) {
      setState({
        kind: 'error',
        message: err instanceof Error ? err.message : 'Tokenization failed',
      });
      return;
    }
    if (result.status !== 'OK' || !result.token) {
      const detail = result.errors?.[0]?.message ?? `Status: ${result.status}`;
      setState({ kind: 'error', message: detail });
      return;
    }

    setState({ kind: 'charging' });
    let chargeResult: ChargePaymentTokenResult;
    try {
      chargeResult = await chargePaymentToken({
        sourceId: result.token,
        expectedAmountCents: amountCents,
        engagementId: engagementId ?? undefined,
        taxYear,
      });
    } catch {
      setState({
        kind: 'error',
        message: 'Could not reach the server. Check your connection and try again.',
      });
      return;
    }

    if (chargeResult.ok) {
      setState({ kind: 'success' });
      onSuccess();
    } else {
      const friendlyMessage =
        chargeResult.reason === 'card-declined'
          ? 'Card declined. Try a different card.'
          : chargeResult.reason === 'rate-limit'
            ? chargeResult.message
            : 'Payment failed. ' + chargeResult.message;
      setState({ kind: 'error', message: friendlyMessage });
    }
  }, [amountCents, engagementId, onSuccess, state.kind, taxYear]);

  return (
    <div>
      <Script
        src={sdkUrl}
        strategy="afterInteractive"
        onReady={() => {
          // Wrap the async init so the onReady prop signature
          // matches the expected `() => void`.
          void initSquare();
        }}
      />

      <div
        id="deposit-card"
        style={{
          minHeight: 96,
          padding: '12px 14px',
          background: '#fff',
          borderRadius: 14,
          border: '1px solid #E4DDCE',
          // While loading, show a simple shimmer placeholder.
          ...(state.kind === 'loading'
            ? {
                background:
                  'linear-gradient(90deg, #f5eedd 0%, #fffefc 50%, #f5eedd 100%)',
                backgroundSize: '200% 100%',
                animation: 'deposit-shimmer 1.5s infinite linear',
              }
            : {}),
        }}
      />

      {state.kind === 'error' && (
        <div
          role="alert"
          aria-live="polite"
          style={{
            marginTop: 10,
            padding: '8px 12px',
            background: '#fad8d8',
            color: '#7a1b1b',
            borderRadius: 8,
            fontSize: 12,
            fontFamily: 'system-ui, -apple-system, sans-serif',
            lineHeight: 1.45,
          }}
        >
          {state.message}
        </div>
      )}

      <div style={{ marginTop: 16 }}>
        <button
          type="button"
          onClick={onSubmit}
          disabled={state.kind !== 'ready'}
          style={{
            width: '100%',
            padding: '14px 18px',
            borderRadius: 14,
            border: 'none',
            background: '#2A2419',
            color: '#fff',
            fontFamily: 'system-ui, -apple-system, sans-serif',
            fontSize: 15,
            fontWeight: 500,
            letterSpacing: -0.2,
            cursor: state.kind === 'ready' ? 'pointer' : 'not-allowed',
            opacity: state.kind === 'ready' ? 1 : 0.55,
          }}
        >
          {state.kind === 'loading'
            ? 'Loading payment form…'
            : state.kind === 'tokenizing'
              ? 'Validating card…'
              : state.kind === 'charging'
                ? 'Charging…'
                : state.kind === 'success'
                  ? 'Paid ✓'
                  : `Pay $${(amountCents / 100).toFixed(2)} and continue`}
        </button>
      </div>

      <style jsx>{`
        @keyframes deposit-shimmer {
          0% {
            background-position: 200% 0;
          }
          100% {
            background-position: -200% 0;
          }
        }
      `}</style>
    </div>
  );
}
