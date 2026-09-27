# Integridad de Cálculo y Resultados — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corregir la semántica de captura, validación, TDPA y análisis semafórico para que la aplicación sólo presente como definitivos resultados sustentados por datos completos y técnicamente suficientes.

**Architecture:** El motor de dominio seguirá centralizado en `src/lib`: `calculations.ts` será la fuente única de verdad de agregaciones observadas y análisis semafórico; `roadTrafficImport.ts` producirá únicamente estimaciones TDPA separadas; `time.ts` resolverá continuidad temporal y medianoche. UI, dashboard y Excel consumirán esos resultados sin fórmulas paralelas. La persistencia migrará de forma no destructiva a un nuevo esquema y marcará los estudios heredados como no verificados.

**Tech Stack:** TypeScript, React, Vite, Electron, Vitest, Testing Library, Recharts, SheetJS/xlsx, localStorage.

**Spec:** `docs/superpowers/specs/2026-09-27-calculation-integrity-design.md`

## Global Constraints

- TDD obligatorio: cada cambio de comportamiento inicia con una prueba roja observada.
- `0` = observado en cero; `null` = no capturado; movimiento deshabilitado = N/A por configuración.
- Dashboard y Excel consumen el mismo resultado del motor; no duplicar fórmulas.
- TDPA es estimación y nunca sustituye un aforo observado.
- Capacidad/v/c sólo se calculan por movimiento/grupo de carriles con asignación movimiento-fase e insumos completos.
- No calcular nivel de servicio, demora, coordinación ni simulación.
- Migración de datos existentes no destructiva.
- Acciones que regeneren captura existente requieren confirmación o preservación de filas compatibles.
- Antes de integrar: `npm test`, `npm run lint`, `npm run build` deben terminar en verde.

## File Structure

- `src/lib/types.ts`: tipos de fuente del estudio, estados de fila/estudio, asignaciones movimiento-fase y resultados semafóricos/TDPA.
- `src/lib/time.ts`: intervalos, continuidad sobre medianoche y resolución horaria base.
- `src/lib/calculations.ts`: validación de filas, completitud, agregaciones observadas, hora pico/FHP, ciclos y capacidad por grupo.
- `src/lib/study.ts`: defaults técnicamente neutros, creación/reconstrucción y preservación de filas compatibles.
- `src/lib/roadTrafficImport.ts`: parsing y estimaciones TDPA sin fabricar captura observada.
- `src/lib/storage.ts`: migración versionada y marca `legacyUnverified`.
- `src/components/WizardApp.tsx`: confirmaciones destructivas, estado/validación y separación visual observado/estimado.
- `src/components/ResultsDashboard.tsx`: resultados observados, ciclos, grupos semafóricos y panel TDPA separado.
- `src/lib/exportExcel.ts`: mismo resultado del motor, advertencias de borrador y secciones separadas.
- Tests existentes homónimos + nuevos tests de integración donde corresponda.

## Review Focus

1. Una fila parcialmente capturada nunca debe producir hora pico/FHP definitivo.
2. Un `0` histórico migrado no puede asumirse automáticamente como cero observado verificado.
3. Cambiar horario/configuración con datos existentes no puede borrar captura silenciosamente.
4. Un programa que cambia dentro de un intervalo debe invalidar el análisis semafórico formal de ese intervalo.
5. TDPA no puede crear giros, peatones, bicicletas, FHP ni distribución de 15 minutos observada.

---

### Task 1: Semántica de captura y calidad por fila

**Files:**
- Modify: `src/lib/types.ts`
- Modify: `src/lib/calculations.ts`
- Modify: `src/lib/study.ts`
- Test: `src/lib/calculations.test.ts`
- Test: `src/lib/study.test.ts`

**Interfaces:**
- Produces: `RowValidationResult`, estado `complete | incomplete | error`, métricas de completitud en `StudySummary`.
- Consumes: `CaptureRow`, `AccessConfig` existentes.

