import type {
  AccessConfig,
  CaptureRow,
  IntervalBlock,
  MovementKey,
  RowValidationResult,
  SignalProgram,
  StudySummary,
} from './types';
import { isOneHourCompatible } from './time';

const movementLabels: Record<MovementKey, string> = {
  left: 'Izquierda',
  through: 'Frente',
  right: 'Derecha',
  uTurn: 'Retorno',
};

const movementKeys: MovementKey[] = ['left', 'through', 'right', 'uTurn'];

interface SignalCalculationInput {
  programs?: SignalProgram[];
  observedSaturationFlowPerLane?: number | null;
}

function valueOrZero(value: number | null | undefined): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function isMissing(value: number | null | undefined): value is null | undefined {
  return value === null || value === undefined;
}

function averageCaptured(values: Array<number | null | undefined>): number | null {
  const captured = values.filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
  if (captured.length === 0) {
    return null;
  }

  return captured.reduce((total, value) => total + value, 0) / captured.length;
}

function maxCaptured(values: Array<number | null | undefined>): number | null {
  const captured = values.filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
  return captured.length === 0 ? null : Math.max(...captured);
}

function combineNotes(rows: CaptureRow[]): string {
  return Array.from(new Set(rows.map((row) => row.notes.trim()).filter(Boolean))).join(' | ');
}

export function calculateRowMotorizedTotal(row: CaptureRow, access: AccessConfig): number {
  return movementKeys.reduce((total, key) => {
    if (!access.movements[key]) {
      return total;
    }

    return total + valueOrZero(row[key]);
  }, 0);
}

