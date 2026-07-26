# Persistence & Drag-and-Drop Editing — 2026-07-26

## Goal

Add two capabilities to the rota scheduler:

1. **Persistence** — managers can save rotas by name, resume the current draft across refresh/close, and move rotas between PCs via export/import files.
2. **Drag-and-drop editing** — managers can drag work blocks to swap jobs between employees/hours, and drag break blocks to move them within a person's row.

Both stay client-side. No server, no auth (per project constraint).

## Non-goals

- Cross-machine sync (ruled out by the no-server rule).
- Multi-day / week view.
- Undo/redo stack.
- Touch/mobile support (managers use work PCs with mice).
- Live library entries that track edits — library entries are immutable snapshots.

## Decisions

1. **Storage backend:** `localStorage`, single key `rota-scheduler:v2`. Payload is small; API is synchronous; no schema migration headaches. IndexedDB rejected as overkill.
2. **Draft + library model:** one autosaved `draft` plus a `library: LibraryEntry[]` of named snapshots. Loading an entry replaces the draft (with confirmation if unsaved changes exist).
3. **Migration:** on first v2 load, look for legacy `sessionStorage['rota-flow-v1']`, copy into `draft`, clear old key. One-time, wrapped in try/catch.
4. **DnD library:** native HTML5 drag-and-drop. No new dependency. Avoids @dnd-kit maintenance-mode risk; M&S context is desktop PC with mouse.
5. **Work-block swap rule:** drag block A onto block B → each block keeps its time range, jobs swap. Same-hour only (enforced by `getRuns` splitting runs at hour boundaries).
6. **Break-move rule:** break keeps its duration; the work block before the new position loses its tail; the work block after the old position grows its head backward. Cross-employee break drags rejected.
7. **Manual break moves emit `breakShifted`**; the existing break-cover post-pass runs on affected hours, emitting `understaffed` (gap with no cover) or `breakCovered` (cover auto-found) as appropriate.

## Persistence

### Storage shape

```ts
interface PersistedState {
  version: 2;
  draft: { state: FlowState; savedAt: number } | null;
  library: LibraryEntry[];
}

interface LibraryEntry {
  id: string;            // crypto.randomUUID()
  name: string;
  date: string;          // ISO yyyy-mm-dd
  savedAt: number;       // epoch ms
  state: FlowState;
}
```

### Draft autosave

- Every wizard mutation (staff edit, tag change, rule change, regenerate, manual grid edit) writes through to `draft` via a 300ms debounced effect in `page.tsx`.
- Header `AutosaveIndicator` reflects state: "Saving…", "Saved 2m ago", or "Unsaved changes" (only shown briefly between changes).
- `QuotaExceededError` → non-blocking toast: "Browser storage full — older saved rotas may need deleting."

### Library lifecycle

- **Save to library:** button enabled once `state.schedule` exists. Opens `SaveRotaDialog` with name + date fields (defaults: `Schedule {today}` and today). On confirm, snapshots current `draft.state` into a new `LibraryEntry` and writes to `library`.
- **Open library:** opens `LibraryDialog` listing entries sorted by `savedAt` desc. Each row: name, date, "saved X ago", action buttons (Load, Duplicate, Rename, Delete). Search box appears when >10 entries.
- **Load:** replaces `draft` with the entry's `state`. If draft has unsaved-since-last-load changes, show confirmation dialog first.
- **Duplicate:** copies the entry's `state` into `draft` as a new working copy; original stays in library.
- **Delete:** confirm-on-delete, removes entry from `library`.

### Export / import

- **Export:** downloads `rota-{date}-{slug(name)}.json` containing `{ version, state: FlowState }` (same shape as a library entry without id/name/savedAt).
- **Import:** hidden `<input type="file" accept=".json">`. On file selected: parse, validate `version` and required keys. If invalid → toast error, no partial load. If newer version → warning toast "saved by newer version, some data may not load" but proceed.
- Loaded import replaces `draft` (same confirmation as Load).

## Drag-and-drop

### Non-break swap

**Draggable:** any `Run` whose job is a real job or `idle`.
**Not draggable:** `break`, `off`.
**Valid drop target:** another work/idle `Run` in the same hour. Invalid targets show native "no-drop" cursor; no error toast.

**Swap mechanic:** when Alice's `9:00–9:30 tills` drops onto Bob's `9:00–10:00 fitting`:
- Alice's `9:00–9:30` slots → `fitting`.
- Bob's `9:00–10:00` slots → `tills`.

Each block keeps its time range. Cross-employee and same-employee swaps both allowed (same-employee is meaningful when one person has two distinct work blocks in an hour). Cross-hour swaps rejected.

### Break move

**Draggable:** `break` blocks.
**Drop target:** any work block in the **same row** (same employee). Cross-employee break drags rejected.

**Move mechanic:** let `D` = break duration (preserved). `S_old` = break's current start slot. `S_new` = drop slot.
- `WB_before` = the work block whose end ≥ `S_new`.
- `WA_after` = the work block whose start ≥ `S_old + D` (the work that immediately followed the break).

Then:
1. Slots `[S_new, S_new + D)` → `break`.
2. Slots `[S_old, S_old + D)` → `WA_after`'s job (it grows head backward).
3. If `WA_after` doesn't exist (break was at end of shift), those slots → `WB_before`'s job (it extends forward).

