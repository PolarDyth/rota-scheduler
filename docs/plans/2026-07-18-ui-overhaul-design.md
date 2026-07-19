# UI Overhaul Design — 2026-07-18

## Goal

Complete UI overhaul of the rota scheduler. Make it intuitive for managers who are not confident with technology. Use shadcn components. No emojis anywhere.

## Decisions

1. **Full restructure as progressive wizard** — 5 guided steps, one decision per screen.
2. **5-step flow**: Upload → Confirm staff & shifts → Tag roles & departments → Staffing rules → Schedule.
3. **Light theme only** using M&S (Marks & Spencer) palette. Black primary, Sparks gold accent, cream secondaries, tight 0.25rem radius, square buttons (`rounded-none`).
4. **Friendly specialised-role labels** in UI (internal IDs untouched): Bra Fit, Bureau, Visual Merchandising, Stock Controller.
5. **Section-level help, minimal tooltips** — heading + one-sentence explanation per step, accordion for specialised-role explanations, helper text under inputs.

## Architecture

### URL & state

- `?step=upload|confirm|tag|rules|schedule` (was `upload|review|schedule`).
- `sessionStorage` key `rota-flow-v1` keeps its role. `step` field drives a top-of-page Stepper.
- Completed steps are clickable in the stepper to jump back; future steps disabled until prerequisites met.
- `FlowState` adds `confirm` and `tag` to the `Step` union. Migration logic in `migratePriorityOrder` extended to remap legacy `review` step to `confirm`.

### Layout shell

- `AppShell` client component wraps every step.
- Fixed header: text-based wordmark left ("ROTA SCHEDULE" tracked caps, no logo file) + "Start over" ghost link right.
- Stepper directly below header: 5 numbered stages with labels, current stage highlighted in gold, completed stages show check icon.
- Main content: centered `max-w-5xl` column with generous padding.
- Footer per step: sticky action bar with `Back` (ghost) left, `Continue` (primary) right.

### Validation gates

- Confirm step requires ≥1 employee with valid shift (end > start).
- Tag step: no hard gate (defaults work).
- Rules step: no hard gate (defaults work).

## Design tokens

M&S palette as CSS variables in `globals.css`:

```css
:root {
  --background: #ffffff;
  --foreground: #101820;
  --card: #ffffff;
  --card-foreground: #101820;
  --popover: #ffffff;
  --popover-foreground: #101820;
  --primary: #101820;
  --primary-foreground: #ffffff;
  --secondary: #ebe4d7;
  --secondary-foreground: #101820;
  --muted: #f4f1eb;
  --muted-foreground: #66635e;
  --accent: #a98b52;
  --accent-foreground: #ffffff;
  --destructive: #b42318;
  --destructive-foreground: #ffffff;
  --border: #ded8cc;
  --input: #ded8cc;
  --ring: #a98b52;
  --radius: 0.25rem;
}
```

Dark mode palette stored but no toggle wired (future use).

### Component conventions

- Primary CTAs: `bg-primary text-primary-foreground` (black).
- Active stepper stage, specialised role badges, "preferred" indicator: Sparks gold accent.
- Section cards: white surface with `border` colour separators.
- Subtle cream `bg-secondary` for muted/helper areas.
- Buttons: `rounded-none` override on shadcn Button. Cards/inputs keep 0.25rem radius.
- Warnings/errors: custom Alert variant with cream/yellow tint, NOT red — warnings shouldn't feel alarming.
- No emojis anywhere. Replace existing 📄, ☼, ↑↓, ✕, ≡ with `lucide-react` icons.

## Step specifications

### Step 1 — Upload

Centered `Card` on default background. Title "Upload today's rota" + helper "Export the Schedule Editor PDF from your store system, then choose it below." Dashed drop-zone with `UploadCloud` icon (32px). File name displays in muted text below once selected. Single primary button "Extract rota". Errors shown as inline cream-tinted Alert with plain-English message.

No stepper click target on this step — it's the entry.

### Step 2 — Confirm Staff & Shifts

Heading "Check who's working today" + helper "We found N people. Please check each name, shift time, and break — fix anything that looks wrong."

Layout: `Card` wrapping `Table` with columns:
- Name (`Input`)
- Shift start (`Input type=time`)
- Shift end (`Input type=time`)
- Breaks (repeated `Input type=time` pairs, each with ghost trash-icon button, plus ghost "Add break" button)
- Warnings (gold `Badge` if breaks overlap shift or fall outside it)

