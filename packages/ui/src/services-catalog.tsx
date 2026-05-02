// Service catalog — paths, "other" sub-options, and per-path add-ons.
// Used by ScreenServicePath (intake step 1A) and ScreenServiceAddons (1B).

import * as React from 'react';
import type { Theme } from './tokens';
import {
  SolarPersonalReturn,
  SolarSelfEmployed,
  SolarBusiness,
  SolarConsultation,
} from './icons/solar';

export type ServiceIconKind =
  | 'personal'
  | 'self'
  | 'biz'
  | 'rental'
  | 'crypto'
  | 'amend'
  | 'states'
  | 'fbar'
  | 'consult'
  | 'formation'
  | 'books'
  | 'strategy';

export function ServiceIcon({
  t,
  kind,
  size,
}: {
  t: Theme;
  kind: ServiceIconKind;
  /** Optional size override. Solar Line Duotone icons (the 4 path
   *  kinds) default to 26 so they fill the 44×44 well with breathing
   *  room. Lineart fallbacks keep their 20×20 default. */
  size?: number;
}) {
  // The 4 service path kinds use the new Solar Line Duotone samples
  // (forestDark stroke + mintGlaze accent fill). Other kinds still
  // render the legacy lineart — those will migrate in the next batch.
  if (kind === 'personal') return <SolarPersonalReturn size={size ?? 26} />;
  if (kind === 'self') return <SolarSelfEmployed size={size ?? 26} />;
  if (kind === 'biz') return <SolarBusiness size={size ?? 26} />;
  if (kind === 'consult') return <SolarConsultation size={size ?? 26} />;

  const lineartSize = size ?? 20;
  const s = {
    width: lineartSize,
    height: lineartSize,
    stroke: t.rustInk,
    strokeWidth: 1.4,
    fill: 'none',
  } as const;
  const map: Record<ServiceIconKind, React.ReactNode> = {
    personal: null, // handled above
    self: null,
    biz: null,
    consult: null,
    rental: (
      <svg {...s} viewBox="0 0 20 20">
        <path d="M3 10l7-6 7 6v7H3z" strokeLinejoin="round" />
        <path d="M8 17v-4h4v4" />
      </svg>
    ),
    crypto: (
      <svg {...s} viewBox="0 0 20 20">
        <circle cx="10" cy="10" r="7" />
        <path
          d="M8 7v6M12 7v6M7 9h5a1.5 1.5 0 010 3H7M7 9l-1 1M7 12l-1 1"
          strokeLinecap="round"
        />
      </svg>
    ),
    amend: (
      <svg {...s} viewBox="0 0 20 20">
        <path d="M4 4h9l3 3v9H4z" strokeLinejoin="round" />
        <path d="M7 11l3 3 5-5" strokeLinecap="round" />
      </svg>
    ),
    states: (
      <svg {...s} viewBox="0 0 20 20">
        <path d="M3 5l4-1 6 2 4-1v11l-4 1-6-2-4 1z" strokeLinejoin="round" />
        <path d="M7 4v12M13 6v12" />
      </svg>
    ),
    fbar: (
      <svg {...s} viewBox="0 0 20 20">
        <circle cx="10" cy="10" r="7" />
        <path d="M3 10h14M10 3c2.5 2 2.5 12 0 14M10 3c-2.5 2-2.5 12 0 14" />
      </svg>
    ),
    formation: (
      <svg {...s} viewBox="0 0 20 20">
        <path d="M5 3h7l3 3v11H5z" strokeLinejoin="round" />
        <path d="M12 3v4h3M8 11h4M8 13h4" strokeLinecap="round" />
      </svg>
    ),
    books: (
      <svg {...s} viewBox="0 0 20 20">
        <path
          d="M4 4h5a2 2 0 012 2v11a2 2 0 00-2-2H4zM16 4h-5a2 2 0 00-2 2v11a2 2 0 012-2h5z"
          strokeLinejoin="round"
        />
      </svg>
    ),
    strategy: (
      <svg {...s} viewBox="0 0 20 20">
        <path
          d="M3 15l4-5 3 2 4-6 3 4"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        <circle cx="7" cy="10" r="1.2" fill={t.rustInk} />
        <circle cx="14" cy="6" r="1.2" fill={t.rustInk} />
      </svg>
    ),
  };
  return <>{map[kind] ?? null}</>;
}

