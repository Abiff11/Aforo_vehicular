import { describe, expect, it } from 'vitest';
import {
  addSignalMovementAssignment,
  addSignalProgram,
  createDefaultStudy,
  hasCapturedData,
  markStudyExported,
  rebuildStudyRowsPreservingCapture,
  removeSignalMovementAssignment,
  removeSignalProgram,
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

  it('adds contiguous signal programs without inventing timing values', () => {
    const study = createDefaultStudy('INT-002');
    const updated = addSignalProgram(study);

    expect(updated.configurationSnapshot.programs).toHaveLength(2);
    expect(updated.configurationSnapshot.programs[1]).toMatchObject({
      id: 'p2',
      name: 'P2',
      startTime: '09:00',
      endTime: '10:00',
      cycleSeconds: null,
      phases: null,
      phaseTimings: [],
    });
  });

  it('reassigns groups when deleting a program and never deletes the final program', () => {
    const base = updateProgramPhaseCount(addSignalProgram(createDefaultStudy('INT-002')), 'p2', 1);
    const withGroup = addSignalMovementAssignment(base);
    const assignment = withGroup.configurationSnapshot.signalMovementAssignments![0];
    const assignedToP2 = updateSignalMovementAssignment(withGroup, assignment.id, {
      programId: 'p2',
      phaseId: 'phase-1',
      effectiveGreenSeconds: 30,
    });

    const removed = removeSignalProgram(assignedToP2, 'p2');
    expect(removed.configurationSnapshot.programs.map((program) => program.id)).toEqual(['p1']);
    expect(removed.configurationSnapshot.signalMovementAssignments?.[0]).toMatchObject({
      programId: 'p1',
      phaseId: '',
      effectiveGreenSeconds: null,
    });

    expect(removeSignalProgram(removed, 'p1')).toBe(removed);
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

  it('creates physical lane groups before signal phases and stores saturation origin separately', () => {
    const base = createDefaultStudy('INT-002');
    const added = addSignalMovementAssignment(base);
    const assignment = added.configurationSnapshot.signalMovementAssignments?.[0];
    expect(assignment).toMatchObject({
      accessId: 'north',
      movement: 'through',
      programId: 'p1',
      phaseId: '',
      lanes: null,
      saturationFlowPerLane: null,
      saturationSource: 'unknown',
      effectiveGreenSeconds: null,
    });

    const configured = updateSignalMovementAssignment(added, assignment!.id, {
      lanes: 2,
      saturationFlowPerLane: 1800,
      saturationSource: 'measured',
    });
    expect(configured.configurationSnapshot.signalMovementAssignments?.[0]).toMatchObject({
      lanes: 2,
      saturationFlowPerLane: 1800,
      saturationSource: 'measured',
      phaseId: '',
      effectiveGreenSeconds: null,
    });

    const withPhase = updateProgramPhaseCount(configured, 'p1', 1);
    const timed = updateSignalMovementAssignment(withPhase, assignment!.id, {
      phaseId: 'phase-1',
      effectiveGreenSeconds: 40,
    });
    expect(timed.configurationSnapshot.signalMovementAssignments?.[0]).toMatchObject({
      phaseId: 'phase-1',
      effectiveGreenSeconds: 40,
    });

    const removed = removeSignalMovementAssignment(timed, assignment!.id);
    expect(removed.configurationSnapshot.signalMovementAssignments).toEqual([]);
  });

  it('invalidates validated or exported status when calculation configuration changes', () => {
    const validated = { ...createDefaultStudy('INT-002'), status: 'validated' as const };
    expect(updateAccessConfig(validated, 'north', { lanes: 3 }).status).toBe('draft');
    expect(updateAccessMovement(validated, 'north', 'uTurn', true).status).toBe('draft');
    expect(updateProgram(validated, 'p1', { cycleSeconds: 90 }).status).toBe('draft');
    expect(addSignalProgram(validated).status).toBe('draft');
    expect(updateProgramPhaseCount(validated, 'p1', 1).status).toBe('draft');

    const withGroup = addSignalMovementAssignment(createDefaultStudy('INT-002'));
    const assignment = withGroup.configurationSnapshot.signalMovementAssignments![0];
    const exported = { ...withGroup, status: 'exported' as const };
    expect(updateSignalMovementAssignment(exported, assignment.id, { saturationFlowPerLane: 1800 }).status).toBe('draft');
    expect(removeSignalMovementAssignment(exported, assignment.id).status).toBe('draft');
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