- [ ] **Step 1: Write failing tests** que prueben: filas nuevas con campos observables `null`; cero explícito válido; N/A excluido; filas completas contadas fila por fila; subtotal parcial no marcado como total definitivo.
- [ ] **Step 2: Run RED**: `npm test -- src/lib/calculations.test.ts src/lib/study.test.ts` y confirmar fallos por comportamiento actual.
- [ ] **Step 3: Implement** validación por fila y `createEmptyCaptureRows()` con `null` para todo dato observable aplicable; añadir a `StudySummary` conteos `completeRows`, `incompleteRows`, `errorRows`, `completionPercent`, `isComplete`.
- [ ] **Step 4: Run GREEN**: mismo comando, todas las pruebas pasan.
- [ ] **Step 5: Commit**: `fix: preserve missing capture semantics`.

### Task 2: Intervalos completos, hora pico, FHP, empates y medianoche

**Files:**
- Modify: `src/lib/time.ts`
- Modify: `src/lib/calculations.ts`
- Test: `src/lib/time.test.ts`
- Test: `src/lib/calculations.test.ts`

**Interfaces:**
- Consumes: estado de completitud de Task 1.
- Produces: ventanas horarias sólo con intervalos completos; `peakHour.tie`/advertencia equivalente; intervalos cruzando medianoche.

- [ ] **Step 1: Write failing tests** para: intervalo incompleto excluido de hora pico; FHP conocido de 15 min; factor con 10/20/30 min; empate conserva primera ventana y avisa; `23:30→01:00` genera seis bloques de 15 min.
- [ ] **Step 2: Run RED**: `npm test -- src/lib/time.test.ts src/lib/calculations.test.ts`.
- [ ] **Step 3: Implement** continuidad temporal de 24 h y ventanas móviles que sólo acepten intervalos completos/consecutivos; registrar empate sin cambiar la primera ventana.
- [ ] **Step 4: Run GREEN**: mismo comando.
- [ ] **Step 5: Commit**: `fix: require complete peak-hour windows`.

### Task 3: Defaults neutros y preservación de captura ante cambios

**Files:**
- Modify: `src/lib/study.ts`
- Modify: `src/components/WizardApp.tsx`
- Test: `src/lib/study.test.ts`
- Test: `src/components/WizardApp.test.tsx`

**Interfaces:**
- Produces: configuración semafórica nueva con tiempos `null`; función de reconstrucción que preserva filas compatibles por `intervalId + accessId`.
- Consumes: intervalos de Task 2 y semántica de Task 1.

- [ ] **Step 1: Write failing tests** para: nueva intersección no trae ciclo/verde/rojo/fases medidos; cambio de horario/configuración con captura requiere confirmación; al confirmar se preservan filas compatibles y sólo se crean/eliminan las necesarias.
- [ ] **Step 2: Run RED**: `npm test -- src/lib/study.test.ts src/components/WizardApp.test.tsx`.
- [ ] **Step 3: Implement** defaults técnicos `null`, helper `rebuildStudyRowsPreservingCapture(study)` y confirmaciones UI antes de cambios destructivos.
- [ ] **Step 4: Run GREEN**: mismo comando.
- [ ] **Step 5: Commit**: `fix: protect captured study data`.

### Task 4: Modelo semafórico por movimiento/fase y ciclos observados

**Files:**
- Modify: `src/lib/types.ts`
- Modify: `src/lib/calculations.ts`
- Modify: `src/lib/study.ts`
- Modify: `src/components/WizardApp.tsx`
- Test: `src/lib/calculations.test.ts`
- Test: `src/components/WizardApp.test.tsx`

**Interfaces:**
- Produces: `SignalMovementAssignment { accessId, movement, phaseId, lanes, saturationFlowPerLane, effectiveGreenSeconds }`; resumen de ciclos observado/promedio/mín/máx/diferencia; resolución de programa por intervalo.
- Consumes: `SignalProgram`, `SignalPhaseTiming`, `CaptureRow`.

