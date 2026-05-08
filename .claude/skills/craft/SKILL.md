# /craft — is this beautiful, intentional, Apple-bar UX

> *Run BEFORE committing any user-visible change. Ask the question /score and /align don't: is this beautiful? Is the UI good? Is this how Apple would handle this experience? If the answer to any is "no," fix it before merging.*

---

## Why this skill exists

User-codified 2026-05-08:

> "another skill to add within the entire loop of autopiloting. ask yourself, is this beautiful user experience? is this good ui? is this how apple would handle the user experience? the user experience should be one of the top priorities in terms of how decisions are made. i also want things to be beautiful and crafted with intention. tasteful."

Clarified same day:

> "that doesn't mean make the ui look like apple"

`/score` checks production-readiness. `/align` checks mission-alignment. **Neither catches AI-slop UI** — a feature can pass typecheck, tests, codex, all 12 score dimensions, AND serve an anchor, and still look like every other AI dashboard. That's the failure mode this skill blocks.

The Docket marketing differentiator is the design language itself (CLAUDE.md §11 + §19). Editorial warmth, not vibe-coded chrome. Every shadcn default that ships is a slow death of the brand. This skill is the bar.

---

## CRITICAL: Apple is the BAR, NOT the visual reference

**What "Apple-bar" means:**
- The level of intentionality applied to every pixel, every word, every state.
- The restraint to remove rather than add.
- The taste to choose 5 typescale steps instead of 14.
- The rigor of designing empty states, error states, loading states as first-class.
- The discipline of letting hierarchy + spacing + typography do the work of color + borders + icons.

**What "Apple-bar" does NOT mean:**
- Use SF Pro or Helvetica. (Docket uses **Fraunces serif + DM Sans**.)
- White / off-white backgrounds. (Docket uses **editorial cream**.)
- iOS blue accents. (Docket uses **forest green `oklch(42% 0.09 150)`**.)
- Apple's exact spacing system, exact radii, exact shadow depths.
- iCloud-flavored translucent panels. Glassmorphism. Frosted blur.
- Apple Mail's actual visual language copied wholesale.

**Docket has its own visual language.** Editorial warmth, not Cupertino minimalism. Fraunces display, DM Sans body, cream + ink + forest green, custom Docket tokens — that's the brand. The skill enforces the *rigor* Apple ships at, applied to *Docket's* language.

If a /craft pass produces a surface that looks like an Apple Mail clone, that's a FAIL. The visual answer should be unmistakably Docket. The craft level should be unmistakably Apple-tier.

Reference for visual language: `apps/client-portal/src/app/(intake)/welcome/`, `packages/ui/src/tokens.ts`, the warm-cream-and-forest-green-on-Fraunces feel of `Welcome to Vazant Consulting`. That's what the surface should look LIKE. Apple is the bar for HOW HARD we work on it.

---

## When this fires

After /code-quality, before /score. ANY commit that touches:
- A route under `apps/*/src/app/**`
- A component under `packages/ui/src/components/**`
- Token files (`packages/ui/src/tokens.ts`, `styles.css`)
- Copy strings users see (button labels, error messages, toasts, modal headings, empty states, loading states)
- Server-rendered HTML that the user reads

Skip if the commit is purely substrate (migrations, server-only helpers, agents, tests, infra).

```
finish item N (UI-touching)
  │
  ▼
typecheck + tests + /code-quality
  │
  ▼
/craft — is this beautiful, intentional, Apple-bar?
  │
  ├── PASS → /score → /align → /keep-going advances
  │
  └── FAIL → identify the lowest-craft surface, fix it,
            re-run /craft ⟲
```

---

## The Apple bar (rigor, not aesthetic)

The bar isn't "would this fit on apple.com." It's "would Apple's design team look at this Docket-flavored surface and respect the level of craft, even though the visual language is nothing like theirs?" Same rigor, different aesthetic. That bar has properties:

