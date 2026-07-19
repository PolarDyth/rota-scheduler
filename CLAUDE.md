# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

```bash
npm run dev       # Next.js 16 dev server (Turbopack) on :3000
npm run build     # Production build
npm run lint      # ESLint
npx tsc --noEmit  # Typecheck (no test runner configured)

# Smoke scripts (run directly via tsx, no test framework):
npx tsx scripts/test-extract.ts    # Parse Schedule Editor.pdf → verify employee extraction
npx tsx scripts/test-scheduler.ts  # Run end-to-end extract + schedule + print stats
```

`pdfjs-dist` requires `serverExternalPackages: ['pdfjs-dist']` in `next.config.ts` — don't remove it. The extractor imports the legacy build (`pdfjs-dist/legacy/build/pdf.mjs`).

A sample `Schedule Editor.pdf` lives at the repo root — use it for extraction testing.

## What this app does

Manager uploads a corporate "Schedule Editor" PDF (one day, one page). The app extracts who's working, their shifts, and their breaks. Manager walks through a 5-step wizard — confirm staff/shifts, tag specialised roles & departments, set staffing rules — then the scheduler produces an hourly job rotation displayed on a 15-min grid, printable.

Client-side wizard with `?step=upload|confirm|tag|rules|schedule`. State lives in React `useState` hydrated from `sessionStorage` (key `rota-flow-v1`). Ephemeral — no database, no auth. Legacy `?step=review` URLs migrate to `confirm` (see `migrateStep` in `page.tsx`).

## Architecture

### UI shell & wizard

- `src/lib/flow.ts` — `Step` type, `STEPS` metadata, navigation helpers (`stepIndex`, `nextStepAfter`, `prevStepAfter`, `canJumpTo`).
- `src/components/AppShell.tsx` — header (wordmark + Start over) + Stepper + main content slot.
- `src/components/Stepper.tsx` — 5 numbered stages; current is gold; completed are clickable for jump-back.
- `src/components/steps/` — one component per step (`UploadStep`, `ConfirmStaffStep`, `TagRolesStep`, `StaffingRulesStep`, `ScheduleStep`).
- `src/components/StepFooter.tsx` — Back/Continue action bar (shared across steps).
- `src/components/HelpBubble.tsx` — Popover-based "?" icon for inline explanations.

### Design system: shadcn + M&S palette

- shadcn primitives in `src/components/ui/` (base-nova preset, `@base-ui/react` primitives, `lucide-react` icons).
- `src/lib/utils.ts` exports `cn()`.
- M&S palette hardcoded as CSS variables in `:root` of `src/app/globals.css` — black primary (`#101820`), Sparks gold accent (`#a98b52`), cream secondary (`#ebe4d7`), tight `--radius: 0.25rem`. Dark theme variables exist but no toggle is wired.
- **Buttons are square**: `[data-slot="button"] { border-radius: 0 !important; }` in globals.css. Don't remove — this is a deliberate M&S packaging aesthetic.
- `TooltipProvider` wraps the app in `layout.tsx` — needed for shadcn Tooltip/Popover.
- No emojis anywhere — replace with `lucide-react` icons.

### Data model: two-level schedule

The schedule has two granularities and you need to understand both:

- **Per-hour job rotation** (`hourlyAssignments`): the algorithm assigns ONE job per employee per hour. This is where rotation/continuity decisions happen.
- **Per-slot display** (`Schedule` keyed by 15-min `Slot`): `expandToSlots` projects the hourly assignment onto 15-min slots, overlaying `'break'` and `'off'` cells, and applying **slot-level rule pruning**.

`Schedule = Record<empId, Record<slotMinutes, JobId>>` where slot is minutes-since-midnight in 15-min increments (6:00 = 360, 20:45 = 1245).

### Specialised roles & labels

Internal IDs vs UI labels (do NOT change IDs — PDF tag map and scheduler depend on them):

- `lingerie` → **Bra Fit**
- `bureau` → **Bureau**
- `vm` → **Visual Merchandising**
- `isf` → **Stock Controller**
- `tsm` → **TSM** (Team Support Manager — see "TSM reserve" below)

`ROLE_TO_JOB: Record<Exclude<SpecialisedRole, 'tsm'>, JobId>` maps the first four to their job. TSM has no job. Use `specialisedRoleLabel(role)` from `jobs.ts` for display — handles the TSM case.

### Scheduler pipeline (`src/lib/scheduler/generateSchedule.ts`)

For each hour, in order:

1. **Specialised phase** — `specialisedAssignees` Map persists across hours for continuity. TSM is skipped here (no job). Top-up sort: `specialisedPreferred` → longest shift remaining → name. Tagged people pulled from `onShift` (NOT `pool`), so their breaks don't exclude them.
2. **Priority loop** over `priorityOrder` — for each rule-active job, fill required count. TSMs excluded from `pool`; if no eligible non-TSM exists, fall back to TSMs on shift with warning "*X filled by TSM (last resort)*". Specialised jobs (`bureau`/`vm`/`isf`/`lingerie`) only emit warnings here; they're already placed.
3. **Leftover phase** — anyone unassigned in `pool` (which excludes TSMs) gets paired against rule-active general jobs by `scoreFor`.

