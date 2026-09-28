# Operational Readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make field capture, validation, results and Excel export internally consistent, traceable and usable without presenting partial or estimated data as definitive.

**Architecture:** Keep `StudySummary` as the sole calculations source. Add focused validation helpers for study timing and signal configuration, expose their results in existing wizard steps, and make components consume explicit row/interval state rather than inferring validity. Preserve the existing TypeScript, React and XLSX architecture; do not add a runtime dependency unless native XLSX formatting proves impossible.

**Tech Stack:** React 19, TypeScript, Vite, Vitest, Testing Library, SheetJS `xlsx`.

**Spec:** `docs/superpowers/specs/2026-09-27-operational-readiness-design.md`

## Global Constraints

- `0`, `null` and `N/A` retain their distinct meanings.
- TDPA remains an explicitly labelled estimate and never becomes observed capture.
- Dashboard and Excel derive values from one `StudySummary`.
- No aggregate intersection capacity or automatic HCM/LOS calculations.
- Preserve existing localStorage migrations and compatibility.
- Prefer existing dependencies and established component patterns.

## Review Focus

- A midnight range and a range not divisible by its interval must not corrupt saved rows.
- A large incomplete capture must expose every error and focus its field.
- Multiple contiguous signal programs must resolve at boundaries while an in-interval change disables formal capacity.
- Partial rows must never appear as final observed bars, KPIs, FHP or Excel totals.
- A legacy or TDPA study must remain visibly distinct after export and state changes.

---

## File Structure

- `src/lib/time.ts`: interval-range validation shared by UI and interval generation.
- `src/lib/calculations.ts`: signal-configuration validation and complete-only chart aggregates.
- `src/lib/types.ts`: typed validation messages and summary fields.
- `src/lib/study.ts`: program creation/removal and safe study mutation helpers.
- `src/lib/storage.ts`: catalog-backed initial state and migration compatibility.
- `src/components/WizardApp.tsx`: safe metadata feedback, catalog selection, signal controls, inline capture feedback and error navigation.
- `src/components/ResultsDashboard.tsx`: complete-only charts and partial-data presentation.
- `src/lib/exportExcel.ts`: explicit source/status labels and template-aligned export semantics.
- Existing `*.test.ts(x)`: regression coverage for every behavior above.

### Task 1: Safe timing edits

**Files:**
- Modify: `src/lib/time.ts`, `src/lib/time.test.ts`
- Modify: `src/components/WizardApp.tsx`, `src/components/WizardApp.test.tsx`

**Interfaces:**
- Produces `validateStudyPeriod(startTime: string, endTime: string, intervalMinutes: number): string | null`.
- `generateIntervals` calls the same validator before generating rows.

- [ ] Write failing tests for `07:00–07:07` at 15 minutes and `23:30–01:00` at 15 minutes.
- [ ] Run `npm.cmd test -- src/lib/time.test.ts src/components/WizardApp.test.tsx` and confirm timing rejection is uncovered.
- [ ] Implement the validator and retain prior shared metadata/rows when it reports an error; display its message in Estudio.
- [ ] Update tutorial copy for midnight ranges.
- [ ] Run targeted tests, then `npm.cmd test -- --reporter=dot`.
- [ ] Commit `fix: prevent invalid study periods`.

### Task 2: Catalog-first intersection workflow

**Files:**
- Modify: `src/lib/storage.ts`, `src/lib/storage.test.ts`
- Modify: `src/components/WizardApp.tsx`, `src/components/WizardApp.test.tsx`
- Modify: `src/components/IntersectionMap.tsx` only if a catalog/custom marker distinction needs presentation.

**Interfaces:**
- `createInitialState()` returns the 47 catalog intersections as selectable work intersections.
- Custom intersections receive a non-colliding identifier and persist beside the catalog.

- [ ] Write failing tests proving `INT-001` and `INT-047` display/select on first load and a created marker does not replace either.
- [ ] Run the targeted component/storage tests and confirm failure.
- [ ] Seed the catalog through initial state, retain catalog fields through persistence, and generate unique custom IDs after all existing map numbers.
- [ ] Run targeted tests and the full suite.
- [ ] Commit `feat: expose intersection catalog`.

### Task 3: Signal program and formal-input validation

