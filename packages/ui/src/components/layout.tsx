// Layout primitives — the boring containers everything else nests inside.
// Screen wraps the whole route, Stack/Row are flex helpers. Inline styles
// preserved on purpose: design fidelity is non-negotiable.

import * as React from 'react';
import type { Theme } from '../tokens.js';
import type { StyleProp } from './_types.js';

export function Screen({
  t,
  children,
  style,
}: {
  t: Theme;
  children: React.ReactNode;
  style?: StyleProp;
}) {
  return (
    <div
      style={{
        background: t.bg,
        color: t.ink,
        fontFamily: t.sans,
        // 100dvh = dynamic viewport height (Mobile Safari excludes the URL bar
        // when collapsed). This makes Screen the scroll container so sticky
        // header + sticky bottom bar both anchor reliably.
        height: '100dvh',
        overflowY: 'auto',
        overflowX: 'hidden',
        WebkitFontSmoothing: 'antialiased',
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export function Stack({
  gap = 12,
  children,
  style,
}: {
  gap?: number;
  children: React.ReactNode;
  style?: StyleProp;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap, ...style }}>
      {children}
    </div>
  );
}

export function Row({
  gap = 8,
  align = 'center',
  justify = 'flex-start',
  children,
  style,
}: {
  gap?: number;
  align?: React.CSSProperties['alignItems'];
  justify?: React.CSSProperties['justifyContent'];
  children: React.ReactNode;
  style?: StyleProp;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: align,
        justifyContent: justify,
        gap,
        ...style,
      }}
    >
      {children}
    </div>
  );
}
