// Returning-portal navigation. Sticky bottom 5-tab bar with dot indicators
// for Docs and Messages tabs (where unread / pending items live).
//
// active: 'home' | 'docs' | 'msgs' | 'sign' | 'profile'

import * as React from 'react';
import type { Theme } from '../tokens.js';

export type PortalTabId = 'home' | 'docs' | 'msgs' | 'sign' | 'profile';

export function PortalTabBar({
  t,
  active,
  onTab,
}: {
  t: Theme;
  active: PortalTabId;
  onTab: (id: PortalTabId) => void;
}) {
  const tabs: Array<{ id: PortalTabId; label: string; dot: boolean }> = [
    { id: 'home', label: 'Home', dot: false },
    { id: 'docs', label: 'Docs', dot: true },
    { id: 'msgs', label: 'Messages', dot: true },
    { id: 'sign', label: 'Sign', dot: false },
    { id: 'profile', label: 'Profile', dot: false },
  ];

  const renderIcon = (id: PortalTabId, on: boolean) => {
    const s = {
      width: 22,
      height: 22,
      fill: 'none',
      stroke: on ? t.rust : t.muted,
      strokeWidth: 1.5,
      strokeLinecap: 'round' as const,
      strokeLinejoin: 'round' as const,
    };
    switch (id) {
      case 'home':
        return (
          <svg {...s} viewBox="0 0 22 22">
            <path d="M3 10l8-7 8 7v9a1 1 0 01-1 1h-4v-6H8v6H4a1 1 0 01-1-1z" />
          </svg>
        );
      case 'docs':
        return (
          <svg {...s} viewBox="0 0 22 22">
            <path d="M6 2h7l4 4v13a1 1 0 01-1 1H6a1 1 0 01-1-1V3a1 1 0 011-1z" />
            <path d="M13 2v4h4M8 11h7M8 15h5" />
          </svg>
        );
      case 'msgs':
        return (
          <svg {...s} viewBox="0 0 22 22">
            <path d="M3 6a2 2 0 012-2h12a2 2 0 012 2v8a2 2 0 01-2 2h-6l-4 3v-3H5a2 2 0 01-2-2z" />
          </svg>
        );
      case 'sign':
        return (
          <svg {...s} viewBox="0 0 22 22">
            <path d="M3 17l4-1 10-10-3-3L4 13l-1 4z" />
            <path d="M12 5l3 3" />
          </svg>
        );
      case 'profile':
        return (
          <svg {...s} viewBox="0 0 22 22">
            <circle cx="11" cy="8" r="4" />
            <path d="M3 20c1-4 5-6 8-6s7 2 8 6" />
          </svg>
        );
    }
  };

  return (
    <div
      style={{
        position: 'sticky',
        bottom: 0,
        background: t.bgElev,
        borderTop: `1px solid ${t.border}`,
        padding: '10px 8px 24px',
        display: 'flex',
        justifyContent: 'space-around',
        zIndex: 10,
      }}
    >
      {tabs.map((tab) => {
        const on = active === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onTab(tab.id)}
            style={{
              background: 'none',
              border: 'none',
              padding: '6px 10px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 4,
              cursor: 'pointer',
              position: 'relative',
              fontFamily: t.sans,
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            <div style={{ position: 'relative' }}>
              {renderIcon(tab.id, on)}
              {tab.dot && (
                <div
                  style={{
                    position: 'absolute',
                    top: -1,
                    right: -3,
                    width: 7,
                    height: 7,
                    borderRadius: '50%',
                    background: t.rust,
                    border: `1.5px solid ${t.bgElev}`,
                  }}
                />
              )}
            </div>
            <div
              style={{
                fontSize: 10,
                color: on ? t.ink : t.muted,
                fontWeight: on ? 500 : 400,
                letterSpacing: 0.2,
              }}
            >
              {tab.label}
            </div>
          </button>
        );
      })}
    </div>
  );
}