**Files:**
- Modify: `src/lib/types.ts`, `src/lib/study.ts`, `src/lib/calculations.ts`
- Modify: `src/lib/study.test.ts`, `src/lib/signalCalculations.test.ts`, `src/lib/calculations.test.ts`
- Modify: `src/components/WizardApp.tsx`, `src/components/WizardApp.test.tsx`

**Interfaces:**
- Add `addSignalProgram(study: Study): Study` and `removeSignalProgram(study: Study, programId: string): Study`.
- Produce typed signal validation issues in `StudySummary` without invalidating observed-count validation.

- [ ] Write failing tests for two contiguous programs, overlapping programs, zero effective green and deleting a program with assigned groups.
- [ ] Run signal/study tests and confirm the new cases fail.
- [ ] Implement program add/remove, safe reassignment/removal of groups, and validation that makes formal indicators `null` for invalid inputs.
- [ ] Add Semáforo controls for program lifecycle and label `Programa observado` as an optional operational note.
- [ ] Run targeted tests and the full suite.
- [ ] Commit `feat: validate signal programs and groups`.

### Task 4: Inline capture status and complete error navigation

**Files:**
- Modify: `src/components/WizardApp.tsx`, `src/styles.css`
- Modify: `src/components/WizardApp.test.tsx`

**Interfaces:**
- Each editable capture input receives a stable `id` based on row and field.
- Validation issues link to the matching input and use `aria-invalid` plus accessible descriptive text.

- [ ] Write failing tests for a missing movement field marked invalid in Aforo and for a Validar issue that focuses it.
- [ ] Add row-status and field-error derivation from `summary.rowValidation` without duplicating calculation rules.
- [ ] Render every validation issue grouped by interval/access; replace the 30-item truncation with accessible error navigation.
- [ ] Add styles for pending/error/complete rows while preserving table scrolling and sticky headers.
- [ ] Run component tests and the full suite.
- [ ] Commit `feat: guide capture error correction`.

### Task 5: Results integrity for partial capture

**Files:**
- Modify: `src/lib/calculations.ts`, `src/lib/calculations.test.ts`
- Modify: `src/components/ResultsDashboard.tsx`, `src/components/ResultsDashboard.test.tsx`

**Interfaces:**
- `StudySummary` exposes complete-only interval, access and movement chart data, or derives them from `byInterval` while preserving existing full captured subtotals for the partial panel.

- [ ] Write failing tests proving an incomplete interval is excluded from definitive chart inputs and that partial data is labelled separately.
- [ ] Implement complete-only aggregates, preserving existing `totalMotorized` as the labelled partial total.
- [ ] Update dashboard chart/KPI presentation and retain N/D in the consolidated interval table.
- [ ] Run calculations/dashboard tests and the full suite.
- [ ] Commit `fix: separate partial results from observed charts`.

### Task 6: Export semantics and template alignment

**Files:**
- Modify: `src/lib/exportExcel.ts`, `src/lib/exportExcel.test.ts`

**Interfaces:**
- Workbook sheets continue consuming `exportStudyWorkbook(study, intersection)` and values remain calculated from `StudySummary`.

- [ ] Write failing tests for explicit capture/calculated/status labels, all validation states and absence of unknown-as-zero values.
- [ ] Implement labels and column semantics aligned to the reference ficha; preserve static shared-engine values rather than independent Excel formulas.
- [ ] Apply supported widths, merges and number formats. Use the existing library; do not add a dependency solely for colors unless functional verification proves labels insufficient.
- [ ] Run export tests, serialize/reopen the workbook, then run the full suite and build.
- [ ] Commit `fix: clarify workbook capture and result states`.

### Task 7: Full regression and delivery review

**Files:**
- Modify: affected tests only when a verified regression is found.

- [ ] Run `npm.cmd test -- --reporter=dot`, `npm.cmd run lint`, and `npm.cmd run build`.
- [ ] Inspect a generated workbook for sheet order, warnings, values and missing-value markers.
- [ ] Perform visual review of every wizard step and generated workbook when a browser/capture surface is available; record any limitation otherwise.
- [ ] Commit `test: verify operational readiness` only if verification adds test coverage.

## Self-Review

- All six design sections map to Tasks 1–6; final regression is Task 7.
- Timing, large error sets, multi-program boundaries, partial results and legacy/TDPA state each have an owning test task.
- Interfaces are limited to the existing `Study`, `StudySummary` and wizard flow; no parallel calculation engine is introduced.
- The plan does not require unsupported Excel formulas or a new dependency by default.
