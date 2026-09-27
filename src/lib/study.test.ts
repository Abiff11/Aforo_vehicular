import { describe, expect, it } from 'vitest';
import {
  addSignalMovementAssignment,
  createDefaultStudy,
  hasCapturedData,
  markStudyExported,
  rebuildStudyRowsPreservingCapture,
  removeSignalMovementAssignment,
  updateAccessConfig,
  updateAccessMovement,
  updateProgram,
  updateProgramPhase,
  updateProgramPhaseCount,
  updateSignalMovementAssignment,
  validateStudy,
} from './study';
import type { StudyMetadata } from './types';

describe('study configuration editing', () => {
  it('creates a study from shared metadata and generates matching intervals', () => {
    const metadata: StudyMetadata = {
      date: '2026-09-27',
      startTime: '06:30',
      endTime: '07:30',
      intervalMinutes: 10,
      surveyor: 'Hiram',
      weather: 'Despejado',
      observedSaturationFlowPerLane: 1800,
      notes: 'Estudio matutino',
    };

    const study = createDefaultStudy('INT-003', metadata);

    expect(study.metadata).toEqual(metadata);
    expect(study.intervals).toHaveLength(6);
    expect(study.intervals[0]).toMatchObject({ start: '06:30', end: '06:40' });
    expect(study.rows[0]?.intervalLabel).toContain('06:30');
    expect(study.rows[0]?.left).toBeNull();
    expect(study.rows[0]?.heavy).toBeNull();
  });

  it('starts signal configuration neutral instead of pretending measured timings', () => {
    const study = createDefaultStudy('INT-002');
    expect(study.configurationSnapshot.inherited).toBe(true);
    expect(study.configurationSnapshot.programs[0]).toMatchObject({
      cycleSeconds: null,
      greenSeconds: null,
      amberSeconds: null,
      redSeconds: null,
      phases: null,
    });
    expect(study.configurationSnapshot.signalMovementAssignments).toEqual([]);
  });

  it('updates access name, lanes, and movement availability without inventing a zero observation', () => {
    const study = createDefaultStudy('INT-002');
    const renamed = updateAccessConfig(study, 'north', { name: 'Acceso principal', lanes: 3 });
    const updated = updateAccessMovement(renamed, 'north', 'uTurn', true);
    const access = updated.configurationSnapshot.accesses.find((item) => item.id === 'north');

    expect(access).toMatchObject({ name: 'Acceso principal', lanes: 3, movements: { uTurn: true } });
    expect(updated.rows.some((row) => row.accessName === 'Acceso principal' && row.uTurn === null)).toBe(true);
  });

  it('preserves compatible captured rows when configuration labels or study range are rebuilt', () => {
    const study = createDefaultStudy('INT-002');
    const captured = {
      ...study,
      rows: study.rows.map((row, index) =>
        index === 0
          ? { ...row, left: 1, through: 10, right: 2, heavy: 1, motorcycles: 1, bicycles: 0, pedestrians: 0 }
          : row,
      ),
    };
    expect(hasCapturedData(captured)).toBe(true);

    const renamed = updateAccessConfig(captured, 'north', { name: 'Acceso conservado' });
    expect(renamed.rows[0]).toMatchObject({ left: 1, through: 10, right: 2, accessName: 'Acceso conservado' });

    const extended = rebuildStudyRowsPreservingCapture({
      ...renamed,
      metadata: { ...renamed.metadata, endTime: '09:15' },
    });
    expect(extended.rows.find((row) => row.id === captured.rows[0].id)).toMatchObject({ left: 1, through: 10, right: 2 });
    expect(extended.intervals.at(-1)?.label).toBe('09:00-09:15');
  });

  it('configures signal green, amber, red, and individual phase cycles only after explicit edits', () => {
    const study = createDefaultStudy('INT-002');
    const withProgram = updateProgram(study, 'p1', {
      cycleSeconds: 120,
      greenSeconds: 45,
      amberSeconds: 4,
      redSeconds: 71,
    });
    const withThreePhases = updateProgramPhaseCount(withProgram, 'p1', 3);
    const updated = updateProgramPhase(withThreePhases, 'p1', 'phase-2', {
      name: 'Fase 2 - Oriente/Poniente',
      greenSeconds: 35,
      amberSeconds: 4,
      redSeconds: 81,
      cycleSeconds: 120,
    });
    const program = updated.configurationSnapshot.programs[0];

    expect(program).toMatchObject({ cycleSeconds: 120, greenSeconds: 45, amberSeconds: 4, redSeconds: 71, phases: 3 });
    expect(program.phaseTimings).toHaveLength(3);
    expect(program.phaseTimings[1]).toMatchObject({
      name: 'Fase 2 - Oriente/Poniente', greenSeconds: 35, amberSeconds: 4, redSeconds: 81, cycleSeconds: 120,
    });
  });

  it('adds, edits, and removes explicit movement-phase assignments', () => {
    const base = updateProgramPhaseCount(createDefaultStudy('INT-002'), 'p1', 1);
    const added = addSignalMovementAssignment(base);
    const assignment = added.configurationSnapshot.signalMovementAssignments?.[0];
    expect(assignment).toMatchObject({
      accessId: 'north',
      movement: 'through',
      programId: 'p1',
      phaseId: 'phase-1',
      lanes: null,
      saturationFlowPerLane: null,
      effectiveGreenSeconds: null,
    });

    const updated = updateSignalMovementAssignment(added, assignment!.id, {
      lanes: 2,
      saturationFlowPerLane: 1800,
      effectiveGreenSeconds: 40,
    });
    expect(updated.configurationSnapshot.signalMovementAssignments?.[0]).toMatchObject({
      lanes: 2,
      saturationFlowPerLane: 1800,
      effectiveGreenSeconds: 40,
    });

    const removed = removeSignalMovementAssignment(updated, assignment!.id);
    expect(removed.configurationSnapshot.signalMovementAssignments).toEqual([]);
  });

  it('validates only complete observed studies and does not let export hide an incomplete state', () => {
    const observed = createDefaultStudy('INT-002');
    expect(validateStudy(observed, false).status).toBe('incomplete');
    expect(validateStudy(observed, true).status).toBe('validated');

    const estimated = { ...observed, source: 'estimated_tdpa' as const };
    expect(validateStudy(estimated, true).status).toBe('incomplete');

    const legacy = { ...observed, legacyUnverified: true };
    expect(validateStudy(legacy, true).status).toBe('incomplete');
    expect(validateStudy(legacy, true, true)).toMatchObject({ status: 'validated', legacyUnverified: false });

    expect(markStudyExported(validateStudy(observed, false)).status).toBe('incomplete');
    expect(markStudyExported(validateStudy(observed, true)).status).toBe('exported');
  });
});
