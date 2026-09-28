# Executive UI and Study Isolation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver independent configuration for each new study, remove the autosave indicator, modernize the application UI with a navy/gray/white executive visual system, and upgrade the Excel workbook presentation without changing traffic calculations or data semantics.

**Architecture:** Keep the existing React/TypeScript/Vite/Electron architecture and `StudySummary` as the only calculation source. Functional isolation is implemented in the existing study creation flow, while visual changes remain primarily CSS-driven to avoid unnecessary component restructuring. Excel presentation remains within the current SheetJS `xlsx` capability set; no new dependency is introduced without explicit approval.

**Tech Stack:** React 19, TypeScript 5.9, Vite, Vitest, Testing Library, Leaflet, Recharts, SheetJS `xlsx` 0.18.5, Electron 38.

**Spec:** `docs/superpowers/specs/2026-09-28-executive-ui-study-isolation-design.md`

## Global Constraints

- New studies must never consume `state.lastConfiguration` or another study's configuration.
- Existing studies must reopen with their own persisted `configurationSnapshot`.
- Existing persisted fields remain readable for backward compatibility; no destructive localStorage migration.
- Removing `Guardado automáticamente` is visual only; autosave/persistence remains active.
- The visual identity is navy blue, gray and white, with green/amber/red reserved for semantic states.
- Do not add a UI library.
- Do not add an Excel styling dependency without stopping for approval.
- Do not change traffic calculations, TDPA semantics, signal calculations, `0`/`null`/`N/A`/`N/D`, or partial-result integrity.
- Do not modify GitHub Actions unless a verified technical need appears.
- Each implementation block is one commit and is reviewed before the next block begins.

## Review Focus

- Create a configured first intersection, then create a second: the second must start from defaults and the first must reopen unchanged.
- Legacy storage containing `lastConfiguration` must still load, but that value must not seed a new study.
- Narrow desktop windows must retain usable navigation, tables and forms without clipped primary actions.
- Incomplete/TDPA/legacy Excel exports must preserve warnings and `N/D` while gaining executive presentation.
- Visual changes must not remove accessible focus, `aria-invalid`, exact error navigation, sticky capture headers or map interaction.

---

### Task 1: Isolate configuration for every new study

**Files:**
- Modify: `src/components/WizardApp.tsx`
- Modify: `src/components/WizardApp.test.tsx`

**Interfaces:**
- Consumes: `createDefaultStudy(intersectionId, studyTemplate)` and existing `studiesByIntersection` persistence.
- Produces: `buildStudyForIntersection(intersection)` that reopens an existing study as-is but always creates a new study from defaults when none exists.

- [ ] **Step 1: Write failing tests for configuration isolation**

Add component tests that:
- configure the first created intersection with a non-default movement/program setting;
- create/select a second new intersection and assert the prior configuration is absent;
- return to the first intersection and assert its own configuration is preserved;
- seed state with a legacy `lastConfiguration`, create a new intersection, and assert it is ignored.

- [ ] **Step 2: Run targeted tests and confirm RED**

Run: `npm test -- src/components/WizardApp.test.tsx`

Expected: new isolation test fails because the second study currently consumes `state.lastConfiguration`.

- [ ] **Step 3: Remove cross-study inheritance in `buildStudyForIntersection`**

Implementation rule:
- if `studiesByIntersection[intersection.id]` exists, reopen it with its own `configurationSnapshot`;
- otherwise call `createDefaultStudy(intersection.id, studyTemplate)` and rebuild rows;
- do not use `state.lastConfiguration` or another intersection config as a fallback for a brand-new study.

- [ ] **Step 4: Run targeted and full tests**

Run:
- `npm test -- src/components/WizardApp.test.tsx`
- `npm test`

Expected: all tests pass.

- [ ] **Step 5: Commit**

Commit message: `fix: aislar configuración de cada estudio`

Stop for user review before Task 2.

---

### Task 2: Remove autosave indicator and establish the global executive visual system

