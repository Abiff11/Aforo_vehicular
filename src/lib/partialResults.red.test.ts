import { describe, expect, it } from 'vitest';
import { calculateStudySummary } from './calculations';
import type { AccessConfig, CaptureRow } from './types';

const access: AccessConfig = {
  id: 'north',
  name: 'Norte',
  lanes: 2,
  movements: { left: true, through: true, right: true, uTurn: false },
};

function row(id: string, label: string, through: number | null, left: number | null): CaptureRow {
  const [start, end] = label.split('-');
  return {
    id,
    intervalId: label,
    intervalLabel: label,
    intervalStart: start,
    intervalEnd: end,
    accessId: access.id,
    accessName: access.name,
    left,
    through,
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
  };
}

describe('partial result integrity', () => {
  it('keeps partial captured volume out of definitive access and movement aggregates', () => {
    const summary = calculateStudySummary([
      row('r1', '07:00-07:15', 100, 0),
      row('r2', '07:15-07:30', 200, null),
    ], [access], 15);

    expect(summary.totalMotorized).toBe(300);
    expect(summary.byAccess).toEqual([{ accessId: 'north', accessName: 'Norte', volume: 100 }]);
    expect(summary.byMovement.find((item) => item.movement === 'Frente')?.volume).toBe(100);
  });
});
