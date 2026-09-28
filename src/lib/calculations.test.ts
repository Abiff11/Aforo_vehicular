import { describe, expect, it } from 'vitest';
import {
  calculateRowMotorizedTotal,
  calculateStudySummary,
  createEmptyCaptureRows,
  validateCaptureRow,
} from './calculations';
import type { AccessConfig, CaptureRow, IntervalBlock, SignalProgram } from './types';

const intervals: IntervalBlock[] = [
  { id: '07:00-07:15', start: '07:00', end: '07:15', label: '07:00-07:15' },
  { id: '07:15-07:30', start: '07:15', end: '07:30', label: '07:15-07:30' },
  { id: '07:30-07:45', start: '07:30', end: '07:45', label: '07:30-07:45' },
  { id: '07:45-08:00', start: '07:45', end: '08:00', label: '07:45-08:00' },
];

const access: AccessConfig = {
  id: 'north',
  name: 'Norte',
  lanes: 2,
  movements: { left: true, through: true, right: true, uTurn: false },
};

const signalProgram: SignalProgram = {
  id: 'p1',
  name: 'P1',
  startTime: '07:00',
  endTime: '09:00',
  cycleSeconds: 90,
  phases: 2,
  greenSeconds: 40,
  amberSeconds: 3,
  redSeconds: 47,
  clearanceSeconds: null,
  phaseTimings: [],
  notes: '',
};

function row(interval: IntervalBlock, values: Partial<CaptureRow>): CaptureRow {
  return {
    id: `${interval.id}-north`,
    intervalId: interval.id,
    intervalLabel: interval.label,
    intervalStart: interval.start,
    intervalEnd: interval.end,
    accessId: access.id,
    accessName: access.name,
    left: 0,
    through: 0,
    right: 0,
    uTurn: null,
    heavy: 0,
    motorcycles: 0,
    bicycles: 0,
    pedestrians: 0,
    maxQueue: null,
    averageQueue: null,
    queueLength: null,
    stoppedVehiclesPerCycle: null,
    observedCycle: null,
    observedProgram: '',
    notes: '',
    ...values,
  };
}

function interval(start: string, end: string): IntervalBlock {
  return { id: `${start}-${end}`, start, end, label: `${start}-${end}` };
}