**Files:**
- Modify: `src/components/WizardApp.tsx`
- Modify: `src/components/WizardApp.test.tsx`
- Modify: `src/styles.css`

**Interfaces:**
- Consumes: existing wizard markup and autosave `persist()` behavior.
- Produces: unchanged persistence behavior plus a navy/gray/white global visual system.

- [ ] **Step 1: Write failing UI behavior tests**

Add/adjust tests to assert:
- `Guardado automáticamente` is no longer rendered;
- the application title and step navigation remain present;
- existing keyboard/error-navigation behavior remains intact.

- [ ] **Step 2: Run targeted tests and confirm RED**

Run: `npm test -- src/components/WizardApp.test.tsx`

Expected: test fails while the status pill still renders.

- [ ] **Step 3: Remove the header autosave status element only**

Delete the visual status pill and the now-unused `Save` icon import. Do not change `persist()`, `saveStoredState()` or localStorage behavior.

- [ ] **Step 4: Introduce CSS design tokens and restyle global primitives**

In `src/styles.css`, define reusable variables for:
- navy primary/action colors;
- gray text/borders/surfaces;
- white primary surfaces;
- semantic success/warning/error colors;
- common radius, shadow and focus-ring values.

Apply them to body, topbar, stepper, buttons, inputs/selects, panels/cards, forms, tables, modal, badges, validation states and footer navigation. Preserve existing class names where practical to avoid markup churn.

- [ ] **Step 5: Add responsive rules for medium/narrow desktop widths**

Ensure:
- stepper can wrap/scroll without hiding steps;
- two-column layouts collapse appropriately;
- primary actions remain visible;
- forms use responsive grids;
- capture tables keep horizontal/vertical scrolling and sticky headers.

- [ ] **Step 6: Verify**

Run:
- `npm test -- src/components/WizardApp.test.tsx`
- `npm run lint`
- `npm run build`

Expected: all pass; only the known Vite chunk-size warning may remain.

- [ ] **Step 7: Commit**

Commit message: `feat: renovar sistema visual ejecutivo`

Stop for user review before Task 3.

---

### Task 3: Apply the visual system to results and map experience

**Files:**
- Modify: `src/components/ResultsDashboard.tsx`
- Modify: `src/components/ResultsDashboard.test.tsx`
- Modify: `src/components/IntersectionMap.tsx`
- Modify: `src/styles.css`

**Interfaces:**
- Consumes: existing `StudySummary`, existing Leaflet interaction and Task 2 CSS tokens.
- Produces: executive dashboard/map presentation without calculation or interaction changes.

- [ ] **Step 1: Add regression assertions for semantic structure**

Tests must continue proving:
- partial results withhold definitive charts;
- TDPA remains visually/seman­tically separate from observed data;
- signal-group indicators remain unchanged;
- map selection/click workflow remains available through existing component behavior.

Avoid tests tied to literal hex colors.

- [ ] **Step 2: Refine dashboard markup only where hierarchy requires it**

Use semantic wrapper classes for:
- KPI header/summary;
- chart cards;
- warning/empty states;
- signal indicator section.

Do not change values, chart datasets or `StudySummary` consumption.

- [ ] **Step 3: Harmonize map presentation**

Keep Leaflet behavior unchanged while aligning:
- map frame/borders/shadow;
- numbered marker colors to the navy/gray/semantic palette;
- selected marker emphasis;
- side-panel spacing and interaction hierarchy.

- [ ] **Step 4: Complete responsive/result styles**

In `src/styles.css`, ensure KPI grids, chart grids, map layout and result tables scale cleanly across desktop widths.

- [ ] **Step 5: Verify**

Run:
- `npm test -- src/components/ResultsDashboard.test.tsx src/components/WizardApp.test.tsx`
- `npm test`
- `npm run lint`
- `npm run build`

Expected: all pass.

- [ ] **Step 6: Commit**

Commit message: `feat: mejorar experiencia de mapa y resultados`

Stop for user review before Task 4.

---

### Task 4: Upgrade Excel workbook to executive presentation