- [ ] **Step 1: Write failing tests** para: verde programado no se usa como efectivo; g/C=N/D sin verde efectivo; ciclos observados calculan promedio/mín/máx/diferencia; cambio de programa en límite se resuelve; cambio dentro del intervalo genera advertencia y no produce cálculo formal.
- [ ] **Step 2: Run RED**: `npm test -- src/lib/calculations.test.ts src/components/WizardApp.test.tsx`.
- [ ] **Step 3: Implement** tipos/asignaciones y UI mínima para relacionar acceso+movimiento+fase, carriles, saturación y verde efectivo; resolver programa aplicable con continuidad temporal.
- [ ] **Step 4: Run GREEN**: mismo comando.
- [ ] **Step 5: Commit**: `feat: model signal movement assignments`.

### Task 5: Capacidad y v/c formales por grupo de carriles

**Files:**
- Modify: `src/lib/types.ts`
- Modify: `src/lib/calculations.ts`
- Test: `src/lib/calculations.test.ts`

**Interfaces:**
- Consumes: `SignalMovementAssignment` de Task 4 y hora pico válida de Task 2.
- Produces: `signalGroupIndicators[]` con volumen, saturación, carriles, ciclo, verde efectivo, g/C, capacidad y v/c; valores `null` si falta cualquier insumo.

- [ ] **Step 1: Write failing tests** para: sin asignación completa capacidad/v/c=N/D; `s=1800`, `N=2`, `g=40`, `C=90` produce `1600 veh/h`; `v=520` produce `v/c=0.325`; no existe capacidad agregada de toda la intersección.
- [ ] **Step 2: Run RED**: `npm test -- src/lib/calculations.test.ts`.
- [ ] **Step 3: Implement** `c_i = s_i × N_i × (g_i/C)` y `X_i = v_i/c_i` exclusivamente por grupo, usando volumen del movimiento de la hora pico válida.
- [ ] **Step 4: Run GREEN**: mismo comando.
- [ ] **Step 5: Commit**: `fix: calculate capacity per signal lane group`.

### Task 6: TDPA como estimación separada

**Files:**
- Modify: `src/lib/types.ts`
- Modify: `src/lib/roadTrafficImport.ts`
- Modify: `src/components/WizardApp.tsx`
- Test: `src/lib/roadTrafficImport.test.ts`
- Test: `src/components/WizardApp.test.tsx`

**Interfaces:**
- Produces: `Study.source: 'observed' | 'estimated_tdpa'`; estructura `TdpaEstimate` con TDPA, K', D, hora diseño, direcciones y composición estimada.
- Consumes: `RoadTrafficRecord` existente.

- [ ] **Step 1: Write failing tests** para: `TDPA × K'` y D reproducen caso conocido; importación no modifica filas de aforo ni crea giros/peatones/bicis/FHP; estudio TDPA queda etiquetado permanentemente como estimación.
- [ ] **Step 2: Run RED**: `npm test -- src/lib/roadTrafficImport.test.ts src/components/WizardApp.test.tsx`.
- [ ] **Step 3: Implement** importación que adjunta `TdpaEstimate` a la intersección/estudio sin fabricar intervalos; eliminar reparto uniforme y flujo Norte/Sur artificial.
- [ ] **Step 4: Run GREEN**: mismo comando.
- [ ] **Step 5: Commit**: `fix: separate tdpa estimates from observed counts`.

### Task 7: Estados del estudio, validación y migración no destructiva

**Files:**
- Modify: `src/lib/types.ts`
- Modify: `src/lib/storage.ts`
- Modify: `src/components/WizardApp.tsx`
- Test: `src/lib/storage.test.ts`
- Test: `src/components/WizardApp.test.tsx`

