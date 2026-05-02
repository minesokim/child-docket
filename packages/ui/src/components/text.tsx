// Typography primitives. Eyebrow is the small mono label above a section,
// H1/H2 are the serif display headings, Body is the workhorse paragraph.

import * as React from 'react';
import type { Theme } from '../tokens.js';
import type { StyleProp } from './_types.js';

export function Eyebrow({
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
        fontFamily: t.mono,
        fontSize: 10.5,
        fontWeight: 400,
        letterSpacing: 1.2,
        color: t.muted,
        textTransform: 'uppercase',
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export function H1({
  t,
  children,
  style,
}: {
  t: Theme;
  children: React.ReactNode;
  style?: StyleProp;
}) {
  // "Ghost in": slow, drawn-out fade with a heavy blur-to-clear pass.
  // 1600ms duration with the ease-out-quint curve gives a long quiet
  // tail — the headline doesn't snap into place, it materializes.
  // AntonioNote uses this same keyframe so the avatar + title settle
  // together as one breath.
  return (
    <>
      <style>{`
        @keyframes docket-ghost-in {
          from {
            opacity: 0;
            transform: translateY(4px);
            filter: blur(6px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
            filter: blur(0);
          }
        }
      `}</style>
      <h1
        style={{
          fontFamily: t.serif,
          fontWeight: 400,
          fontSize: 34,
          lineHeight: 1.12,
          letterSpacing: -0.8,
          margin: 0,
          color: t.ink,
          textWrap: 'pretty' as React.CSSProperties['textWrap'],
          animation: 'docket-ghost-in 1600ms cubic-bezier(.16, 1, .3, 1) both',
          willChange: 'opacity, transform, filter',
          ...style,
        }}
      >
        {children}
      </h1>
    </>
  );
}

export function H2({
  t,
  children,
  style,
}: {
  t: Theme;
  children: React.ReactNode;
  style?: StyleProp;
}) {
  return (
    <h2
      style={{
        fontFamily: t.serif,
        fontWeight: 400,
        fontSize: 24,
        lineHeight: 1.2,
        letterSpacing: -0.4,
        margin: 0,
        color: t.ink,
        textWrap: 'pretty' as React.CSSProperties['textWrap'],
        ...style,
      }}
    >
      {children}
    </h2>
  );
}

export function Body({
  t,
  muted,
  mono,
  size = 15,
  children,
  style,
}: {
  t: Theme;
  muted?: boolean;
  mono?: boolean;
  size?: number;
  children: React.ReactNode;
  style?: StyleProp;
}) {
  return (
    <p
      style={{
        fontFamily: mono ? t.mono : t.sans,
        fontSize: size,
        lineHeight: 1.5,
        color: muted ? t.muted : t.inkSoft,
        margin: 0,
        textWrap: 'pretty' as React.CSSProperties['textWrap'],
        ...style,
      }}
    >
      {children}
    </p>
  );
}