**Files:**
- Modify: `src/lib/exportExcel.ts`
- Modify: `src/lib/exportExcel.test.ts`

**Interfaces:**
- Consumes: `exportStudyWorkbook(study, intersection)` and shared `StudySummary` values.
- Produces: same seven-sheet workbook and same values/status semantics with improved layout metadata supported by current SheetJS.

- [ ] **Step 1: Write failing presentation tests**

Add tests that verify, where supported by current SheetJS:
- all seven sheet names and order remain unchanged;
- executive title/section rows are present;
- key sheets have deliberate column widths;
- merged title/section cells exist where expected;
- numeric formats remain assigned to percent/ratio fields;
- workbook serializes and reopens without changing `0`, `N/D`, Capturado/Calculado/Estimado or warning semantics.

If freeze panes or print settings are not preserved by the current library, do not simulate them; document the limitation instead of adding a dependency.

- [ ] **Step 2: Run export tests and confirm RED**

Run: `npm test -- src/lib/exportExcel.test.ts`

Expected: new presentation assertions fail before formatting improvements.

- [ ] **Step 3: Add shared executive sheet helpers**

Keep helper scope inside `exportExcel.ts` and reuse it across sheets for:
- widths;
- merges;
- number formats;
- title/section layout;
- optional supported worksheet metadata.

Do not introduce formulas or an alternate calculation path.

- [ ] **Step 4: Apply executive layout to all seven sheets**

Priority order:
1. `01_FICHA_TECNICA`
2. `02_DASHBOARD`
3. `03_AFORO_DETALLADO`
4. `04_PROGRAMACION`
5. `05_COLAS_OPERACION`
6. `06_INDICADORES`
7. `07_INSTRUCTIVO`

Preserve all current status/source labels and warnings.

- [ ] **Step 5: Serialize, reopen and verify values**

Run: `npm test -- src/lib/exportExcel.test.ts`

Expected: all export tests pass after XLSX write/read round trip.

- [ ] **Step 6: Run full verification**

Run:
- `npm test`
- `npm run lint`
- `npm run build`

Expected: all pass.

- [ ] **Step 7: Commit**

Commit message: `feat: presentar Excel con formato ejecutivo`

Stop for user review before Task 5.

---

### Task 5: Final regression and delivery review

**Files:**
- Modify tests only if a verified regression requires coverage.

**Interfaces:**
- Consumes: Tasks 1–4.
- Produces: verified release candidate branch; no production change unless a real regression is found.

- [ ] **Step 1: Run complete automated verification**

Run:
- `npm test -- --reporter=dot`
- `npm run lint`
- `npm run build`

Expected: zero failures.

- [ ] **Step 2: Review branch diff against the spec**

Verify:
- no new dependency;
- no calculation changes;
- no GitHub Actions changes;
- `lastConfiguration` is not used to seed a new study;
- `Guardado automáticamente` is absent;
- Excel still contains seven sheets and source/status semantics.

- [ ] **Step 3: Manual visual checklist for user review**

Ask the user to verify locally:
- all eight wizard steps at normal and narrower window widths;
- map marker selection and new-intersection creation;
- incomplete/error/complete capture row states and error focus;
- Results/TDPA/signal panels;
- generated workbook in desktop Excel, especially title hierarchy, widths, readability and warnings.

- [ ] **Step 4: Commit only if regression coverage was added**

Commit message if needed: `test: verificar rediseño ejecutivo y aislamiento`

Otherwise create no artificial commit.

## Self-Review

- Spec coverage: all four requested changes map to Tasks 1–4; compatibility and regression requirements map to Task 5.
- Task size: every implementation task changes 2–4 files, within the agreed 3–5 file preference except the smaller focused tasks.
- Type/interface consistency: no new public domain types are required by the current design.
- Calculation isolation: no task modifies `calculations.ts` or traffic formulas.
- Dependency constraint: Task 4 explicitly stops rather than adding a styling library if SheetJS 0.18.5 cannot preserve a desired workbook feature.
- Workflow constraint: each task is one commit and requires user review before the next task.