Bulk-select bar slides up when rows selected (sticky footer pattern).

Action bar: `Back` (ghost), `Continue: Tag roles` (primary).

Validation: Continue disabled if 0 employees or any shift has end ≤ start.

### Step 3 — Tag Roles & Departments

Heading "Tag specialised roles & departments" + helper "Pick which staff are doing specialist jobs today, and which department each person works in. This decides who can cover fitting rooms and which specialist roles get filled."

Below heading: cream `Alert` "Not sure what these mean?" + accordion with each specialised role's one-line description.

Layout: `Table` with columns:
- Name (read-only text)
- Specialised role (`Select`: None / Bra Fit / Bureau / Visual Merchandising / Stock Controller)
- Preferred? (`Switch`, disabled if no role picked)
- Department (`Select`: Any / Menswear / Womenswear / Kidswear / Home / Beauty)

Gold accent dot next to names with specialised roles.

Action bar: `Back`, `Continue: Set staffing rules`.

### Step 4 — Staffing Rules

Heading "Set staffing rules" + helper "Tell us how many people each role needs at different times of day. These decide which jobs get filled first when there aren't enough people."

Top `Card`: "Rotation settings" with one field — `Max hours on same role` number input + helper "How long someone stays on the same job before rotating. Set 0 for no limit. Specialist roles ignore this."

Below: `Tabs` with four tabs (Customer-facing / Fitting rooms / Floor / Specialised). Each tab lists jobs vertically. Per job: colour swatch + friendly label + rules (start–end + count + "no max" `Switch` + trash button) + ghost "Add window" button.

Priority order editor: accordion at bottom ("Advanced: priority order"), collapsed by default. Uses existing drag handles + lucide `ArrowUp`/`ArrowDown` icons.

Action bar: `Back`, `Generate schedule` (primary).

### Step 5 — Schedule

Top to bottom:

1. **Success summary card** — `CardHeader` "Your schedule is ready" + `CardDescription` "{Day} {date} · {N} employees · {M} warnings". Gold `CheckCircle2` icon right.
2. **Sticky action bar** — `Back: Edit rules` (ghost) left, `Print schedule` (primary black, `Printer` icon) right.
3. **Legend card** — `CardHeader` "What the colours mean" + grid of color swatches + labels.
4. **Schedule grid card** — same 15-min structure as current `ScheduleGrid`. White surface, M&S borders, tighter radius, hour header uses `font-mono` on cream-tinted background. ☼ "open" indicator → small gold `Sun` icon. Store-closed hours get a muted stripe pattern (accessibility, not colour alone).
5. **Warnings card** — cream/yellow tint. `CardHeader` "{M} things to check". Each warning: hour in `font-mono` + gold `Badge` for kind + plain-English message. Translations:
   - `partial-hour` → "Only available for part of this hour"
   - `cross-dept-fallback` → "No department match — used someone from another department"
   - `understaffed` → "Not enough people for this role"
   - `specialised-missing` → "No one tagged for this specialist role"

### Print output

`@media print` rules updated:
- Hide everything except `PrintHeader` + the grid Card.
- PrintHeader redesigned: top-left "DAILY JOB SCHEDULE" in tracked caps + gold rule beneath, date + headcount right-aligned.
- Grid borders darkened to `#000`. Colour cells keep fills (colour is the primary signal on the shop floor).
- `@page { size: landscape; margin: 10mm; }` retained.
- No dark backgrounds, no rounded corners.

## Implementation phases

1. **Foundation** — install shadcn + lucide-react + dependencies; update `globals.css` with M&S palette; update `layout.tsx` fonts/metadata; install shadcn primitives (button, card, input, label, select, table, tabs, checkbox, dialog, separator, badge, tooltip, accordion, radio-group, switch).
2. **AppShell + Stepper** — new `AppShell` component, new `Stepper` component, button override for sharp edges, custom cream Alert variant.
3. **Step components** — new `src/components/steps/` directory with `UploadStep`, `ConfirmStaffStep`, `TagRolesStep`, `StaffingRulesStep`, `ScheduleStep`. Refactor existing components into these.
4. **Rewire `page.tsx`** — new Step union, sessionStorage migration, step routing.
5. **Polish & verify** — remove all emojis, replace with lucide icons; update print CSS; run `npx tsc --noEmit`; run smoke scripts (`scripts/test-extract.ts`, `scripts/test-scheduler.ts`) to confirm no regressions in the data pipeline.
