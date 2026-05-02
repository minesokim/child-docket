'use client';

// Continue button for intake pages. Wraps the @docket/ui Button with
// the per-step "are required fields filled" gate from intake-flow.ts.
//
// Usage:
//
//   <IntakeContinueButton t={t} route="/personal" onClick={handleNext}>
//     Continue
//   </IntakeContinueButton>
//
// Behavior:
//   - Reads the current IntakeState from context (useIntakeAnswers).
//   - Asks intake-flow.ts whether the step at `route` has its
//     required fields filled (canAdvanceFromStep).
//   - When false, sets `disabled` on the Button — the click is no-op
//     and the visual goes grey.
//
// Pages that have an EXTRA page-local gate beyond the schema-level
// required-field check (e.g., /engagement requires both `checked` AND
// `signed`, where `isComplete` only sees `signed`) can pass
// `pageGatePass={false}` to force-disable. The default `undefined`
// is treated as "no extra gate" — Continue is enabled iff the route
// gate passes.

import * as React from 'react';
import { Button } from '@docket/ui';
import type { Theme } from '@docket/ui';
import { useIntakeAnswers } from '@/lib/intake-context';
import { canAdvanceFromStep } from '@/lib/intake-flow';

type ButtonProps = React.ComponentProps<typeof Button>;

export function IntakeContinueButton({
  t,
  route,
  onClick,
  children,
  pageGatePass,
  ...rest
}: {
  t: Theme;
  /** The intake route this button advances FROM (e.g. '/personal'). */
  route: string;
  onClick: () => void;
  children: React.ReactNode;
  /** Optional page-level extra gate. When `false`, the button is
   *  disabled even if the route's `isComplete` would allow advance.
   *  When `true` or `undefined`, only the route gate decides. */
  pageGatePass?: boolean;
} & Omit<ButtonProps, 't' | 'onClick' | 'children' | 'disabled'>) {
  const answers = useIntakeAnswers();
  const routePasses = canAdvanceFromStep(route, answers);
  const canContinue = routePasses && pageGatePass !== false;

  return (
    <Button t={t} onClick={onClick} disabled={!canContinue} {...rest}>
      {children}
    </Button>
  );
}