1. **Hierarchy is obvious in 2 seconds.** Eyes land on the right thing first. Type scale, weight, and spacing do the work, not borders or color.
2. **Typography is the design.** Fraunces serif for display. DM Sans body. No system-ui fallbacks shipping to prod. No 14 font sizes — 5 max, used consistently.
3. **Color is restrained.** Forest green primary `oklch(42% 0.09 150)`. Cream backgrounds. Ink text. No left-border accents. No status-color confetti (red/yellow/green dots everywhere). Color appears when it changes meaning.
4. **Motion serves intent.** Animations communicate state changes (entered/loaded/saved/failed). They are NOT decorative. Easing matches the thing being animated. Default duration 200ms; longer only when the thing being shown is large.
5. **Empty states are designed, not omitted.** "No clients yet" is an opportunity, not a placeholder. Apple Mail's "All caught up" is the bar.
6. **Error states are human, not technical.** "Something went wrong" is the wrong answer. "We couldn't reach Twilio. Your message is queued — we'll retry every 30 seconds for the next 5 minutes." is the right answer.
7. **Loading states are anticipatory, not blank.** Skeleton screens that match the eventual layout. NOT spinners on grey rectangles.
8. **Copy has voice.** Not corporate. Not AI-mush. The forbidden vocabulary in CLAUDE.md voice rules (`delve / crucial / robust / pivotal / landscape / tapestry / underscore / foster / showcase / intricate / vibrant / nuanced / multifaceted`) is the symptom; the disease is no taste.
9. **Friction lands on the right side.** Important actions feel important (confirm dialogs that actually require thought). Trivial actions are one-click. Apple's "Move to Trash" vs "Empty Trash" is the canonical example.
10. **Density is calibrated.** Antonio scans 50 client cards in 30 seconds OR studies 1 return for 30 minutes. Same UI primitives must serve both modes. Compact and comfortable both work; bloated does not.

---

## The six craft questions

Per UI-touching commit, answer all six:

### 1. Would I screenshot this for a Docket portfolio?

If the answer is "no" or "not yet," the surface isn't shipping-ready. Find the lowest-craft component on screen and ask why it lowers the bar. NOTE: portfolio for *Docket* — the visual answer should look like cream + forest green editorial warmth, not Apple's white/blue. The craft level matches Apple; the visual language stays Docket.

### 2. Where is the eye supposed to land first?

Look at the surface. Where does the eye go? Is that the right thing? If the eye lands on a left-border accent, a status-color dot, or a decorative icon — those are pulling attention from the actual content. Remove them.

### 3. Is the hierarchy doing the work, or is it color/borders/icons doing it?

Test: remove all color and all borders. Does hierarchy still hold? If the surface collapses without color cues, the type scale + spacing + weight are weak. Fix the structure first; reintroduce color (forest green for primary, ink for text, cream for canvas) only where it changes meaning.

### 4. Does the copy sound like it was written by a human?

Read it out loud. Does it sound like Antonio talking to a client? Or does it sound like AI mush? Forbidden patterns:
- "Successfully [verb]ed" — Apple says "Saved." or just shows the saved state.
- "An error occurred" — be specific or be silent. "We couldn't reach Twilio."
- "Modal opened / closed" — never narrate UI events; show them.
- "Click here to..." — links say what they go to. "View invoice."
- AI vocab anywhere.

### 5. Is the empty / loading / error state designed?

Three states every list/card/route must have:
- **Empty.** What does Antonio see when there are zero clients? Should feel like an opportunity, not a void.
- **Loading.** Skeleton matching the eventual layout. NOT a spinner on grey.
- **Error.** Specific cause + what we're doing about it + what Antonio can do.

If any of the three is unstyled, the surface fails /craft.

### 6. Is every element earning its place?

Apple-bar test: remove the element. Does the surface get worse, stay the same, or get better? If "stay the same" or "get better," delete it. Decorative icons that don't add information. Left-border accents that decorate cards. Status pills repeating what's already in the heading. Filler copy ("Welcome! We're glad you're here."). All slop. Remove.

---

## Anti-patterns this skill blocks

### Generic shadcn defaults
Default `<Card>` with `border-border bg-card text-card-foreground`. Default `<Button variant="default">` with the gray hover. Default `<Dialog>` with the dark overlay. **All forbidden.** Reshape with Docket tokens or use the existing `packages/ui` primitives.

### Left-border accent lines
Per CLAUDE.md §19 + memory feedback. Cards with a 4px colored bar on the left. Decorative. Adds nothing. Remove.

