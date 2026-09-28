import { describe, expect, it } from 'vitest';
import { calculateStudySummary } from './calculations';
import type { AccessConfig, CaptureRow, IntervalBlock, SignalMovementAssignment, SignalProgram } from './types';

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

const program: SignalProgram = {
  id: 'p1',
  name: 'Pico AM',
  startTime: '07:00',
  endTime: '09:00',
  cycleSeconds: 90,
  phases: 1,
  greenSeconds: 40,
  amberSeconds: 3,
  redSeconds: 47,
  clearanceSeconds: null,
  phaseTimings: [
    { id: 'phase-1', name: 'Fase 1', cycleSeconds: 90, greenSeconds: 40, amberSeconds: 3, redSeconds: 47 },
  ],
  notes: '',
};

function row(interval: IntervalBlock, through: number, observedCycle: number | null = null): CaptureRow {
  return {
    id: `${interval.id}-north`,
    intervalId: interval.id,
    intervalLabel: interval.label,
    intervalStart: interval.start,
    intervalEnd: interval.end,
    accessId: 'north',
    accessName: 'Norte',
    left: 0,
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
    observedCycle,
    observedProgram: '',
    notes: '',
  };
}

const rows = [
  row(intervals[0], 100, 92),
  row(intervals[1], 120, 88),
  row(intervals[2], 140, 90),
  row(intervals[3], 160, 90),
];

const assignment: SignalMovementAssignment = {
  id: 'north-through',
  accessId: 'north',
  movement: 'through',
  programId: 'p1',
  phaseId: 'phase-1',
  lanes: 2,
  saturationFlowPerLane: 1800,
  saturationSource: 'measured',
  effectiveGreenSeconds: 40,
};

describe('formal signal calculations', () => {
  it('does not treat programmed green as effective green or calculate aggregate capacity', () => {
    const summary = calculateStudySummary(rows, [access], 15, { programs: [program] });

    expect(summary.signalIndicators.effectiveGreenSeconds).toBeNull();
    expect(summary.signalIndicators.greenRatio).toBeNull();
    expect(summary.signalIndicators.capacity).toBeNull();
    expect(summary.signalIndicators.volumeCapacityRatio).toBeNull();
  });

  it('summarizes observed cycles against the programmed cycle', () => {
    const summary = calculateStudySummary(rows, [access], 15, { programs: [program] });

    expect(summary.cycleSummaries?.[0]).toMatchObject({
      accessId: 'north',
      accessName: 'Norte',
      averageObservedCycle: 90,
      minObservedCycle: 88,
      maxObservedCycle: 92,
      programmedCycleSeconds: 90,
      averageDifferenceSeconds: 0,
    });
  });

  it('calculates formal capacity and v/c only for a complete movement-phase lane group', () => {
    const summary = calculateStudySummary(rows, [access], 15, { programs: [program], assignments: [assignment] });

    expect(summary.signalGroupIndicators?.[0]).toMatchObject({
      assignmentId: 'north-through',
      accessId: 'north',
      movement: 'through',
      peakHourVolume: 520,
      saturationFlowPerLane: 1800,
      lanes: 2,
      cycleSeconds: 90,
      effectiveGreenSeconds: 40,
      greenRatio: 40 / 90,
      capacity: 1600,
      volumeCapacityRatio: 0.325,
    });
    expect(summary.signalIndicators.capacity).toBeNull();
  });

  it('returns N/D for capacity and v/c when any lane-group input is missing', () => {
    const summary = calculateStudySummary(rows, [access], 15, {
      programs: [program],
      assignments: [{ ...assignment, effectiveGreenSeconds: null }],
    });

    expect(summary.signalGroupIndicators?.[0]).toMatchObject({ capacity: null, volumeCapacityRatio: null, greenRatio: null });
  });

  it('warns when a program changes inside an interval and excludes that interval from formal signal analysis', () => {
    const p1 = { ...program, endTime: '07:55' };
    const p2: SignalProgram = { ...program, id: 'p2', name: 'Valle', startTime: '07:55', endTime: '09:00' };
    const summary = calculateStudySummary(rows, [access], 15, { programs: [p1, p2], assignments: [assignment] });

    expect(summary.warnings).toContain('Cambio de programa dentro del intervalo 07:45-08:00.');
    expect(summary.signalGroupIndicators?.[0].capacity).toBeNull();
    expect(summary.signalGroupIndicators?.[0].volumeCapacityRatio).toBeNull();
  });
});