export type ServicePathId = 'personal' | 'self' | 'biz' | 'other';
export type ServiceOtherSubId = 'intro' | 'formation' | 'books' | 'strategy';

export type ServiceCatalogItem = {
  id: string;
  name: string;
  sub: string;
  fee: string;
  lo: number;
  hi: number;
  icon: ServiceIconKind;
};

export const SERVICE_CATALOG: {
  paths: Array<ServiceCatalogItem & { id: ServicePathId }>;
  otherSub: Array<ServiceCatalogItem & { id: ServiceOtherSubId }>;
  addons: Record<ServicePathId, ServiceCatalogItem[]>;
} = {
  paths: [
    { id: 'personal', name: 'Personal tax return', sub: 'W-2 income, maybe a 1099', fee: '$150 – $250', lo: 150, hi: 250, icon: 'personal' },
    { id: 'self', name: 'Self-employed return', sub: 'Schedule C or 1099 income', fee: '$250 – $500', lo: 250, hi: 500, icon: 'self' },
    { id: 'biz', name: 'Business return', sub: 'S-Corp, Partnership, LLC', fee: '$500 – $1,000', lo: 500, hi: 1000, icon: 'biz' },
    { id: 'other', name: 'Something else', sub: 'Consultation, new business, bookkeeping', fee: 'Varies', lo: 0, hi: 0, icon: 'consult' },
  ],
  otherSub: [
    { id: 'intro', name: 'Introductory consultation', sub: 'New clients — get acquainted', fee: 'Free', lo: 0, hi: 0, icon: 'consult' },
    { id: 'formation', name: 'Business formation', sub: 'LLC, S-Corp, Partnership setup — plus state fees', fee: '$500 – $1,500', lo: 500, hi: 1500, icon: 'formation' },
    { id: 'books', name: 'Bookkeeping consultation', sub: 'Review your current process', fee: 'Free initial', lo: 0, hi: 0, icon: 'books' },
    { id: 'strategy', name: 'Strategic tax & business consultation', sub: 'Planning, entity structure, long-term', fee: '$300 – $600', lo: 300, hi: 600, icon: 'strategy' },
  ],
  addons: {
    personal: [
      { id: 'rental', name: 'Rental property', sub: '+$150 per property', fee: '+ $150', lo: 150, hi: 150, icon: 'rental' },
      { id: 'crypto', name: 'Crypto transactions', sub: 'Trades, staking, wallets', fee: '+ $100', lo: 100, hi: 100, icon: 'crypto' },
      { id: 'states', name: 'Multi-state filing', sub: 'Per additional state', fee: '+ $75 – $150', lo: 75, hi: 150, icon: 'states' },
      { id: 'fbar', name: 'Foreign accounts (FBAR)', sub: 'Assets held outside the US', fee: '+ $250', lo: 250, hi: 250, icon: 'fbar' },
      { id: 'amend', name: 'Prior year amendment', sub: 'Correcting a filed return', fee: '$200 – $400', lo: 200, hi: 400, icon: 'amend' },
    ],
    self: [
      { id: 'rental', name: 'Rental property', sub: '+$150 per property', fee: '+ $150', lo: 150, hi: 150, icon: 'rental' },
      { id: 'crypto', name: 'Crypto transactions', sub: 'Trades, staking, wallets', fee: '+ $100', lo: 100, hi: 100, icon: 'crypto' },
      { id: 'states', name: 'Multi-state filing', sub: 'Per additional state', fee: '+ $75 – $150', lo: 75, hi: 150, icon: 'states' },
      { id: 'fbar', name: 'Foreign accounts (FBAR)', sub: 'Assets held outside the US', fee: '+ $250', lo: 250, hi: 250, icon: 'fbar' },
      { id: 'amend', name: 'Prior year amendment', sub: 'Correcting a filed return', fee: '$200 – $400', lo: 200, hi: 400, icon: 'amend' },
    ],
    biz: [
      { id: 'states', name: 'Multi-state filing', sub: 'Per additional state', fee: '+ $75 – $150', lo: 75, hi: 150, icon: 'states' },
      { id: 'amend', name: 'Prior year amendment', sub: 'Correcting a filed return', fee: '$200 – $400', lo: 200, hi: 400, icon: 'amend' },
      { id: 'books', name: 'Bookkeeping cleanup', sub: 'Before we prep the return', fee: '$300 – $800', lo: 300, hi: 800, icon: 'books' },
    ],
    other: [],
  },
};