### Decorative icons
Generic Lucide/Heroicons next to every label. Apple Mail's compose button is a pencil glyph because it MEANS compose. A "Settings" link with a gear icon next to the word "Settings" is decoration. Remove the icon.

### Vibe-coded gradients
Linear gradients on hero text. Glassmorphism. Animated mesh backgrounds. **All slop.** Cream and ink. Forest green where it changes meaning. That's the palette.

### AI vocab in copy
`delve / crucial / robust / pivotal / landscape / tapestry / underscore / foster / showcase / intricate / vibrant / nuanced / multifaceted / fundamental / significant / comprehensive / additionally / moreover / furthermore`. Strip them all. Antonio doesn't talk like that.

### Status-color confetti
Red dots, yellow dots, green dots, blue badges, purple chips — pick a meaning system and stick to it. Forest green = good. Amber = needs attention. Red = critical. That's it. No "blue = informational" decoration.

### Loading spinners on blank space
Skeleton screens or nothing. Spinners over grey rectangles is the universal "AI app" tell.

### Modal-in-modal-in-modal
If a flow needs three modals, it doesn't need modals — it needs a route. Apple goes flat-and-shallow; AI tools default to nested-and-deep.

### Toast spam
"Saved!" "Loading..." "Modal opened" "Settings updated" "Profile saved" — every state change does NOT need a toast. Show the saved state in the UI. Reserve toasts for things the user couldn't otherwise notice (background sync completed, message sent in background).

### Microcopy that wastes
"Welcome to your dashboard!" "Here's where you'll find your clients!" Dead words. Replace with the thing itself.

---

## Worked examples

### Passes ✓

**Client portal intake screens** — Cream + forest green + Fraunces. Hand-crafted feel. Antonio's avatar in the corner. Continue button gated by `canAdvanceFromStep`. Loading state is the field disabled, not a spinner. Error state is inline under the field. Copy is a sentence, not a paragraph. Apple-bar.

**TrustPill component** — Single rounded pill with two states (verified / pending). Forest green for verified, amber for pending. No icon — the word "Verified" is the icon. No left-border. No drop shadow. The shape carries the meaning. Apple-bar.

### Fails ✗ (hypothetical)

