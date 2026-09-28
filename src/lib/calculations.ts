import type {
  AccessConfig,
  CaptureRow,
  IntervalBlock,
  MovementKey,
  RowValidationResult,
  SignalMovementAssignment,
  SignalProgram,
  StudySummary,
} from './types';
import { intervalsAreConsecutive, isOneHourCompatible, minutesFromClock } from './time';

const movementLabels: Record<MovementKey, string> = {
  left: 'Izquierda',
  through: 'Frente',
  right: 'Derecha',
  uTurn: 'Retorno',
};

const movementKeys: MovementKey[] = ['left', 'through', 'right', 'uTurn'];
const MINUTES_PER_DAY = 24 * 60;

interface SignalCalculationInput {
  programs?: SignalProgram[];
  assignments?: SignalMovementAssignment[];
  observedSaturationFlowPerLane?: number | null;
}

interface ProgramResolution {
  program: SignalProgram | null;
  crossesProgramChange: boolean;
}

function valueOrZero(value: number | null | undefined): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function isMissing(value: number | null | undefined): value is null | undefined {
  return value === null || value === undefined;
}

function averageCaptured(values: Array<number | null | undefined>): number | null {
  const captured = values.filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
  if (captured.length === 0) return null;
  return captured.reduce((total, value) => total + value, 0) / captured.length;
}

function maxCaptured(values: Array<number | null | undefined>): number | null {
  const captured = values.filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
  return captured.length === 0 ? null : Math.max(...captured);
}

function minCaptured(values: Array<number | null | undefined>): number | null {
  const captured = values.filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
  return captured.length === 0 ? null : Math.min(...captured);
}

function combineNotes(rows: CaptureRow[]): string {
  return Array.from(new Set(rows.map((row) => row.notes.trim()).filter(Boolean))).join(' | ');
}

