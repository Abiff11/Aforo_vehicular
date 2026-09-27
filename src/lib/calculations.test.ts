import { describe, expect, it } from 'vitest';
import {
  calculateRowMotorizedTotal,
  calculateStudySummary,
  createEmptyCaptureRows,
  validateCaptureRow,
} from './calculations';
import type { AccessConfig, CaptureRow, IntervalBlock } from './types';

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
    observedCycle: null,
    observedProgram: '',
    notes: '',
    ...values,
  };
}

describe('capture calculations', () => {
  it('sums only enabled motorized movements and keeps disabled movement as N/A', () => {
    expect(calculateRowMotorizedTotal(row(intervals[0], { left: 12, through: 87, right: 19, uTurn: null }), access)).toBe(
      118,
    );
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

  it('creates one row per interval and access', () => {
    const rows = createEmptyCaptureRows(intervals, [access]);

    expect(rows).toHaveLength(4);
    expect(rows[0]).toMatchObject({
      intervalLabel: '07:00-07:15',
      accessName: 'Norte',
      uTurn: null,
    });
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

  it('does not invent a peak hour for studies shorter than one hour', () => {
    const summary = calculateStudySummary([row(intervals[0], { left: 10, through: 90, right: 0 })], [access], 15);

    expect(summary.peakHour).toBeNull();
  });
});
