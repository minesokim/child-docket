// Image + video tiles.
//   - AvatarSlot: round headshot for the firm owner. Reads avatarUrl
//     from useFirmOwner() context; falls back to initials of the
//     owner's name when no URL is set; falls back to /antonio.webp
//     when there's no firm-owner data at all (legacy layouts that
//     don't wrap with TenantDisplayProvider).
//   - VideoPlaceholder: leafy-green tinted video tile on Welcome. Real
//     YouTube embed when a youtubeId is supplied; otherwise a styled mock.

import * as React from 'react';
import type { Theme } from '../tokens.js';
import type { StyleProp } from './_types.js';
import { initialsOf, useFirmOwner } from '../tenant-display-context.js';

export function AvatarSlot({
  t,
  size = 56,
  src,
  label,
  style,
}: {
  t: Theme;
  size?: number;
  /** Override avatar URL. When undefined, reads from useFirmOwner();
   *  when null, forces initials fallback even if context has a URL. */
  src?: string | null;
  /** Override the alt + initials text. When undefined, derives from
   *  the firm owner's name in context. */
  label?: string;
  style?: StyleProp;
}) {
  const owner = useFirmOwner();

  // Resolution order:
  //   1. Explicit src prop (wins all)
  //   2. firmOwner.avatarUrl from context
  //   3. /antonio.webp legacy default (only if owner is null —
  //      i.e., layout never wrapped with TenantDisplayProvider)
  //   4. Initials fallback (when owner is set but avatarUrl is null)
  const resolvedSrc =
    src !== undefined
      ? src
      : owner
      ? owner.avatarUrl
      : '/antonio.webp';

  const resolvedLabel = label ?? owner?.name ?? 'A';
  const initials = initialsOf(owner?.name);

  const baseStyle: React.CSSProperties = {
    width: size,
    height: size,
    borderRadius: '50%',
    overflow: 'hidden',
    border: `1px solid ${t.border}`,
    flexShrink: 0,
    background: t.bgElev,
    ...(style as React.CSSProperties | undefined),
  };

  if (resolvedSrc) {
    return (
      <div style={baseStyle}>
        <img
          src={resolvedSrc}
          alt={resolvedLabel}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            objectPosition: '50% 22%',
            display: 'block',
          }}
        />
      </div>
    );
  }

  // Initials fallback. Sized to match the avatar; uses the editorial
  // serif so it reads as a name plate, not a generic avatar mock.
  return (
    <div
      style={{
        ...baseStyle,
        background: t.ease.keylimeWash,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: t.ease.forestDark,
        fontFamily: t.serif,
        // Text size scales with the avatar — ~40% of diameter.
        fontSize: Math.max(10, Math.round(size * 0.4)),
        fontWeight: 500,
        letterSpacing: -0.4,
        textTransform: 'uppercase',
      }}
      aria-label={resolvedLabel}
    >
      {initials || '·'}
    </div>
  );
}

export function VideoPlaceholder({
  t,
  youtubeId,
  startSeconds,
}: {
  t: Theme;
  youtubeId?: string;
  startSeconds?: number;
}) {
  // Real YouTube embed when an ID is supplied — used for the welcome screen
  // intro video. Without an ID, falls back to the styled dark mock below.
  if (youtubeId) {
    const start = startSeconds ? `&start=${startSeconds}` : '';
    return (
      <div
        style={{
          width: '100%',
          aspectRatio: '16 / 9',
          borderRadius: t.radius,
          overflow: 'hidden',
          background: '#000',
          boxShadow: '0 8px 24px rgba(12, 31, 21, 0.18)',
        }}
      >
        <iframe
          src={`https://www.youtube.com/embed/${youtubeId}?playsinline=1&modestbranding=1&rel=0${start}`}
          title="Welcome from Antonio"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
        />
      </div>
    );
  }
  return (
    <div
      style={{
        width: '100%',
        aspectRatio: '16 / 9',
        borderRadius: t.radius,
        overflow: 'hidden',
        position: 'relative',
        background: 'linear-gradient(135deg, #1a3a26 0%, #0c1f15 70%, #050a07 100%)',
        cursor: 'pointer',
        boxShadow: '0 8px 24px rgba(12, 31, 21, 0.18)',
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(ellipse at 25% 20%, rgba(120, 180, 140, 0.12), transparent 55%)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.015) 2px, rgba(255,255,255,0.015) 3px)',
          mixBlendMode: 'overlay',
        }}
      />

      <div style={{ position: 'absolute', top: 14, left: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
        <div
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: '#d94545',
            boxShadow: '0 0 0 3px rgba(217, 69, 69, 0.22)',
          }}
        />
        <span
          style={{
            fontFamily: t.mono,
            fontSize: 9.5,
            color: 'rgba(255,255,255,0.75)',
            letterSpacing: 1.2,
            textTransform: 'uppercase',
          }}
        >
          REC · ANTONIO
        </span>
      </div>

      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 14,
        }}
      >
        <div
          style={{
            width: 68,
            height: 68,
            borderRadius: '50%',
            background: 'rgba(255, 255, 255, 0.15)',
            border: '1.5px solid rgba(255, 255, 255, 0.35)',
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.25)',
            transition: 'transform 0.15s',
          }}
        >
          <svg width="22" height="24" viewBox="0 0 22 24" fill="none" style={{ marginLeft: 4 }}>
            <path d="M2 2 L20 12 L2 22 Z" fill="#fff" />
          </svg>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              fontFamily: t.serif,
              fontSize: 17,
              color: '#fff',
              letterSpacing: -0.2,
              fontStyle: 'italic',
              marginBottom: 4,
            }}
          >
            A message from Antonio
          </div>
          <div
            style={{
              fontFamily: t.mono,
              fontSize: 10.5,
              color: 'rgba(255,255,255,0.6)',
              letterSpacing: 0.8,
            }}
          >
            1:12 · TAP TO PLAY
          </div>
        </div>
      </div>

      <div
        style={{
          position: 'absolute',
          bottom: 10,
          left: 14,
          right: 14,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <span
          style={{
            fontFamily: t.mono,
            fontSize: 9,
            color: 'rgba(255,255,255,0.55)',
            letterSpacing: 0.5,
          }}
        >
          0:00
        </span>
        <div style={{ flex: 1, height: 2, borderRadius: 2, background: 'rgba(255,255,255,0.2)' }} />
        <span
          style={{
            fontFamily: t.mono,
            fontSize: 9,
            color: 'rgba(255,255,255,0.55)',
            letterSpacing: 0.5,
          }}
        >
          1:12
        </span>
      </div>
    </div>
  );
}