**Generic settings page using shadcn defaults** — `<Card><CardHeader><CardTitle>` etc. Looks like every Vercel template. Q1 fails (wouldn't screenshot it). Q3 fails (color/borders doing all the work). **Reshape with Docket tokens.**

**"Loading..." text on a grey rectangle while Inngest fetches messages** — Q5 fails (loading state is undesigned). **Replace with skeleton matching the message layout.**

**"An error occurred while saving your changes. Please try again later."** — Q4 fails (AI mush). **Replace with: "We couldn't save. Your changes are kept locally — we'll retry when the connection is back. (You can keep working.)"**

### Borderline

**Health status banner during Neon outage** — Q4 (copy) was AI-mush in V1 ("Your saves are queued — we'll persist them later"). Codex caught it; reshape made the copy specific to what the system actually does. **After fix: passes.** Before fix: failed.

---

## Output format

```
/craft on [route or component]

Q1 (screenshot-worthy):     [yes / not yet — what's lowering the bar]
Q2 (eye lands on the right thing): [yes / no — what's stealing attention]
Q3 (hierarchy without color):     [yes / no — what collapses without color]
Q4 (copy has voice):                 [yes / no — flagged phrases]
Q5 (empty/loading/error designed):  [empty: ✓/✗  loading: ✓/✗  error: ✓/✗]
Q6 (every element earns place):     [yes / no — items to remove]

Verdict: PASS / FAIL
If FAIL: smallest fix is [X]. Re-run /craft after.
```

---

## Reference exemplars (the bar)

When in doubt, look at:

- **Apple Mail compose** — empty state, autofill, send animation, error states. (Bar of craft, NOT visual reference.)
- **Linear inbox** — density, hierarchy, motion. (Bar of craft, NOT visual reference — we're not Linear-purple.)
- **Stripe Atlas onboarding** — copy voice, friction calibration, status communication.
- **Notion empty states** — "Press space for AI" feels like an opportunity, not a void.
- **Our own intake flow** (`apps/client-portal/src/app/(intake)/**`) — when authored carefully, the bar internally.

Anti-references — the slop bar:
- Generic shadcn templates (Vercel starter aesthetic).
- Default Tailwind UI (every B2B SaaS in 2024).
- ChatGPT's settings modal (the AI-mush copy + dense gray).

---

## Command-room visual reference (the design language, adopted)

User-shared 2026-05-08 — five "Nexus Tax OS / Courtney Henry" dashboard frames. The instruction trail:

> "i think this is the style of the dashboard i am going for. mind you style, dont base the dashboard ui off of this. just the design language."

Then clarified same day:

> "wait. i like the fonts and icon style and box style and the general design lagnauge"

**Translation:** the command room's design language IS this. Adopt the fonts, icon style, box style, layout composition, density, color treatment. **Do not copy the literal screens or the "Nexus Tax OS" branding.** Build Docket's content + flow + tax-domain logic on top of this design language.

### Two visual languages now coexist in the product

| Surface | Visual language | Why |
|---|---|---|
| **Client portal + intake** (`apps/client-portal/(intake)`, `apps/client-portal/portal`) | **Editorial-warm** — Fraunces serif display + DM Sans body + cream canvas + forest green primary. Custom Docket tokens. Hand-crafted-feel. | Taxpayer-facing. Antonio's clients sit in an emotional-trust transaction. The portal feels like a thoughtful welcome from a real practice, not a SaaS dashboard. |
| **Command room** (`apps/command-room`) | **Operational-modern** — geometric sans (Inter / Geist) for both display and body, line-glyph icons, white-or-near-white card on faint-warm-gray canvas, soft 1px borders, small radius (10-12px), dark sidebar spine, tab-bar-under-title composition. Forest green stays as the primary accent. | Antonio-facing. The operational pane Antonio scans 100x/day. Density and clarity beat warmth. Same craft level as the portal, different job. |

**Both surfaces share:** forest green primary `oklch(42% 0.09 150)`, the same Antonio-voice copy rules, the same anti-AI-slop discipline, the same restraint. Different fonts and densities; same product.

### Command-room design language (adopted from reference)

**Typography**
- **Display**: geometric sans — Inter, Geist, or similar — for page titles ("Home", "Settings"). Heavy weight (600-700). Tight tracking. Large size (~32-40px).
- **Body + UI**: same family as display, regular/medium weight (400-500), 14-15px standard. Single-family discipline — no mixing 3 fonts.
- **Eyebrow**: small (11-12px), uppercase or sentence-case, faint ink, used above the display title and on stat-card labels.
- **Numbers**: same family, tabular-nums for stat values ("248", "37").
- **Token target**: add `font-display: Inter, system-ui` and `font-body: Inter, system-ui` tokens into `packages/ui/src/tokens.ts` under a `commandRoom` namespace. Keep `editorial` namespace (Fraunces + DM Sans) intact for the portal.

**Icon style**
- **Line glyphs**, 1.5-2px stroke, 16-20px standard. Lucide-react is the canonical set; `packages/ui/src/icons/solar.tsx` (the 7,848-line liability) is the wrong vibe for command-room — solid icons feel heavier than the reference. Add Lucide as a dependency for command-room only; portal/intake keeps using current Solar set if it earns its place.
- One icon per nav item, one per stat-card, one per activity-feed entry. Icons earn their place by encoding meaning (Documents = file glyph, Calendar = calendar glyph, etc.). No decorative icons.
- Tinted icon-circles for stat cards: small (28-32px) circle, soft tint background (forest-green/clay/dusk/sand at low opacity), line-glyph centered.

**Box style**
- White-or-near-white card on faint canvas. Card background: `oklch(99% 0.005 85)`; canvas background: `oklch(96% 0.008 85)` (a slightly cooler, slightly grayer cream than the portal's `oklch(98% 0.01 85)`).
- 1px border at `oklch(92% 0.005 85)`. NO drop shadow on resting state. Optional very-subtle shadow on hover/active for interactive cards.
- Border-radius: **10-12px** standard. Buttons same. Pills 9999px (full-round).
- NO left-border accent lines anywhere. NO gradient backgrounds. NO glassmorphism.

**Color**
- **Primary accent**: Docket forest green `oklch(42% 0.09 150)` replaces the reference's iOS-blue.
- **Status pills (3 max)**: forest green = good/ready, amber `oklch(75% 0.13 75)` = needs attention, red `oklch(58% 0.22 25)` = critical. Low-saturation tinted background, ink text, no border.
- **Category pills (3-4 max)**: drawn from a quiet earth-tone palette — moss / clay / dusk / sand. NOT the reference's 8-color rainbow (Corporate=blue, Notices=red, Compliance=green, Review=purple). Less saturation. Tax-practice categories should feel professional, not Trello-card-fluorescent.
- **Sidebar**: dark warm gray `oklch(18% 0.01 85)` — NOT pure black. Ink-on-ink. Section labels at `oklch(58% 0.005 85)`. Active nav item ground at `oklch(24% 0.01 85)`.

**Composition patterns to ship**
- **Page header**: tiny breadcrumb/eyebrow → large display title → horizontal tab-bar under the title (subtle bottom-border on active tab). Right-side: ⌘K search, Ask AI button, notification bell, sort/filter trigger.
- **Today's brief block**: eyebrow + statement headline ("7 items need attention before Friday.") + supporting paragraph + numbered list (1, 2, 3) of named items with a per-item action button on the right. This IS the Morning Brief from CLAUDE.md §4.
- **Stats-card row**: 5 modular cards. Each: tinted icon-circle, eyebrow label, large number (the hero), supporting line, comparison delta with up/down arrow. Quiet hierarchy.
- **Ongoing work cards**: category pill (top-left, quiet tint) + title + 1-line description + dot-bulleted progress breakdown + mini bar chart at bottom. Mini chart only ships when the data is real (audit chain, ledger queries) — never decorative.
- **Prepared work table**: matter / output / status pill / next-step with timestamp.
- **Recent activity feed**: line-icon left, title + subtitle middle, timestamp right ("18m ago"). Quiet.
- **Sidebar**: workspace tile at top (Vazant Consulting + initials/logo + collapse toggle), search with ⌘F, section-labeled nav groups (Essentials / Workspaces / Management / Support), user pill at bottom (Antonio's `antonio.webp` photo + name + role + chevron).
- **Density**: 24-32px gutters, comfortable line-height, large display headings, no wasted vertical space, no cramped horizontal space.

### What we DO NOT copy from the references
- ❌ "Nexus Tax OS" branding, logo, exact workspace tile design.
- ❌ The 8-color category-pill rainbow. Cap at 3-4 quiet earth-tones.
- ❌ iOS-blue accents. We're forest green.
- ❌ Decorative mini-bar-charts where the data is fake. Charts ship only on real ledger data.
- ❌ Pure-white canvas. Even the "operational-modern" surface is a faint warm-gray, NOT iCloud white.
- ❌ Initials-only avatars. Antonio's `antonio.webp` photo is the live avatar; initials are the fallback only.
- ❌ "Ava Morgan / Head of Tax" demo content. We use real `useFirmOwner()` context.
- ❌ The exact menu structure (Workspaces / Management / Support / Apps / Trello / Figma). Docket's nav is its own — Home / Clients / Documents / Messages / Notices / Filings / Reviews / Settings.

### Where the reference frames live
Save copies of the user-shared frames to `docs/visual-reference/dashboard-2026-05-08/` as a follow-up. Re-open them whenever building a new command-room route to confirm the language match. The frames captured: Home (overview), Settings (workspace tab), Calendar (week view), Tasks (Kanban board).

---

## Iteration discipline

If /craft fails, do NOT batch the fix into a "polish later" follow-up. The whole point of running this in the loop is that polish-later items rot — the surface ships, the user sees the slop, the brand erodes. Fix it now or descope the surface from this commit.

Tradeoff: a UI commit might run /craft 3 times before passing. That's correct behavior. The loop budget allows for it. Speed comes from not having to fix this in v1.5.

---

## What this skill does NOT do

- Replace /score (production-readiness)
- Replace /align (mission-alignment)
- Auto-generate design — surfaces the gap; the loop fixes it
- Apply to substrate-only commits (migrations, helpers, agents, tests)
- Override the design tokens — `packages/ui/src/tokens.ts` is the source of truth; /craft enforces it, doesn't extend it

---

*Last updated: 2026-05-08. The product differentiator is the design language. Every shadcn default that ships is a slow death. /craft is the gate.*
