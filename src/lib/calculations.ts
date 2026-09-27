import type { AccessConfig, CaptureRow, IntervalBlock, MovementKey, StudySummary } from './types';
import { isOneHourCompatible } from './time';

const movementLabels: Record<MovementKey, string> = {
  left: 'Izquierda',
  through: 'Frente',
  right: 'Derecha',
  uTurn: 'Retorno',
};

const movementKeys: MovementKey[] = ['left', 'through', 'right', 'uTurn'];

function valueOrZero(value: number | null): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function isMissing(value: number | null | undefined): value is null | undefined {
  return value === null || value === undefined;
}

export function calculateRowMotorizedTotal(row: CaptureRow, access: AccessConfig): number {
  return movementKeys.reduce((total, key) => {
    if (!access.movements[key]) {
      return total;
    }

    return total + valueOrZero(row[key]);
  }, 0);
}

export function validateCaptureRow(row: CaptureRow, access: AccessConfig): string[] {
  const issues: string[] = [];

  for (const key of movementKeys) {
    if (!access.movements[key]) {
      if (row[key] !== null) {
        issues.push(`${movementLabels[key]} debe permanecer como N/A.`);
      }
      continue;
    }

    const value = row[key];
    if (isMissing(value)) {
      issues.push(`Falta ${movementLabels[key].toLowerCase()}.`);
    } else if (!Number.isInteger(value) || value < 0) {
      issues.push(`${movementLabels[key]} debe ser entero mayor o igual a cero.`);
    }
  }

  for (const [label, value] of [
    ['Pesados', row.heavy],
    ['Motos', row.motorcycles],
    ['Bicicletas', row.bicycles],
    ['Peatones', row.pedestrians],
  ] as const) {
    if (isMissing(value)) {
      issues.push(`Falta ${label.toLowerCase()}.`);
    } else if (!Number.isInteger(value) || value < 0) {
      issues.push(`${label} debe ser entero mayor o igual a cero.`);
    }
  }

  if (valueOrZero(row.heavy) + valueOrZero(row.motorcycles) > calculateRowMotorizedTotal(row, access)) {
    issues.push('Pesados + motos supera el total motorizado.');
  }

  return issues;
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
      left: access.movements.left ? 0 : null,
      through: access.movements.through ? 0 : null,
      right: access.movements.right ? 0 : null,
      uTurn: access.movements.uTurn ? 0 : null,
      heavy: 0,
      motorcycles: 0,
      bicycles: 0,
      pedestrians: 0,
      maxQueue: null,
      averageQueue: null,
      queueLength: null,
      observedCycle: null,
      observedProgram: '',
      notes: '',
    })),
  );
}

export function calculateStudySummary(rows: CaptureRow[], accesses: AccessConfig[], intervalMinutes: number): StudySummary {
  const accessById = new Map(accesses.map((access) => [access.id, access]));
  const issues = rows.flatMap((row) => validateCaptureRow(row, accessById.get(row.accessId) ?? accesses[0]));
  const totalForRow = (row: CaptureRow) => calculateRowMotorizedTotal(row, accessById.get(row.accessId) ?? accesses[0]);
  const intervalVolumes = new Map<string, { label: string; start: string; end: string; volume: number }>();

  for (const row of rows) {
    const current = intervalVolumes.get(row.intervalId) ?? {
      label: row.intervalLabel,
      start: row.intervalStart,
      end: row.intervalEnd,
      volume: 0,
    };
    current.volume += totalForRow(row);
    intervalVolumes.set(row.intervalId, current);
  }

  const orderedIntervals = Array.from(intervalVolumes.values());
  const totalMotorized = rows.reduce((total, row) => total + totalForRow(row), 0);
  const peakInterval = orderedIntervals.reduce<{ label: string; volume: number } | null>((best, item) => {
    if (!best || item.volume > best.volume) {
      return { label: item.label, volume: item.volume };
    }
    return best;
  }, null);

  const slotsPerHour = isOneHourCompatible(intervalMinutes) ? 60 / intervalMinutes : 0;
  let peakHour = null;
  if (slotsPerHour > 0 && orderedIntervals.length >= slotsPerHour) {
    for (let index = 0; index <= orderedIntervals.length - slotsPerHour; index += 1) {
      const window = orderedIntervals.slice(index, index + slotsPerHour);
      const volume = window.reduce((total, item) => total + item.volume, 0);
      const maxIntervalVolume = Math.max(...window.map((item) => item.volume));
      const candidate = {
        label: `${window[0].start}-${window[window.length - 1].end}`,
        volume,
        maxIntervalVolume,
        factor: maxIntervalVolume > 0 ? volume / (slotsPerHour * maxIntervalVolume) : null,
        factorLabel: intervalMinutes === 15 ? 'FHP' : 'Factor de uniformidad de hora pico',
      } as const;
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

  const completeRows = rows.length - new Set(issues).size;

  return {
    totalMotorized,
    totalHeavy: rows.reduce((total, row) => total + valueOrZero(row.heavy), 0),
    totalMotorcycles: rows.reduce((total, row) => total + valueOrZero(row.motorcycles), 0),
    totalBicycles: rows.reduce((total, row) => total + valueOrZero(row.bicycles), 0),
    totalPedestrians: rows.reduce((total, row) => total + valueOrZero(row.pedestrians), 0),
    peakInterval,
    peakHour,
    byAccess,
    byMovement,
    dataQuality: [
      `${Math.max(0, completeRows)} filas revisadas`,
      `${accesses.length} accesos configurados`,
      issues.length === 0 ? 'Sin errores obligatorios' : `${issues.length} observaciones por revisar`,
      'Capacidad y v/c: N/D por falta de datos de saturacion',
    ],
    issues,
  };
}
