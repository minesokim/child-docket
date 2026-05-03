'use client';

// Skeleton loaders — three variants (shimmer / pulse / wave).
//
// CSS lives in packages/ui/src/styles.css. Component pattern follows
// the design handoff (`docs/design_handoff_skeleton_loaders/`).
//
// IMPORTANT — RSC compatibility note:
//   Earlier this file exposed subcomponents via dot-notation
//   (Skeleton.Line, Skeleton.Heading, etc.). That pattern breaks
//   when a Server Component imports `Skeleton` from this 'use client'
//   module: Next.js converts the export into an opaque client
//   reference, and property access (`Skeleton.Line`) returns
//   undefined on the proxy → React renders <undefined /> → "Element
//   type is invalid" crash.
//
//   Fix: every primitive is exported as its OWN top-level named
//   export (SkeletonLine, SkeletonHeading, SkeletonSmall,
//   SkeletonCircle). Each is a separate client reference, accessible
//   from both Server and Client Components without proxying through
//   property access.
//
// USAGE
//   <SkeletonGroup variant="shimmer" panel label="Loading article">
//     <SkeletonHeading width="72%" />
//     <SkeletonLine width="100%" />
//     <SkeletonLine width="94%" />
//   </SkeletonGroup>

import * as React from 'react';

export type SkeletonVariant = 'shimmer' | 'pulse' | 'wave';

export interface SkeletonGroupProps {
  variant?: SkeletonVariant;
  /** Adds the panel-wide effect (shimmer card sweep / pulse bg breathe). */
  panel?: boolean;
  /** Marks the region as loading for assistive tech. */
  label?: string;
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}

export function SkeletonGroup({
  variant = 'shimmer',
  panel = false,
  label = 'Loading',
  className = '',
  style,
  children,
}: SkeletonGroupProps) {
  const variantClass =
    variant === 'shimmer' ? 'skel-shimmer' :
    variant === 'pulse'   ? 'skel-pulse'   :
                            'skel-wave';
  const composed = [variantClass, panel ? 'skel-panel' : '', className]
    .filter(Boolean)
    .join(' ');
  return (
    <div
      className={composed}
      style={style}
      aria-busy="true"
      aria-live="polite"
      aria-label={label}
    >
      {children}
    </div>
  );
}

export interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  /** Slight depth offset under pulse — useful for headings / accents. */
  primary?: boolean;
  /**
   * Override stagger index for wave (when DOM order != visual order, OR
   * when there are more than 12 rows and the default nth-of-type
   * cascade has run out). Index 0 = first row.
   */
  index?: number;
  className?: string;
  style?: React.CSSProperties;
}

function makeStyle({
  width,
  height,
  index,
  style,
}: SkeletonProps): React.CSSProperties {
  const computed: React.CSSProperties = { ...style };
  if (width !== undefined) computed.width = typeof width === 'number' ? `${width}px` : width;
  if (height !== undefined) computed.height = typeof height === 'number' ? `${height}px` : height;
  // Manual wave stagger: negative delay keeps the bar pre-rolled at t=0.
  if (index !== undefined) computed.animationDelay = `${-1.8 + index * 0.15}s`;
  return computed;
}

/** Generic skeleton bar. Same as SkeletonLine, but uncommitted to a height. */
export function Skeleton(props: SkeletonProps) {
  return (
    <div
      className={`skel-bar ${props.className ?? ''}`.trim()}
      data-skel={props.primary ? 'primary' : undefined}
      style={makeStyle(props)}
    />
  );
}

/** Body line (12px tall) — body copy placeholder. */
export function SkeletonLine(props: SkeletonProps) {
  return (
    <div
      className={`skel-bar ${props.className ?? ''}`.trim()}
      data-skel={props.primary ? 'primary' : undefined}
      style={makeStyle({ ...props, height: props.height ?? 12 })}
    />
  );
}

/** Heading bar (18px tall, primary depth) — title placeholder. */
export function SkeletonHeading(props: SkeletonProps) {
  return (
    <div
      className={`skel-bar ${props.className ?? ''}`.trim()}
      data-skel="primary"
      style={makeStyle({ ...props, height: props.height ?? 18 })}
    />
  );
}

/** Small bar (8px tall) — subtitle / caption placeholder. */
export function SkeletonSmall(props: SkeletonProps) {
  return (
    <div
      className={`skel-bar ${props.className ?? ''}`.trim()}
      data-skel={props.primary ? 'primary' : undefined}
      style={makeStyle({ ...props, height: props.height ?? 8 })}
    />
  );
}

/** Circular avatar / icon placeholder. */
export function SkeletonCircle({
  size = 40,
  ...props
}: SkeletonProps & { size?: number }) {
  return (
    <div
      className={`skel-circle ${props.className ?? ''}`.trim()}
      data-skel={props.primary ? 'primary' : undefined}
      style={makeStyle({ ...props, width: size, height: size })}
    />
  );
}
