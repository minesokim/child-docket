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
        fontWeight: 500,
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
  return (
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
        ...style,
      }}
    >
      {children}
    </h1>
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