export function validateCaptureRowDetailed(row: CaptureRow, access: AccessConfig): RowValidationResult {
  const incompleteIssues: string[] = [];
  const errorIssues: string[] = [];

  for (const key of movementKeys) {
    if (!access.movements[key]) {
      if (row[key] !== null) {
        errorIssues.push(`${movementLabels[key]} debe permanecer como N/A.`);
      }
      continue;
    }

    const value = row[key];
    if (isMissing(value)) {
      incompleteIssues.push(`Falta ${movementLabels[key].toLowerCase()}.`);
    } else if (!Number.isInteger(value) || value < 0) {
      errorIssues.push(`${movementLabels[key]} debe ser entero mayor o igual a cero.`);
    }
  }

  for (const [label, value] of [
    ['Pesados', row.heavy],
    ['Motos', row.motorcycles],
    ['Bicicletas', row.bicycles],
    ['Peatones', row.pedestrians],
  ] as const) {
    if (isMissing(value)) {
      incompleteIssues.push(`Falta ${label.toLowerCase()}.`);
    } else if (!Number.isInteger(value) || value < 0) {
      errorIssues.push(`${label} debe ser entero mayor o igual a cero.`);
    }
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
    if (!isMissing(value) && (!Number.isFinite(value) || value < 0)) {
      errorIssues.push(`${label} debe ser mayor o igual a cero.`);
    }
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
  const accessById = new Map(accesses.map((access) => [access.id, access]));
  const fallbackAccess = accesses[0];
  const rowValidation = rows.map((row) => {
    const access = accessById.get(row.accessId) ?? fallbackAccess;
    if (!access) {
      return { rowId: row.id, state: 'error' as const, issues: ['Acceso no configurado.'] };
    }
    return validateCaptureRowDetailed(row, access);
  });
  const issues = rowValidation.flatMap((result) => result.issues);
  const completeRows = rowValidation.filter((result) => result.state === 'complete').length;
  const incompleteRows = rowValidation.filter((result) => result.state === 'incomplete').length;
  const errorRows = rowValidation.filter((result) => result.state === 'error').length;
  const completionPercent = rows.length > 0 ? (completeRows / rows.length) * 100 : 0;
  const isComplete = rows.length > 0 && completeRows === rows.length && errorRows === 0;
  const totalForRow = (row: CaptureRow) => {
    const access = accessById.get(row.accessId) ?? fallbackAccess;
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
      left: groupedRows.reduce((total, row) => total + valueOrZero(row.left), 0),
      through: groupedRows.reduce((total, row) => total + valueOrZero(row.through), 0),
      right: groupedRows.reduce((total, row) => total + valueOrZero(row.right), 0),
      uTurn: groupedRows.reduce((total, row) => total + valueOrZero(row.uTurn), 0),
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
    if (!best || item.total > best.volume) {
      return { label: item.label, volume: item.total };
    }
    return best;
  }, null);

  const slotsPerHour = isOneHourCompatible(intervalMinutes) ? 60 / intervalMinutes : 0;
  let peakHour = null;
  if (slotsPerHour > 0 && byInterval.length >= slotsPerHour) {
    for (let index = 0; index <= byInterval.length - slotsPerHour; index += 1) {
      const window = byInterval.slice(index, index + slotsPerHour);
      const volume = window.reduce((total, item) => total + item.total, 0);
      const maxIntervalVolume = Math.max(...window.map((item) => item.total));
      const candidate = {
        label: `${window[0].start}-${window[window.length - 1].end}`,
        volume,
        maxIntervalVolume,
        factor: maxIntervalVolume > 0 ? volume / (slotsPerHour * maxIntervalVolume) : null,
        factorLabel: intervalMinutes === 15 ? ('FHP' as const) : ('Factor de uniformidad de hora pico' as const),
      };
      if (!peakHour || candidate.volume > peakHour.volume) {
        peakHour = candidate;
      }
    }
  }

  const byAccess = accesses.map((access) => ({
    accessId: access.id,
    accessName: access.name,
    volume: rows.filter((row) => row.accessId === access.id).reduce((total, row) => total + totalForRow(row), 0),
  }));

  const byMovement = movementKeys.map((key) => {
    const volume = rows.reduce((total, row) => total + valueOrZero(row[key]), 0);
    return {
      movement: movementLabels[key],
      volume,
      percent: totalMotorized > 0 ? (volume / totalMotorized) * 100 : 0,
    };
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

  const program = signalInput.programs?.find(
    (item) => typeof item.cycleSeconds === 'number' && item.cycleSeconds > 0 && typeof item.greenSeconds === 'number',
  );
  const fallbackProgram = signalInput.programs?.[0];
  const signalProgram = program ?? fallbackProgram;
  const cycleSeconds = signalProgram?.cycleSeconds && signalProgram.cycleSeconds > 0 ? signalProgram.cycleSeconds : null;
  const phaseGreen = signalProgram?.phaseTimings.find(
    (phase) => typeof phase.greenSeconds === 'number' && phase.greenSeconds >= 0,
  )?.greenSeconds;
  const effectiveGreenSeconds =
    typeof signalProgram?.greenSeconds === 'number' && signalProgram.greenSeconds >= 0
      ? signalProgram.greenSeconds
      : typeof phaseGreen === 'number'
        ? phaseGreen
        : null;
  const greenRatio = cycleSeconds && effectiveGreenSeconds !== null ? effectiveGreenSeconds / cycleSeconds : null;
  const saturationFlowPerLane =
    typeof signalInput.observedSaturationFlowPerLane === 'number' && signalInput.observedSaturationFlowPerLane > 0
      ? signalInput.observedSaturationFlowPerLane
      : null;
  const totalLanes = accesses.reduce((total, access) => total + Math.max(0, access.lanes), 0);
  const capacity =
    saturationFlowPerLane !== null && greenRatio !== null && totalLanes > 0
      ? saturationFlowPerLane * totalLanes * greenRatio
      : null;
  const peakHourFlow = peakHour?.volume ?? null;
  const volumeCapacityRatio = peakHourFlow !== null && capacity !== null && capacity > 0 ? peakHourFlow / capacity : null;

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
    signalIndicators: {
      peakHourFlow,
      cycleSeconds,
      effectiveGreenSeconds,
      greenRatio,
      saturationFlowPerLane,
      capacity,
      volumeCapacityRatio,
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
      capacity !== null && volumeCapacityRatio !== null
        ? 'Capacidad y v/c calculados con saturación observada, carriles y proporción de verde.'
        : 'Capacidad y v/c: N/D por falta de saturación, carriles o tiempos semafóricos.',
    ],
    issues,
  };
}
