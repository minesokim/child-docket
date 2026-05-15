// Routing number → bank name lookup for intake autofill.
//
// Antonio's intake feedback (2026-05-14): when a client types a 9-digit
// routing number, autofill the bank name below the field. OLT does
// this; clients trust the system more when the bank name appears
// instantly.
//
// COVERAGE
//   ~120 exact-match routing numbers covering the top 25 US consumer
//   banks + the major brokerage cash management routings. Each entry
//   is an explicit routing-number → bank-name mapping; no prefix
//   matching (prefix-based lookup gives false positives since banks
//   share Federal Reserve district prefixes).
//
//   When the routing number isn't in the map, lookupBankByRouting
//   returns null and the bank-name field stays manual. Users can type
//   their bank name unchanged; we never override.
//
// WHY NOT AN API
//   Free APIs (routingnumbers.info, etc.) exist but: (1) latency on
//   every digit added is jarring; (2) external call during intake has
//   privacy implications — clients haven't yet given §7216 consent at
//   that step; (3) Antonio's bar is OLT — a local lookup, not a
//   roundtrip. v1 ships local-only.
//
// MAINTENANCE
//   Source: FedACH Participant Directory (public, free) +
//   www.routingnumbers.info cross-reference. Update when a major bank
//   adds a new ABA routing number (rare; usually only via M&A).