After the main loop:

4. **Break-cover post-pass** — for each single-head placement where the primary's break overlaps the hour (a "break gap"), find a cover candidate (on shift, not on break, not on single-head or specialised job that hour). Prefer non-TSM (`preferNonReserve`). If cover found, record `BreakCover` and emit `breakCovered` warning. If not, emit understaffed warning "*X has a break gap (Y on break, no cover available)*".
5. **Slot expansion** — `expandToSlots` applies hour-job + break + cover + slot-level rule pruning. Cover assignments override the cover person's normal hour-job for the break slots only.

### Single-head jobs and break-shift

Single-head jobs (`tills`, `hosting`, `clickCollect`, `fittingMens`, `fittingWomens`) require ONE person to cover the full hour. Fill order when no full-hour-eligible person exists:

1. **Break-shift** — try moving the candidate's single overlapping break by `[-15, +15, -30, +30]` minutes (smallest first). Valid only if the shifted break stays within shift, doesn't overlap other breaks, and doesn't land in a `singleHeadLockedHours` hour for that employee. If shift succeeds, mutate `e.breaks` in place, add to `singleHeadEligible`, emit `breakShifted` warning.
2. **Partial-hour fallback** — if no shift works, place the candidate anyway; `placeHour` records a break gap (which the break-cover post-pass then tries to resolve).

`singleHeadLockedHours: Map<empId, Set<Hour>>` tracks hours where each employee has been placed on a single-head job. This prevents break-shift from moving a break BACK into an already-scheduled hour (which would silently un-cover it).

### Scoring & tiebreaks (in `orderByLeastRecent` and `scoreFor`)

Three tiers in `scoreFor`:
- `2000` — currently on this job this hour (continuity bonus, up to `maxRoleBlock`)
- `1000` — never done this job today
- `h.length - idx` — did it `idx` hours ago

Tiebreaks in `orderByLeastRecent`: score desc → fewer total jobs done today asc → hour-rotated original index. The hour-rotated index is what stops the same person losing original-order ties every hour.

### Hard rules to preserve

- **Single-head jobs fill multiple people correctly** — the `while (remaining > 0)` loop in the priority loop MUST NOT `break` after placing one person. The `eligible` filter already excludes anyone in `assignedThisHour`, so multiple people can be placed on the same single-head job in the same hour (one per iteration). A previous `if (isSingleHead(job)) break;` here was a bug that limited single-head jobs to 1 person regardless of `needed` — don't reintroduce it.
- **Cross-dept fallback** for fitting rooms: try dept-matched first, then `any`, then anyone (with warning). Last resort.
- **Specialised roles ignore breaks for placement** but **show breaks in display**.
- **`maxRoleBlock`** (default 2): excludes a person from a job via `wouldExceedMaxBlock` once their consecutive run hits the cap. Specialised exempt.
- **TSM reserve** — TSMs are never in `pool`, so they're never placed in normal flow. Only the priority-loop fallback (when no non-TSM is eligible for a job) places them, with a warning.

### ScheduleWarningKind

Warnings: `understaffed`, `unassigned`, `shortShift`, `overlap`, `breakShifted`, `breakCovered`. The UI (`ScheduleStep.tsx`) maps each to a friendly badge label via `KIND_LABEL` — update both the type union and the label map when adding a new kind.

### Staffing rules

`StaffingRule = { id, job, start, end, count }` where `count = -1` (`UNLIMITED`) means "no max" — keep filling with eligible leftover. Rules are session state, editable in `StaffingRulesStep`, with defaults in `defaultStaffingRules()`.

### Schedule grid (`src/components/ScheduleGrid.tsx`)

15-min grid; runs are split at hour boundaries (see `getRuns`) so vertical hour lines render naturally as `<td>` left borders (2px gray-500). Print-specific overrides in `@media print` of `globals.css` compact the grid to fit one A4 landscape page — page margin 0, slot width 10px, row height 16px.

### PDF extraction (`src/lib/pdf/extractRota.ts`)

Coordinate-based parsing via `pdfjs-dist`'s `getTextContent()`. Algorithm:
1. Find hour header row (most HH:MM tokens at one Y)
2. Find footer (`'Required'` text)
3. Cluster items by Y with consecutive-diff tolerance 5
4. Per cluster: name (x < 60), shift pattern (longest range = shift, rest = breaks), cell tags via `lookupTag`

`lookupTag` in `tagMap.ts` maps PDF tokens like `'C&H Salesfloor'` (dept hint), `'BB'`/`'B'` (ignore), `'Stock Co…'` (truncated → `isf`), `'TSM'`/`'Team Support Manager'` → `tsm`.

### Next.js 16 specifics

- Server Action (`'use server'`) for PDF upload in `src/app/actions/uploadPdf.ts`
- All interactive components are `'use client'`
- `useSearchParams` requires Suspense boundary (page.tsx wraps in `<Suspense>`)
- `useActionState` (not `useFormState`) from `react`
- `params`/`searchParams` are async — but we don't read them server-side here