**Drop constraints:**
- Target slot must be inside a work block, not on `break`/`off`.
- `S_new + D` must not extend past shift end or into another break.
- If target work block is shorter than `D`, allow only if adjacent work can absorb spillover; otherwise reject.

**Worked example (Bob):** `fitting(9–10)`, `break(10–10:30)`, `X(10:30–11)`. Move break to `9:30`.
- `WB_before` = fitting, `WA_after` = X.
- Slots `[9:30, 10:00)` → break.
- Slots `[10:00, 10:30)` → X.
- Result: `fitting(9–9:30)`, `break(9:30–10)`, `X(10–11)`.

### Drag UX

- Drag preview: small floating chip with source job label + duration (e.g. "Tills · 30m"). Native browser drag image with custom `setDragImage`.
- Drop hover: target block ring-highlighted with `ring-accent`.
- Cursor: `cursor-grab` on draggable blocks; `cursor-no-drop` when over invalid target.

### State integration

Follows the existing `handleEditBlock` pattern (`page.tsx:203`):
- `structuredClone(state.schedule.schedule)` → mutate slots → set `scheduleManuallyEdited: true` → write back via `setState`.
- `hourlyAssignments` becomes stale on manual edits; slot-level `Schedule` is the source of truth once any manual edit lands. (Same as the existing click-to-pick behavior — `hourlyAssignments` is algorithm output, not display state.)

### Warnings

- Every manual break move → emit `breakShifted` warning.
- After swap or break move, recompute coverage for affected hours via the existing break-cover post-pass logic (refactored into a callable that takes the mutated `Schedule` + hour range).
- Emit `understaffed` for any single-head job with its sole person on break and no available cover.
- Emit `breakCovered` if cover auto-found.
- All warnings surface through the existing `ScheduleWarningKind` pipeline and render in the Schedule step's warning badge area.

## File structure

### New files

- `src/lib/storage/schema.ts` — `PersistedState`, `LibraryEntry`, `VERSION` constant.
- `src/lib/storage/storage.ts` — `loadState`, `saveDraft`, `listLibrary`, `saveToLibrary`, `deleteLibraryEntry`, `renameLibraryEntry`, `duplicateToDraft`, `exportRota`, `importRota`.
- `src/lib/storage/migrate.ts` — one-time v1 → v2 migration.
- `src/components/LibraryDialog.tsx` — Open dialog with table of entries.
- `src/components/SaveRotaDialog.tsx` — Save form (name, date).
- `src/components/AutosaveIndicator.tsx` — header status text.
- `src/lib/scheduler/swapBlock.ts` — pure functions `swapWorkBlocks(...)` and `moveBreak(...)`, plus a `recomputeCoverageForHours(...)` helper. Testable in isolation.

### Modified files

- `src/app/page.tsx` — autosave effect, library/export/import handlers, new `handleSwapBlocks` and `handleMoveBreak` next to `handleEditBlock`.
- `src/components/AppShell.tsx` — header buttons (Open, Save, Import, Export) + `AutosaveIndicator` slot.
- `src/components/ScheduleGrid.tsx` — HTML5 drag handlers per `<td>`; new props `onSwapBlocks(source, target)` and `onMoveBreak(empId, oldStart, newStart)`.
- `src/components/steps/ScheduleStep.tsx` — pass through new handlers; update `HelpBubble` text to mention drag-and-drop.

## Testing

No test runner is configured. Follow CLAUDE.md convention with smoke scripts run via `npx tsx`:

- `scripts/test-swap.ts` — construct minimal `Schedule` records, run `swapWorkBlocks` and `moveBreak` with cases including the Alice/Bob examples, assert resulting slot values match expected. Covers: cross-employee swap, same-employee swap, break-at-start (Alice), break-in-middle (Bob), break-at-end (Edge 2), rejected cross-hour drag, rejected cross-employee break drag.
- `scripts/test-storage.ts` — round-trip: build state, save draft, load, assert deep-equal. Library add/load/delete cycle. v1 → v2 migration path with a synthetic v1 payload.

## Edge cases

- **`localStorage` full:** `QuotaExceededError` caught, non-blocking toast shown, current draft kept in memory.
- **Malformed v1 payload:** try/catch swallows, starts fresh, sets `restoreFailed` flag (existing pattern).
- **Imported file from newer app version:** load with warning rather than refusing.
- **DnD on schedule that hasn't been generated yet:** DnD requires `result.schedule` to exist; ignored until then.
- **Manual edit then step-back-and-regenerate:** existing `scheduleManuallyEdited` flag prompts confirm-before-regenerate; this stays the same.
- **Browser without `crypto.randomUUID`:** fallback to `Math.random().toString(36)` + timestamp.

## Rejected alternatives

- **IndexedDB** — overkill for ~10KB payloads, async API complicates the autosave effect.
- **@dnd-kit / react-dnd** — adds dependency, maintenance risk; native HTML5 DnD is sufficient for mouse-only desktop use.
- **Live library entries that track edits** — manager-friendly mental model is "snapshot = a saved thing"; live entries blur the line between draft and saved.
- **Multi-draft (work on several rotas at once)** — added complexity for unclear value; one draft at a time matches the typical one-day-at-a-time workflow.
- **Touch support** — managers use PCs; deferred until/unless tablets become a target.