describe('capture calculations', () => {
  it('sums only enabled motorized movements and keeps disabled movement as N/A', () => {
    expect(calculateRowMotorizedTotal(row(intervals[0], { left: 12, through: 87, right: 19, uTurn: null }), access)).toBe(118);
  });

  it('detects classification counts greater than the motorized total', () => {
    const issues = validateCaptureRow(row(intervals[0], { left: 1, through: 1, right: 0, heavy: 2, motorcycles: 1 }), access);
    expect(issues).toContain('Pesados + motos supera el total motorizado.');
  });

  it('treats zero as captured and empty null as missing', () => {
    const zeroIssues = validateCaptureRow(row(intervals[0], { pedestrians: 0 }), access);
    const missingIssues = validateCaptureRow(row(intervals[0], { pedestrians: null }), access);
    expect(zeroIssues).not.toContain('Falta peatones.');
    expect(missingIssues).toContain('Falta peatones.');
  });

  it('creates new capture rows with observable fields empty, not zero', () => {
    const rows = createEmptyCaptureRows(intervals, [access]);
    expect(rows).toHaveLength(4);
    expect(rows[0]).toMatchObject({
      intervalLabel: '07:00-07:15',
      accessName: 'Norte',
      left: null,
      through: null,
      right: null,
      uTurn: null,
      heavy: null,
      motorcycles: null,
      bicycles: null,
      pedestrians: null,
      stoppedVehiclesPerCycle: null,
    });
    expect(validateCaptureRow(rows[0], access)).toContain('Falta izquierda.');
  });

  it('counts complete, incomplete, and error rows row-by-row', () => {
    const complete = row(intervals[0], { left: 1, through: 2, right: 3 });
    const incomplete = row(intervals[1], { left: null, through: 2, right: 3 });
    const invalid = row(intervals[2], { left: -1, through: 2, right: 3 });
    const summary = calculateStudySummary([complete, incomplete, invalid], [access], 15);

    expect(summary.completeRows).toBe(1);
    expect(summary.incompleteRows).toBe(1);
    expect(summary.errorRows).toBe(1);
    expect(summary.completionPercent).toBeCloseTo(100 / 3);
    expect(summary.isComplete).toBe(false);
    expect(summary.isPartial).toBe(true);
  });

  it('calculates peak hour and FHP from a mobile one-hour window', () => {
    const rows = [
      row(intervals[0], { left: 10, through: 90, right: 0 }),
      row(intervals[1], { left: 10, through: 110, right: 0 }),
      row(intervals[2], { left: 10, through: 130, right: 0 }),
      row(intervals[3], { left: 10, through: 150, right: 0 }),
    ];
    const summary = calculateStudySummary(rows, [access], 15);
    expect(summary.totalMotorized).toBe(520);
    expect(summary.peakHour).toMatchObject({
      label: '07:00-08:00',
      volume: 520,
      maxIntervalVolume: 160,
      factor: 0.8125,
      factorLabel: 'FHP',
    });
  });

  it('does not use an incomplete interval in a peak-hour window', () => {
    const rows = [
      row(intervals[0], { through: 100 }),
      row(intervals[1], { through: 120 }),
      row(intervals[2], { left: null, through: 140 }),
      row(intervals[3], { through: 160 }),
    ];
    const summary = calculateStudySummary(rows, [access], 15);
    expect(summary.peakHour).toBeNull();
    expect(summary.isPartial).toBe(true);
  });

  it('keeps the first peak-hour window on a tie and emits the required warning', () => {
    const fiveIntervals = [
      interval('07:00', '07:15'),
      interval('07:15', '07:30'),
      interval('07:30', '07:45'),
      interval('07:45', '08:00'),
      interval('08:00', '08:15'),
    ];
    const rows = fiveIntervals.map((item) => row(item, { through: 100 }));
    const summary = calculateStudySummary(rows, [access], 15);
    expect(summary.peakHour).toMatchObject({ label: '07:00-08:00', volume: 400, tie: true });
    expect(summary.warnings).toContain('Existe empate entre ventanas de hora pico; se conserva la primera.');
  });

  it.each([
    [10, 6],
    [20, 3],
    [30, 2],
  ])('calculates an equivalent uniformity factor for %s minute intervals', (minutes, count) => {
    const generated = Array.from({ length: count }, (_, index) => {
      const startMinutes = 7 * 60 + index * minutes;
      const endMinutes = startMinutes + minutes;
      const format = (value: number) => `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;
      return interval(format(startMinutes), format(endMinutes));
    });
    const summary = calculateStudySummary(generated.map((item) => row(item, { through: 100 })), [access], minutes);
    expect(summary.peakHour?.factor).toBe(1);
    expect(summary.peakHour?.factorLabel).toBe('Factor de uniformidad de hora pico');
  });

  it('does not invent a peak hour for studies shorter than one hour', () => {
    const summary = calculateStudySummary([row(intervals[0], { left: 10, through: 90, right: 0 })], [access], 15);
    expect(summary.peakHour).toBeNull();
  });

  it('aggregates ficha-ready totals by interval and computes the average interval volume', () => {
    const secondAccess: AccessConfig = { ...access, id: 'south', name: 'Sur' };
    const rows = [
      row(intervals[0], { left: 10, through: 20, right: 5, heavy: 3, motorcycles: 2, notes: 'Norte cargado' }),
      { ...row(intervals[0], { left: 4, through: 8, right: 3, heavy: 1, motorcycles: 1 }), id: 'south-row', accessId: 'south', accessName: 'Sur' },
      row(intervals[1], { left: 6, through: 12, right: 2, heavy: 2, motorcycles: 1 }),
      { ...row(intervals[1], { left: 2, through: 4, right: 4, heavy: 1, motorcycles: 0 }), id: 'south-row-2', accessId: 'south', accessName: 'Sur' },
    ];
    const summary = calculateStudySummary(rows, [access, secondAccess], 15);
    expect(summary.byInterval).toHaveLength(2);
    expect(summary.byInterval[0]).toMatchObject({
      label: '07:00-07:15', left: 14, through: 28, right: 8, total: 50, heavy: 4, motorcycles: 3, notes: 'Norte cargado',
    });
    expect(summary.averageIntervalVolume).toBe(40);
  });

  it('summarizes queue operation by access without treating empty values as zero', () => {
    const rows = [
      row(intervals[0], { left: 10, through: 90, right: 0, maxQueue: 0, averageQueue: 0, queueLength: 0, stoppedVehiclesPerCycle: 0 }),
      row(intervals[1], { left: 10, through: 110, right: 0, maxQueue: 18, averageQueue: 10, queueLength: 72, stoppedVehiclesPerCycle: 9 }),
      row(intervals[2], { left: 10, through: 130, right: 0 }),
      row(intervals[3], { left: 10, through: 150, right: 0 }),
    ];
    const summary = calculateStudySummary(rows, [access], 15, { programs: [signalProgram], observedSaturationFlowPerLane: 1800 });
    expect(summary.queueByAccess[0]).toMatchObject({
      accessName: 'Norte', maxQueue: 18, averageQueue: 5, maxQueueLength: 72, stoppedVehiclesPerCycle: 4.5,
    });
  });
});