**Interfaces:**
- Produces: estado `draft | incomplete | validated | exported`; `legacyUnverified`; schema de storage incrementado y migrador v1→v2.
- Consumes: completitud de Task 1.

- [ ] **Step 1: Write failing tests** para: estudios v1 migran sin perder filas; ceros históricos quedan `legacyUnverified`; verde programado heredado no crea verde efectivo; incompleto no puede validarse; exportar no convierte automáticamente a validado.
- [ ] **Step 2: Run RED**: `npm test -- src/lib/storage.test.ts src/components/WizardApp.test.tsx`.
- [ ] **Step 3: Implement** schema v2 y derivación explícita de estado; UI de revisión legado y acción de validar sólo cuando `summary.isComplete && summary.errorRows===0`.
- [ ] **Step 4: Run GREEN**: mismo comando.
- [ ] **Step 5: Commit**: `feat: migrate study integrity state`.

### Task 8: Dashboard y Excel con una sola fuente de verdad

**Files:**
- Modify: `src/components/ResultsDashboard.tsx`
- Modify: `src/lib/exportExcel.ts`
- Test: `src/lib/exportExcel.test.ts`
- Test: `src/components/WizardApp.test.tsx`

**Interfaces:**
- Consumes: `StudySummary.signalGroupIndicators`, ciclos, completitud, estado y `TdpaEstimate` de Tasks 1–7.
- Produces: representación consistente en UI/XLSX sin fórmulas duplicadas.

- [ ] **Step 1: Write failing tests** para: dashboard distingue total observado vs parcial; capacidad/v/c N/D sin insumos; tabla de ciclos; tabla por grupo válida; panel TDPA separado; Excel de incompleto contiene advertencia exacta; desconocidos exportan N/D, nunca cero inventado; indicadores Excel = motor.
- [ ] **Step 2: Run RED**: `npm test -- src/lib/exportExcel.test.ts src/components/WizardApp.test.tsx`.
- [ ] **Step 3: Implement** secciones del dashboard y workbook consumiendo exclusivamente `calculateStudySummary()`/estimación TDPA; no recalcular fórmulas en componentes/exportador.
- [ ] **Step 4: Run GREEN**: mismo comando.
- [ ] **Step 5: Commit**: `feat: align dashboard and excel with validated results`.

### Task 9: Regresión integral y criterios de aceptación

**Files:**
- Modify/Test as needed: tests existentes de `src/lib/*` y `src/components/*`
- Modify: `docs/superpowers/specs/2026-09-27-calculation-integrity-design.md` sólo si una decisión de implementación debe quedar documentada sin cambiar alcance.

**Interfaces:**
- Consumes: todos los contratos anteriores.
- Produces: evidencia de aceptación de los 25 casos de la especificación.

- [ ] **Step 1: Add/complete acceptance tests** que cubran explícitamente los 25 casos de §19 de la spec, incluyendo Review Focus.
- [ ] **Step 2: Run full tests**: `npm test`; Expected: todo verde, sin tests omitidos relevantes.
- [ ] **Step 3: Run lint**: `npm run lint`; Expected: exit 0.
- [ ] **Step 4: Run build**: `npm run build`; Expected: TypeScript + Vite + Electron build exitosos.
- [ ] **Step 5: Review diff** contra `main` para confirmar que no hay fórmulas paralelas, defaults ficticios ni borrados silenciosos.
- [ ] **Step 6: Commit final if needed**: `test: cover calculation integrity acceptance cases`.

## Completion Gate

No integrar a `main` hasta que:

1. los 25 criterios de aceptación estén cubiertos;
2. `npm test` termine verde;
3. `npm run lint` termine verde;
4. `npm run build` termine verde;
5. la revisión final no encuentre capacidad agregada antigua, TDPA convertido a aforo observado, ni inicialización de campos observables en cero;
6. cualquier hallazgo Critical/Important de la revisión final tenga prueba RED→GREEN antes de cerrar.
