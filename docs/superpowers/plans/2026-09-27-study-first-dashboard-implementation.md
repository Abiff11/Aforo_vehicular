# Study-first Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make study metadata the first persistent shared step, preserve full studies per intersection, add safe clearing actions, and expand Results into the Excel-aligned dashboard.

**Architecture:** Extend `StoredState` with backward-compatible optional shared metadata and per-intersection study storage. Keep `activeStudy` as the selected working copy, synchronize it through focused helpers in `WizardApp`, and render the expanded dashboard from the existing `StudySummary` calculations using Recharts.

**Tech Stack:** React 19, TypeScript, Vitest/Testing Library, Recharts, localStorage, Vite/Electron.

**Spec:** `docs/superpowers/specs/2026-09-27-study-first-dashboard-design.md`

## Global Constraints

- Wizard order must be Estudio → Interseccion → Configuracion → Semaforo → Aforo → Validar → Resultados → Exportar.
- Preserve existing calculation formulas and Excel export formulas.
- Keep old localStorage payloads loadable.
- No new runtime dependency.
- Clearing one intersection must never clear other intersections or shared study metadata.
- Full study reset must clear all persisted application memory after confirmation.

## Review Focus

- Switching from intersection A to B and back restores A's aforo rows and configuration.
- Updating shared metadata before creating intersections preloads that metadata into every new study.
- Clearing one intersection leaves another intersection and its saved study untouched.
- Full reset removes the localStorage payload and returns to an empty map/initial metadata.
- Dashboard handles empty/N-D signal values without chart or render failures.

---

### Task 1: Persist shared metadata and studies per intersection

**Files:**
- Modify: `src/lib/types.ts`
- Modify: `src/lib/storage.ts`
- Modify: `src/lib/study.ts`
- Test: `src/lib/storage.test.ts`
- Test: `src/lib/study.test.ts`

**Interfaces:**
- Produces: `StoredState.studyTemplate?: StudyMetadata`, `StoredState.studiesByIntersection?: Record<string, Study>`, `createDefaultStudyMetadata()`, and `createDefaultStudy(intersectionId, metadata?)`.

- [ ] Write failing tests for default shared metadata, backward-compatible load and creating a study from supplied metadata.
- [ ] Run targeted tests and confirm they fail because the new fields/helpers do not exist.
- [ ] Implement the minimal type/storage/study changes.
- [ ] Run targeted tests and full `npm test`.

### Task 2: Reorder wizard and preserve studies while switching intersections

**Files:**
- Modify: `src/data/tutorial.ts`
- Modify: `src/components/WizardApp.tsx`
- Test: `src/components/WizardApp.test.tsx`

**Interfaces:**
- Consumes: `studyTemplate`, `studiesByIntersection`, `createDefaultStudy(..., metadata)`.
- Produces: first-step metadata editing that persists to shared memory; intersection switch restores saved study.

- [ ] Write failing UI tests for new step order, editing metadata before a marker, and restoring an intersection's captured/configured data after switching away and back.
- [ ] Run the WizardApp tests and verify RED.
- [ ] Implement minimal synchronization helpers and render-step remapping.
- [ ] Run WizardApp tests and full `npm test`.

### Task 3: Add two-level clearing

**Files:**
- Modify: `src/components/WizardApp.tsx`
- Test: `src/components/WizardApp.test.tsx`

**Interfaces:**
- Produces: `Limpiar campos` on the active intersection and `Limpiar estudio` on the Estudio step.

- [ ] Write failing tests proving single-intersection clear preserves shared metadata/other intersections and full reset clears storage and markers.
- [ ] Verify RED.
- [ ] Implement confirmation-backed clear handlers.
- [ ] Verify targeted and full tests GREEN.

### Task 4: Expand Results dashboard

**Files:**
- Create: `src/components/ResultsDashboard.tsx`
- Modify: `src/components/WizardApp.tsx`
- Modify: `src/styles.css`
- Test: `src/components/WizardApp.test.tsx`

**Interfaces:**
- Consumes: `StudySummary`, `Study.metadata.intervalMinutes`.
- Produces: Excel-aligned KPI, charts, interval table, queue table and signal indicators table.

- [ ] Write failing UI assertions for the three chart headings and the three detailed table sections.
- [ ] Verify RED.
- [ ] Implement `ResultsDashboard` with existing `recharts` and existing summary data only.
- [ ] Add responsive dashboard styles.
- [ ] Verify targeted and full tests GREEN.

### Task 5: Final verification

**Files:**
- Review all changed files.

- [ ] Run `npm test` and require zero failures.
- [ ] Run `npm run lint` and require zero errors.
- [ ] Run `npm run build` and require successful TypeScript/Vite/Electron build.
- [ ] Review the branch diff against the spec for unintended changes.
- [ ] Fast-forward `main` only after the three verification gates pass.
