# @docket/ui

Design primitives + tokens for both Docket apps. Editorial cream + forest green + rust accent, mobile-first, **inline-styled on purpose**.

**Hard rule:** every primitive must read identical to the designer's source files in `C:\Users\minse\Downloads\docket-portal-design\`. Inline styles are how we lock in design fidelity. Tailwind is for the layout / utility plumbing in app-level pages, never for primitive visual style.

## Layout

```
src/
├── tokens.ts                  # buildTheme() + the 3 tones
├── styles.css                 # @font-face Fraunces/DM Sans + global resets
├── intake-icons.tsx           # 13 line icons used across intake screens
├── services-catalog.tsx       # ServiceTile catalog for /service-path
├── components/
│   ├── _types.ts              # internal StyleProp helper (not exported)
│   ├── index.ts               # barrel — every public export lands here
│   ├── layout.tsx             # Screen, Stack, Row
│   ├── text.tsx               # Eyebrow, H1, H2, Body
│   ├── buttons.tsx            # Button, BackButton, IntakeBackButton
│   ├── indicators.tsx         # ProgressBar, Placeholder, TrustPill
│   ├── media.tsx              # AvatarSlot, VideoPlaceholder
│   ├── cards.tsx              # Card, ToggleCard, RadioRowCard, DependentCountCard
│   ├── fields.tsx             # FieldLabel, TextField, SSNField, EncryptedTextField
│   ├── antonio.tsx            # AskAntonioBar, AskAntonioChat, AntonioNote
│   ├── intake-frame.tsx       # SignOutProvider, IntakeRouteFrame, IntakeHeader,
│   │                          #   BottomBar, IntakeBottomBar, Footer
│   ├── icons.tsx              # IncomeIcon, HandCheckmark, Wordmark
│   ├── signature.tsx          # LegalDoc, SignaturePad
│   └── portal.tsx             # PortalTabBar
└── index.ts                   # package barrel
```

Consumers always import from the package root:

```ts
import { Screen, Stack, Button, Card, useIntakeField, buildTheme } from '@docket/ui';
```

Internal grouping under `components/` is for editor navigation. Reorganizing files inside `components/` does not need a major version bump as long as the barrel keeps the same names.

## Tokens

```ts
import { buildTheme } from '@docket/ui';

const t = buildTheme({ tone: 'editorial', density: 'comfortable', hue: 150 });
// t.bg, t.ink, t.rust, t.green, t.serif, t.sans, t.mono, t.radius, t.pad, …
```

| Token group | What's in it |
|---|---|
| Color | `bg`, `bgElev`, `card`, `ink`, `inkSoft`, `muted`, `border`, `borderSoft`, `rust`, `rustSoft`, `rustInk`, `green`, `tintAccent` |
| Typography | `serif` (Fraunces), `sans` (DM Sans), `mono` (DM Sans monospace fallback) |
| Spacing | `pad` (card padding), `radius` (component radius), `radiusLg` (modal radius) |
| Posture | `tone` ('editorial' / 'minimal' / 'magazine') |

The three tones are color + radius variations of the same primitives. The intake flow uses `editorial`. The portal home is on `editorial`. `magazine` is the high-contrast variant we'll use for the Command Room print-style report views once those land.

## Why inline styles, not Tailwind / CSS-in-JS

1. **Designer parity.** The Vazant prototype is 36 screens of inline-styled JSX. Porting them line-for-line catches drift instantly.
2. **No build pipeline.** No PostCSS / SWC plugin / runtime CSS extraction. The package ships as plain `.tsx`.
3. **Dynamic values stay readable.** `borderRadius: t.tone === 'magazine' ? 4 : 999` is a one-liner inline. In Tailwind that's a class-name conditional or a plugin.
4. **Static CSS still does heavy lifting** for what makes sense statically — see `styles.css` for `@font-face`, scrollbar suppression, focus rings, `@keyframes`.

If a new primitive doesn't need theme tokens at runtime, it's fine to author it as a Tailwind component in the consuming app. **Don't move pure-Tailwind components into `@docket/ui`** — that's the wrong layer.

## Adding a new primitive

1. Pick the file by purpose (layout / text / buttons / fields / cards / antonio / intake-frame / icons / media / indicators / signature / portal). When in doubt, make a new file rather than overload an existing one.
2. Required prop signature: every visual primitive takes `t: Theme` as the first prop. That's how it reads tokens; it's also why every component is fully theme-able from the consuming app.
3. Required style hook: every container primitive accepts `style?: React.CSSProperties` last so consumers can override the inline base.
4. Re-export from `components/index.ts`. The package barrel (`src/index.ts`) does `export * from './components/index';` — no edit needed there.
5. Visual smoke test: import it into `apps/client-portal` and render once on a real screen before merging. TypeScript compiles ≠ pixels match.

## Tests

UI primitives don't have unit tests — visual fidelity is verified by:

- `pnpm --filter @docket/ui exec tsc --noEmit` (compile gate; 0 errors required)
- A pass through both apps in dev: `pnpm --filter @docket/client-portal dev`
- A scan of the relevant intake screens (Welcome, Personal, Filing, Documents, Engagement, 8879)

Type fidelity is the safety net. A primitive that compiles + renders cleanly across all 38 client-portal routes is shippable.

## Common gotchas

- **`textWrap: 'pretty'` casts.** Browser support is uneven; we cast to `React.CSSProperties['textWrap']` so TypeScript's lib lag doesn't fight us.
- **`width / height` on root elements.** The `Screen` primitive uses `100dvh` (not `100vh`) so iOS Safari's collapsing URL bar doesn't push the bottom bar off-screen.
- **`SignOutProvider`.** Provides the sign-out handler that `IntakeHeader`'s logout pill calls. Wire it once at the (intake) and /portal layouts so any nested screen can render the pill without prop-drilling. Lives in `intake-frame.tsx` because that's where its only consumer is.
- **`AskAntonioChat` event channel.** Listens for the global `ask-antonio:open` event, dispatched by `AskAntonioBar`. Mount `<AskAntonioChat />` ONCE per layout (intake layout for now) so any screen below it can trigger the modal without a context provider.

## What does NOT belong here

- App-level routing / pages → `apps/client-portal/src/app/**`
- Server actions or `'use server'` files → app-level `lib/`
- Domain shapes (`IntakeState`, `IssueType`, branded IDs) → `@docket/shared`
- Drizzle schema → `@docket/db`
- Component fixtures / mocked-data screens — keep them inline in the consuming app, not in this package
