# Command-room dashboard reference — 2026-05-08

User-shared 5 frames captured the visual language for the command-room app
(`apps/command-room`). The frames were templates / visual-design exemplars
("Nexus Tax OS / Courtney Henry / The Web Dev Company"). Adopt the design
language; do NOT copy the literal screens or branding.

User instruction trail (verbatim):

1. > "i think this is the style of the dashboard i am going for. mind you
>    style, dont base the dashboard ui off of this. just the design language."

2. > "wait. i like the fonts and icon style and box style and the general
>    design lagnauge"

Translation: adopt the fonts, icon style, box style, layout composition,
density, and color treatment. Build Docket's content + flow + tax-domain
logic on top.

## What the frames captured

| Frame | Description |
|---|---|
| **Home (overview)** | Page header with eyebrow + display title "Home" + horizontal tab-bar (Overview / Work Queue / Calendar / Activity) + ⌘K search + Ask AI + bell. "Today's brief" hero block ("7 items need attention before Friday") with numbered items + per-item action buttons. 5-card stats row (Active matters / Reviews ready / Notices due / Documents waiting / Deadlines this week) with tinted icon-circles. Ongoing-work cards row (Corporate / Notices / Compliance / Review categories) with dot-bulleted progress + mini bar charts. Two-column bottom: Prepared work table (matter / output / status pill / next-step) + Recent activity feed. |
| **Settings (workspace tab)** | Settings page title + tab-bar (General / Workspace / Privacy / Notifications / Team / Billing / Integrations). Two-column form: section label + description on the left, fields on the right (Workspace Name / URL / Industry / Description / Week Starts On / Language / Time Zone). |
| **Calendar (week view)** | Calendar title + Today / arrow / + buttons. Two-column body: To-do List + Events checklist on the left (This week / This month / Unschedule / Personal sections), week grid on the right with hour rows + day columns and event cards (Webinar / API Strategy Workshop / Lunch Break) carrying small icon-tile + title + duration. |
| **Tasks (Kanban board)** | Tasks title + tab-bar (Overview / Lists / Board / Timeline / Files) + search + Status filter + sort + view-toggle. 4-column Kanban (To Do / In Progress / In Review / Done) with task cards: priority pill (High/Medium/Low) + tag pills (UI design / Interaction / Audit / etc.) + title + description + assignee avatars + add button. |
| **Tasks board zoomed** | Same as above, slightly different angle showing the card composition. |

## Compositional patterns (the bones of every command-room route)

- **Page header**: small eyebrow → large display title → horizontal tab-bar under the title → right-side cluster (⌘K search, Ask AI button, bell, sort/filter)
- **Today's brief block** (Home only): full-width card with statement headline + supporting paragraph + numbered list of named items with per-item action buttons
- **Stats-card row**: 5 modular cards. Each: tinted icon-circle, eyebrow label, large hero number, supporting line, comparison delta with up/down arrow
- **Ongoing work cards**: category pill (top-left, quiet tint) + title + 1-line description + dot-bulleted progress breakdown + mini bar chart at bottom
- **Prepared work table**: matter / output / status pill / next-step with timestamp
- **Recent activity feed**: line-icon left, title + subtitle middle, timestamp right
- **Sidebar**: workspace tile at top + ⌘F search + section-labeled nav groups (Essentials / Workspaces / Management / Support) + user pill at bottom

## Design language to adopt

**Typography** — geometric sans (Inter / Geist) for both display and body. Heavy weight (600-700) for display, regular/medium (400-500) for body. Tabular-nums for stat values. Single-family discipline.

**Icon style** — line glyphs, 1.5-2px stroke, 16-20px standard. Lucide-react canonical set. One icon per nav item / stat-card / activity-feed entry. Icons earn their place by encoding meaning.

**Box style** — white-or-near-white card on faint canvas. 1px border `oklch(92% 0.005 85)`. NO drop shadow on resting state. Border-radius 10-12px. Pills 9999px (full-round). NO left-border accents. NO gradients. NO glassmorphism.

**Color** — Docket forest green `oklch(42% 0.09 150)` replaces the reference's iOS-blue accent. Status pills (3 max): forest green / amber / red. Category pills (3-4 max): quiet earth-tones (moss / clay / dusk / sand), NOT the reference's 8-color rainbow. Sidebar dark warm gray `oklch(18% 0.01 85)`, NOT pure black.

**Density** — 24-32px gutters, comfortable line-height, large display headings, no wasted vertical space, no cramped horizontal space.

## What we DO NOT copy

- ❌ "Nexus Tax OS" / "Courtney Henry" / "The Web Dev Company" branding
- ❌ The 8-color category-pill rainbow
- ❌ iOS-blue accents — we're forest green
- ❌ Pure-white canvas — we're faint warm-gray
- ❌ Initials-only avatars — Antonio's `antonio.webp` is the live avatar
- ❌ "Ava Morgan / Head of Tax" demo content — we use real `useFirmOwner()` context
- ❌ The exact menu structure (Workspaces / Apps / Trello / Figma) — Docket's nav is its own
- ❌ Decorative bar charts where the data is fake — charts ship only on real ledger data

## Where to put the actual frame images

When the user re-shares the frame images (or saves them locally), drop them into this directory as:

- `01-home-overview.png`
- `02-home-overview-zoomed.png`
- `03-settings-workspace.png`
- `04-calendar-week.png`
- `05-tasks-board.png`

Then update this README to reference them inline.

## Detailed translation rules + per-component anti-patterns

See [`.claude/skills/craft/SKILL.md`](../../../.claude/skills/craft/SKILL.md). Re-read whenever opening a new command-room route.

---

*Last updated: 2026-05-08. The command-room visual language is locked here. Drift breaks the brand.*