function durationMinutes(start: string, end: string): number {
  const startMinute = minutesFromClock(start);
  const endMinute = minutesFromClock(end);
  const duration = (endMinute - startMinute + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  return duration === 0 ? MINUTES_PER_DAY : duration;
}

function clockOffset(referenceStart: string, value: string): number {
  return (minutesFromClock(value) - minutesFromClock(referenceStart) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
}

function programContainsInterval(program: SignalProgram, start: string, end: string): boolean {
  const programDuration = durationMinutes(program.startTime, program.endTime);
  const intervalDuration = durationMinutes(start, end);
  const intervalOffset = clockOffset(program.startTime, start);
  return intervalOffset < programDuration && intervalOffset + intervalDuration <= programDuration;
}

function programAtMinute(programs: SignalProgram[], minute: number): SignalProgram | null {
  return programs.find((program) => {
    const start = minutesFromClock(program.startTime);
    const duration = durationMinutes(program.startTime, program.endTime);
    const offset = (minute - start + MINUTES_PER_DAY) % MINUTES_PER_DAY;
    return offset < duration;
  }) ?? null;
}

export function resolveProgramForInterval(
  programs: SignalProgram[],
  intervalStart: string,
  intervalEnd: string,
): ProgramResolution {
  const contained = programs.find((program) => programContainsInterval(program, intervalStart, intervalEnd));
  if (contained) return { program: contained, crossesProgramChange: false };

  const startMinute = minutesFromClock(intervalStart);
  const intervalDuration = durationMinutes(intervalStart, intervalEnd);
  const lastMinute = (startMinute + Math.max(0, intervalDuration - 1)) % MINUTES_PER_DAY;
  const startProgram = programAtMinute(programs, startMinute);
  const endProgram = programAtMinute(programs, lastMinute);
  return {
    program: null,
    crossesProgramChange: Boolean(startProgram && endProgram && startProgram.id !== endProgram.id),
  };
}

export function calculateRowMotorizedTotal(row: CaptureRow, access: AccessConfig): number {
  return movementKeys.reduce((total, key) => {
    if (!access.movements[key]) return total;
    return total + valueOrZero(row[key]);
  }, 0);
}

export function validateCaptureRowDetailed(row: CaptureRow, access: AccessConfig): RowValidationResult {
  const incompleteIssues: string[] = [];
  const errorIssues: string[] = [];

  for (const key of movementKeys) {
    if (!access.movements[key]) {
      if (row[key] !== null) errorIssues.push(`${movementLabels[key]} debe permanecer como N/A.`);
      continue;
    }

    const value = row[key];
    if (isMissing(value)) incompleteIssues.push(`Falta ${movementLabels[key].toLowerCase()}.`);
    else if (!Number.isInteger(value) || value < 0) errorIssues.push(`${movementLabels[key]} debe ser entero mayor o igual a cero.`);
  }

  for (const [label, value] of [
    ['Pesados', row.heavy],
    ['Motos', row.motorcycles],
    ['Bicicletas', row.bicycles],
    ['Peatones', row.pedestrians],
  ] as const) {
    if (isMissing(value)) incompleteIssues.push(`Falta ${label.toLowerCase()}.`);
    else if (!Number.isInteger(value) || value < 0) errorIssues.push(`${label} debe ser entero mayor o igual a cero.`);
  }

  if (
    !isMissing(row.heavy) &&
    !isMissing(row.motorcycles) &&
    valueOrZero(row.heavy) + valueOrZero(row.motorcycles) > calculateRowMotorizedTotal(row, access)
  ) {
    errorIssues.push('Pesados + motos supera el total motorizado.');
  }

  for (const [label, value] of [
    ['Cola máxima', row.maxQueue],
    ['Cola promedio', row.averageQueue],
    ['Longitud de cola', row.queueLength],
    ['Vehículos detenidos por ciclo', row.stoppedVehiclesPerCycle],
    ['Ciclo observado', row.observedCycle],
  ] as const) {
    if (!isMissing(value) && (!Number.isFinite(value) || value < 0)) errorIssues.push(`${label} debe ser mayor o igual a cero.`);
  }

  const issues = [...errorIssues, ...incompleteIssues];
  return {
    rowId: row.id,
    state: errorIssues.length > 0 ? 'error' : incompleteIssues.length > 0 ? 'incomplete' : 'complete',
    issues,
  };
}

export function validateCaptureRow(row: CaptureRow, access: AccessConfig): string[] {
  return validateCaptureRowDetailed(row, access).issues;
}

export function createEmptyCaptureRows(intervals: IntervalBlock[], accesses: AccessConfig[]): CaptureRow[] {
  return intervals.flatMap((interval) =>
    accesses.map((access) => ({
      id: `${interval.id}-${access.id}`,
      intervalId: interval.id,
      intervalLabel: interval.label,
      intervalStart: interval.start,
      intervalEnd: interval.end,
      accessId: access.id,
      accessName: access.name,
      left: null,
      through: null,
      right: null,
      uTurn: null,
      heavy: null,
      motorcycles: null,
      bicycles: null,
      pedestrians: null,
      maxQueue: null,
      averageQueue: null,
      queueLength: null,
      stoppedVehiclesPerCycle: null,
      observedCycle: null,
      observedProgram: '',
      notes: '',
    })),
  );
}

export function calculateStudySummary(
  rows: CaptureRow[],
  accesses: AccessConfig[],
  intervalMinutes: number,
  signalInput: SignalCalculationInput = {},
): StudySummary {
  const programs = signalInput.programs ?? [];
  const assignments = signalInput.assignments ?? [];
  const accessById = new Map(accesses.map((access) => [access.id, access]));
  const fallbackAccess = accesses[0];
  const rowValidation = rows.map((row) => {
    const access = accessById.get(row.accessId) ?? fallbackAccess;
    if (!access) return { rowId: row.id, state: 'error' as const, issues: ['Acceso no configurado.'] };
    return validateCaptureRowDetailed(row, access);
  });
  const issues = rowValidation.flatMap((result) => result.issues);
  const completeRows = rowValidation.filter((result) => result.state === 'complete').length;
  const incompleteRows = rowValidation.filter((result) => result.state === 'incomplete').length;
  const errorRows = rowValidation.filter((result) => result.state === 'error').length;
  const completionPercent = rows.length > 0 ? (completeRows / rows.length) * 100 : 0;
  const isComplete = rows.length > 0 && completeRows === rows.length && errorRows === 0;
  const accessForRow = (row: CaptureRow) => accessById.get(row.accessId) ?? fallbackAccess;
  const movementValueForRow = (row: CaptureRow, movement: MovementKey) => {
    const access = accessForRow(row);
    return access?.movements[movement] ? valueOrZero(row[movement]) : 0;
  };
  const totalForRow = (row: CaptureRow) => {
    const access = accessForRow(row);
    return access ? calculateRowMotorizedTotal(row, access) : 0;
  };

  const intervalRows = new Map<string, CaptureRow[]>();
  for (const row of rows) {
    const current = intervalRows.get(row.intervalId) ?? [];
    current.push(row);
    intervalRows.set(row.intervalId, current);
  }

  const rowValidationById = new Map(rowValidation.map((result) => [result.rowId, result]));
  const byInterval = Array.from(intervalRows.entries()).map(([intervalId, groupedRows]) => {
    const first = groupedRows[0];
    return {
      intervalId,
      label: first.intervalLabel,
      start: first.intervalStart,
      end: first.intervalEnd,
      left: groupedRows.reduce((total, row) => total + movementValueForRow(row, 'left'), 0),
      through: groupedRows.reduce((total, row) => total + movementValueForRow(row, 'through'), 0),
      right: groupedRows.reduce((total, row) => total + movementValueForRow(row, 'right'), 0),
      uTurn: groupedRows.reduce((total, row) => total + movementValueForRow(row, 'uTurn'), 0),
      total: groupedRows.reduce((total, row) => total + totalForRow(row), 0),
      heavy: groupedRows.reduce((total, row) => total + valueOrZero(row.heavy), 0),
      motorcycles: groupedRows.reduce((total, row) => total + valueOrZero(row.motorcycles), 0),
      bicycles: groupedRows.reduce((total, row) => total + valueOrZero(row.bicycles), 0),
      pedestrians: groupedRows.reduce((total, row) => total + valueOrZero(row.pedestrians), 0),
      notes: combineNotes(groupedRows),
      complete: groupedRows.every((row) => rowValidationById.get(row.id)?.state === 'complete'),
    };
  });

  const totalMotorized = rows.reduce((total, row) => total + totalForRow(row), 0);
  const validIntervals = byInterval.filter((item) => item.complete);
  const peakInterval = validIntervals.reduce<{ label: string; volume: number } | null>((best, item) => {
    if (!best || item.total > best.volume) return { label: item.label, volume: item.total };
    return best;
  }, null);

  const slotsPerHour = isOneHourCompatible(intervalMinutes) ? 60 / intervalMinutes : 0;
  let peakHour: StudySummary['peakHour'] = null;
  if (slotsPerHour > 0 && byInterval.length >= slotsPerHour) {
    for (let index = 0; index <= byInterval.length - slotsPerHour; index += 1) {
      const window = byInterval.slice(index, index + slotsPerHour);
      if (!window.every((item) => item.complete) || !intervalsAreConsecutive(window)) continue;

      const volume = window.reduce((total, item) => total + item.total, 0);
      const maxIntervalVolume = Math.max(...window.map((item) => item.total));
      const candidate = {
        label: `${window[0].start}-${window[window.length - 1].end}`,
        volume,
        maxIntervalVolume,
        factor: maxIntervalVolume > 0 ? volume / (slotsPerHour * maxIntervalVolume) : null,
        factorLabel: intervalMinutes === 15 ? ('FHP' as const) : ('Factor de uniformidad de hora pico' as const),
        intervalIds: window.map((item) => item.intervalId),
        tie: false,
      };
      if (!peakHour || candidate.volume > peakHour.volume) {
        peakHour = candidate;
      } else if (candidate.volume === peakHour.volume) {
        peakHour.tie = true;
      }
    }
  }

  const warnings: string[] = [];
  if (peakHour?.tie) warnings.push('Existe empate entre ventanas de hora pico; se conserva la primera.');
  const intervalProgramResolution = new Map<string, ProgramResolution>();
  for (const item of byInterval) {
    const resolution = resolveProgramForInterval(programs, item.start, item.end);
    intervalProgramResolution.set(item.intervalId, resolution);
    if (resolution.crossesProgramChange) warnings.push(`Cambio de programa dentro del intervalo ${item.label}.`);
  }

  const byAccess = accesses.map((access) => ({
    accessId: access.id,
    accessName: access.name,
    volume: rows.filter((row) => row.accessId === access.id).reduce((total, row) => total + totalForRow(row), 0),
  }));

  const byMovement = movementKeys.map((key) => {
    const volume = rows.reduce((total, row) => total + movementValueForRow(row, key), 0);
    return { movement: movementLabels[key], volume, percent: totalMotorized > 0 ? (volume / totalMotorized) * 100 : 0 };
  });

  const queueByAccess = accesses.map((access) => {
    const accessRows = rows.filter((row) => row.accessId === access.id);
    return {
      accessId: access.id,
      accessName: access.name,
      maxQueue: maxCaptured(accessRows.map((row) => row.maxQueue)),
      averageQueue: averageCaptured(accessRows.map((row) => row.averageQueue)),
      maxQueueLength: maxCaptured(accessRows.map((row) => row.queueLength)),
      stoppedVehiclesPerCycle: averageCaptured(accessRows.map((row) => row.stoppedVehiclesPerCycle)),
      notes: combineNotes(accessRows),
    };
  });

  const cycleSummaries = accesses.map((access) => {
    const observedRows = rows.filter(
      (row) => row.accessId === access.id && typeof row.observedCycle === 'number' && Number.isFinite(row.observedCycle),
    );
    const observedCycles = observedRows.map((row) => row.observedCycle);
    const programmedCycles: number[] = [];
    const differences: number[] = [];
    for (const row of observedRows) {
      const resolution = intervalProgramResolution.get(row.intervalId);
      const programmedCycle = resolution?.program?.cycleSeconds;
      if (typeof programmedCycle === 'number' && programmedCycle > 0 && typeof row.observedCycle === 'number') {
        programmedCycles.push(programmedCycle);
        differences.push(row.observedCycle - programmedCycle);
      }
    }
    return {
      accessId: access.id,
      accessName: access.name,
      averageObservedCycle: averageCaptured(observedCycles),
      minObservedCycle: minCaptured(observedCycles),
      maxObservedCycle: maxCaptured(observedCycles),
      programmedCycleSeconds: averageCaptured(programmedCycles),
      averageDifferenceSeconds: averageCaptured(differences),
    };
  });

  const peakIntervalIds = new Set(peakHour?.intervalIds ?? []);
  const signalGroupIndicators = assignments.map((assignment) => {
    const access = accessById.get(assignment.accessId);
    const program = programs.find((item) => item.id === assignment.programId);
    const phase = program?.phaseTimings.find((item) => item.id === assignment.phaseId);
    const cycleSeconds =
      typeof phase?.cycleSeconds === 'number' && phase.cycleSeconds > 0
        ? phase.cycleSeconds
        : typeof program?.cycleSeconds === 'number' && program.cycleSeconds > 0
          ? program.cycleSeconds
          : null;
    const effectiveGreenSeconds =
      typeof assignment.effectiveGreenSeconds === 'number' && assignment.effectiveGreenSeconds >= 0
        ? assignment.effectiveGreenSeconds
        : null;
    const lanes = typeof assignment.lanes === 'number' && assignment.lanes > 0 ? assignment.lanes : null;
    const saturationFlowPerLane =
      typeof assignment.saturationFlowPerLane === 'number' && assignment.saturationFlowPerLane > 0
        ? assignment.saturationFlowPerLane
        : null;
    const peakRows = rows.filter((row) => row.accessId === assignment.accessId && peakIntervalIds.has(row.intervalId));
    const hasCompleteMovementVolume =
      peakHour !== null &&
      access?.movements[assignment.movement] === true &&
      peakRows.length === peakIntervalIds.size &&
      peakRows.every((row) => typeof row[assignment.movement] === 'number' && Number.isFinite(row[assignment.movement]));
    const peakHourVolume = hasCompleteMovementVolume
      ? peakRows.reduce((total, row) => total + valueOrZero(row[assignment.movement]), 0)
      : null;
    const peakProgramsValid =
      peakHour !== null &&
      Array.from(peakIntervalIds).every((intervalId) => {
        const resolution = intervalProgramResolution.get(intervalId);
        return !resolution?.crossesProgramChange && resolution?.program?.id === assignment.programId;
      });
    const formalInputsValid =
      Boolean(access && phase && peakProgramsValid) &&
      cycleSeconds !== null &&
      effectiveGreenSeconds !== null &&
      effectiveGreenSeconds <= cycleSeconds &&
      lanes !== null &&
      saturationFlowPerLane !== null;
    const greenRatio = formalInputsValid && cycleSeconds ? effectiveGreenSeconds / cycleSeconds : null;
    const capacity =
      formalInputsValid && greenRatio !== null && saturationFlowPerLane !== null && lanes !== null
        ? saturationFlowPerLane * lanes * greenRatio
        : null;
    const volumeCapacityRatio =
      peakHourVolume !== null && capacity !== null && capacity > 0 ? peakHourVolume / capacity : null;

    return {
      assignmentId: assignment.id,
      accessId: assignment.accessId,
      accessName: access?.name ?? assignment.accessId,
      movement: assignment.movement,
      movementLabel: movementLabels[assignment.movement],
      programId: assignment.programId,
      phaseId: assignment.phaseId,
      peakHourVolume,
      saturationFlowPerLane,
      lanes,
      cycleSeconds,
      effectiveGreenSeconds,
      greenRatio,
      capacity,
      volumeCapacityRatio,
    };
  });

  const peakHourFlow = peakHour?.volume ?? null;
  const validFormalGroups = signalGroupIndicators.filter((item) => item.capacity !== null && item.volumeCapacityRatio !== null).length;

  return {
    totalMotorized,
    totalHeavy: rows.reduce((total, row) => total + valueOrZero(row.heavy), 0),
    totalMotorcycles: rows.reduce((total, row) => total + valueOrZero(row.motorcycles), 0),
    totalBicycles: rows.reduce((total, row) => total + valueOrZero(row.bicycles), 0),
    totalPedestrians: rows.reduce((total, row) => total + valueOrZero(row.pedestrians), 0),
    peakInterval,
    peakHour,
    averageIntervalVolume: byInterval.length > 0 ? totalMotorized / byInterval.length : 0,
    byInterval,
    byAccess,
    byMovement,
    queueByAccess,
    cycleSummaries,
    signalGroupIndicators,
    signalIndicators: {
      peakHourFlow,
      cycleSeconds: null,
      effectiveGreenSeconds: null,
      greenRatio: null,
      saturationFlowPerLane: null,
      capacity: null,
      volumeCapacityRatio: null,
    },
    completeRows,
    incompleteRows,
    errorRows,
    completionPercent,
    isComplete,
    isPartial: !isComplete,
    rowValidation,
    dataQuality: [
      `${completeRows}/${rows.length} filas completas (${completionPercent.toFixed(1)}%)`,
      `${incompleteRows} filas incompletas`,
      `${errorRows} filas con error`,
      `${accesses.length} accesos configurados`,
      issues.length === 0 ? 'Sin errores obligatorios' : `${issues.length} observaciones por revisar`,
      assignments.length === 0
        ? 'Capacidad y v/c: N/D; no hay grupos movimiento-fase configurados.'
        : `${validFormalGroups}/${assignments.length} grupos con capacidad y v/c formal calculables.`,
    ],
    issues,
    warnings: Array.from(new Set(warnings)),
  };
}