const ROUTING_TO_BANK: Record<string, string> = {
  // ─── JPMorgan Chase ───
  '021000021': 'Chase',
  '267084131': 'Chase',
  '322271627': 'Chase',
  '111000614': 'Chase',
  '044000037': 'Chase',
  '083000137': 'Chase',
  '021202337': 'Chase',
  '124001545': 'Chase',
  '102001017': 'Chase',
  '072000326': 'Chase',
  '021100361': 'Chase',
  '267084199': 'Chase',
  '325070760': 'Chase',
  '021201383': 'Chase',
  '124000545': 'Chase',
  // ─── Bank of America ───
  '026009593': 'Bank of America',
  '121000358': 'Bank of America',
  '063100277': 'Bank of America',
  '053000196': 'Bank of America',
  '054001204': 'Bank of America',
  '011000138': 'Bank of America',
  '061000052': 'Bank of America',
  '081000032': 'Bank of America',
  '111000025': 'Bank of America',
  '031202084': 'Bank of America',
  '122000661': 'Bank of America',
  '063000047': 'Bank of America',
  '125000024': 'Bank of America',
  // ─── Wells Fargo ───
  '121042882': 'Wells Fargo',
  '053000219': 'Wells Fargo',
  '091000019': 'Wells Fargo',
  '053101561': 'Wells Fargo',
  '063107513': 'Wells Fargo',
  '102000076': 'Wells Fargo',
  '111900659': 'Wells Fargo',
  '107002192': 'Wells Fargo',
  '125008547': 'Wells Fargo',
  '321270742': 'Wells Fargo',
  '091300010': 'Wells Fargo',
  '041215032': 'Wells Fargo',
  // ─── Citibank ───
  '021000089': 'Citibank',
  '322271724': 'Citibank',
  '254070116': 'Citibank',
  '266086554': 'Citibank',
  '271070801': 'Citibank',
  // ─── US Bank ───
  '091000022': 'U.S. Bank',
  '042000013': 'U.S. Bank',
  '091300023': 'U.S. Bank',
  '122105155': 'U.S. Bank',
  '081202759': 'U.S. Bank',
  '102000021': 'U.S. Bank',
  '123000220': 'U.S. Bank',
  // ─── PNC Bank ───
  '043000096': 'PNC Bank',
  '054000030': 'PNC Bank',
  '054001725': 'PNC Bank',
  '031207607': 'PNC Bank',
  '041000124': 'PNC Bank',
  '063102152': 'PNC Bank',
  '083000108': 'PNC Bank',
  '042000398': 'PNC Bank',
  // ─── Capital One ───
  '056073502': 'Capital One',
  '065000090': 'Capital One',
  '051405515': 'Capital One',
  '255071981': 'Capital One',
  '021407912': 'Capital One',
  '031176110': 'Capital One',
  // ─── TD Bank ───
  '031101266': 'TD Bank',
  '011103093': 'TD Bank',
  '054001547': 'TD Bank',
  '067014822': 'TD Bank',
  '211370545': 'TD Bank',
  // ─── Truist (formerly BB&T + SunTrust) ───
  '053101121': 'Truist',
  '053100300': 'Truist',
  '055002707': 'Truist',
  '061000104': 'Truist',
  '263191387': 'Truist',
  '263182817': 'Truist',
  '051503394': 'Truist',
  // ─── Charles Schwab ───
  '121202211': 'Charles Schwab',
  // ─── Goldman Sachs (Marcus) ───
  '124085244': 'Marcus by Goldman Sachs',
  // ─── Discover Bank ───
  '031100649': 'Discover Bank',
  // ─── Ally Bank ───
  '124003116': 'Ally Bank',
  // ─── Fidelity Cash Management ───
  '101205681': 'Fidelity',
  // ─── E*TRADE (Morgan Stanley) ───
  '056073573': 'E*TRADE',
  // ─── American Express National Bank ───
  '124085066': 'American Express Bank',
  // ─── HSBC Bank USA ───
  '022000020': 'HSBC',
  '021001088': 'HSBC',
  // ─── Citizens Bank ───
  '241070417': 'Citizens Bank',
  '011500120': 'Citizens Bank',
  '021313103': 'Citizens Bank',
  '036076150': 'Citizens Bank',
  // ─── Fifth Third Bank ───
  '042000314': 'Fifth Third Bank',
  '042100175': 'Fifth Third Bank',
  '063109935': 'Fifth Third Bank',
  // ─── KeyBank ───
  '041001039': 'KeyBank',
  '125200057': 'KeyBank',
  // ─── M&T Bank ───
  '022000046': 'M&T Bank',
  '052000113': 'M&T Bank',
  // ─── Huntington Bank ───
  '044000024': 'Huntington Bank',
  '241070378': 'Huntington Bank',
  // ─── Regions Bank ───
  '062000019': 'Regions Bank',
  '063104668': 'Regions Bank',
  '065003090': 'Regions Bank',
  // ─── Navy Federal Credit Union ───
  '256074974': 'Navy Federal Credit Union',
  // ─── USAA ───
  '314074269': 'USAA Federal Savings Bank',
  // ─── Pentagon Federal Credit Union ───
  '256078446': 'PenFed Credit Union',
  // ─── Chime ───
  '103100195': 'Chime (The Bancorp Bank)',
  '031101279': 'Chime (Stride Bank)',
  // ─── SoFi ───
  '031101334': 'SoFi Bank',
  // ─── Varo ───
  '084009519': 'Varo Bank',
  // ─── Robinhood ───
  '101019644': 'Robinhood',
  // ─── First Republic Bank (acquired by Chase; map for legacy) ───
  '321081669': 'First Republic Bank',
  // ─── Silicon Valley Bank (acquired by First Citizens) ───
  '121140399': 'Silicon Valley Bank',
  // ─── Mercury ───
  '084106768': 'Mercury (Choice Financial)',
  // ─── Brex ───
  '103113357': 'Brex Cash',
};

/**
 * Look up the bank name for a 9-digit ABA routing number.
 *
 * Returns the bank name when known, null otherwise. Safe to call on
 * every keystroke — does a single object lookup, no async, no network.
 *
 * @param routingNumber - 9-digit string. Spaces/dashes/non-digits
 *                        stripped before lookup.
 * @returns Bank name or null
 *
 * @example
 *   lookupBankByRouting('021000021')  → 'Chase'
 *   lookupBankByRouting('021 000 021') → 'Chase'  (whitespace stripped)
 *   lookupBankByRouting('999999999')  → null      (not in map)
 *   lookupBankByRouting('123')        → null      (incomplete)
 */
export function lookupBankByRouting(routingNumber: string): string | null {
  const digits = routingNumber.replace(/\D/g, '');
  if (digits.length !== 9) return null;
  return ROUTING_TO_BANK[digits] ?? null;
}

/**
 * The full routing → bank name map. Exported for inspection /
 * iteration if a caller needs to display a list of supported banks.
 * Treat as readonly.
 */
export const SUPPORTED_BANK_ROUTINGS: Readonly<Record<string, string>> =
  ROUTING_TO_BANK;
