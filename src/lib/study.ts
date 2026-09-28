import type {
  AccessConfig,
  CaptureRow,
  IntersectionConfig,
  MovementKey,
  SignalMovementAssignment,
  SignalPhaseTiming,
  SignalProgram,
  Study,
  StudyMetadata,
} from './types';
import { createEmptyCaptureRows } from './calculations';
import { generateIntervals } from './time';

export function createDefaultAccesses(): AccessConfig[] {
  return [
    { id: 'north', name: 'Norte', lanes: 2, movements: { left: true, through: true, right: true, uTurn: false } },
    { id: 'south', name: 'Sur', lanes: 2, movements: { left: true, through: true, right: true, uTurn: false } },
    { id: 'east', name: 'Oriente', lanes: 2, movements: { left: true, through: true, right: true, uTurn: false } },
    { id: 'west', name: 'Poniente', lanes: 2, movements: { left: true, through: true, right: true, uTurn: false } },
  ];
}

export function createDefaultPrograms(): SignalProgram[] {
  return [
    {
      id: 'p1',
      name: 'P1',
      startTime: '07:00',
      endTime: '09:00',
      cycleSeconds: null,
      phases: null,
      greenSeconds: null,
      amberSeconds: null,
      redSeconds: null,
      clearanceSeconds: null,
      phaseTimings: [],
      notes: '',
    },
  ];
}

function createPhaseTimings(count: number, cycleSeconds: number | null): SignalPhaseTiming[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `phase-${index + 1}`,
    name: `Fase ${index + 1}`,
    cycleSeconds,
    greenSeconds: null,
    amberSeconds: null,
    redSeconds: null,
  }));
}

export function createDefaultConfiguration(intersectionId: string, inherited = true): IntersectionConfig {
  return {
    intersectionId,
    inherited,
    accesses: createDefaultAccesses(),
    programs: createDefaultPrograms(),
    signalMovementAssignments: [],
    updatedAt: new Date().toISOString(),
  };
}

export function createDefaultStudyMetadata(now = new Date().toISOString()): StudyMetadata {
  return {
    date: now.slice(0, 10),
    startTime: '07:00',
    endTime: '09:00',
    intervalMinutes: 15,
    surveyor: '',
    weather: '',
    observedSaturationFlowPerLane: null,
    notes: '',
  };
}

export function createDefaultStudy(intersectionId: string, metadata: StudyMetadata = createDefaultStudyMetadata()): Study {
  const configurationSnapshot = createDefaultConfiguration(intersectionId);
  const normalizedMetadata = { ...metadata };
  const intervals = generateIntervals(normalizedMetadata.startTime, normalizedMetadata.endTime, normalizedMetadata.intervalMinutes);
  const now = new Date().toISOString();

  return {
    id: `AF-${now.slice(0, 10).replaceAll('-', '')}-${intersectionId}`,
    intersectionId,
    currentStep: 0,
    metadata: normalizedMetadata,
    configurationSnapshot,
    relatedIntersectionIds: [],
    intervals,
    rows: createEmptyCaptureRows(intervals, configurationSnapshot.accesses),
    status: 'draft',
    source: 'observed',
    tdpaEstimate: null,
    legacyUnverified: false,
    createdAt: now,
    updatedAt: now,
  };
}

export function hasCapturedData(study: Study): boolean {
  return study.rows.some((row) =>
    [
      row.left,
      row.through,
      row.right,
      row.uTurn,
      row.heavy,
      row.motorcycles,
      row.bicycles,
      row.pedestrians,
      row.maxQueue,
      row.averageQueue,
      row.queueLength,
      row.stoppedVehiclesPerCycle,
      row.observedCycle,
    ].some((value) => value !== null) || row.observedProgram.trim() !== '' || row.notes.trim() !== '',
  );
}

function invalidateReviewedStatus(study: Study): Study {
  return {
    ...study,
    status: study.status === 'validated' || study.status === 'exported' ? 'draft' : study.status,
  };
}

function mergeCompatibleRow(emptyRow: CaptureRow, previous: CaptureRow, access: AccessConfig): CaptureRow {
  return {
    ...emptyRow,
    left: access.movements.left ? previous.left : null,
    through: access.movements.through ? previous.through : null,
    right: access.movements.right ? previous.right : null,
    uTurn: access.movements.uTurn ? previous.uTurn : null,
    heavy: previous.heavy,
    motorcycles: previous.motorcycles,
    bicycles: previous.bicycles,
    pedestrians: previous.pedestrians,
    maxQueue: previous.maxQueue,
    averageQueue: previous.averageQueue,
    queueLength: previous.queueLength,
    stoppedVehiclesPerCycle: previous.stoppedVehiclesPerCycle,
    observedCycle: previous.observedCycle,
    observedProgram: previous.observedProgram,
    notes: previous.notes,
  };
}

export function rebuildStudyRowsPreservingCapture(study: Study): Study {
  const intervals = generateIntervals(study.metadata.startTime, study.metadata.endTime, study.metadata.intervalMinutes);
  const emptyRows = createEmptyCaptureRows(intervals, study.configurationSnapshot.accesses);
  const previousById = new Map(study.rows.map((row) => [row.id, row]));
  const accessById = new Map(study.configurationSnapshot.accesses.map((access) => [access.id, access]));
  const rows = emptyRows.map((emptyRow) => {
    const previous = previousById.get(emptyRow.id);
    const access = accessById.get(emptyRow.accessId);
    return previous && access ? mergeCompatibleRow(emptyRow, previous, access) : emptyRow;
  });
  const invalidated = invalidateReviewedStatus(study);

  return { ...invalidated, intervals, rows, updatedAt: new Date().toISOString() };
}

export function rebuildStudyRows(study: Study): Study {
  return rebuildStudyRowsPreservingCapture(study);
}

function withUpdatedAt(study: Study): Study {
  const invalidated = invalidateReviewedStatus(study);
  return { ...invalidated, updatedAt: new Date().toISOString() };
}

function rebuildRowsWithConfiguration(study: Study): Study {
  return rebuildStudyRowsPreservingCapture(study);
}

export function updateAccessConfig(study: Study, accessId: string, changes: Partial<Pick<AccessConfig, 'name' | 'lanes'>>): Study {
  const next: Study = {
    ...study,
    configurationSnapshot: {
      ...study.configurationSnapshot,
      inherited: false,
      updatedAt: new Date().toISOString(),
      accesses: study.configurationSnapshot.accesses.map((access) =>
        access.id === accessId
          ? {
              ...access,
              name: changes.name ?? access.name,
              lanes: changes.lanes === undefined ? access.lanes : Math.max(1, Math.trunc(changes.lanes)),
            }
          : access,
      ),
    },
  };

  return rebuildRowsWithConfiguration(next);
}

export function updateAccessMovement(study: Study, accessId: string, movement: MovementKey, enabled: boolean): Study {
  const next: Study = {
    ...study,
    configurationSnapshot: {
      ...study.configurationSnapshot,
      inherited: false,
      updatedAt: new Date().toISOString(),
      accesses: study.configurationSnapshot.accesses.map((access) =>
        access.id === accessId ? { ...access, movements: { ...access.movements, [movement]: enabled } } : access,
      ),
    },
  };

  return rebuildRowsWithConfiguration(next);
}

export function updateProgram(study: Study, programId: string, changes: Partial<Omit<SignalProgram, 'id' | 'phaseTimings'>>): Study {
  return withUpdatedAt({
    ...study,
    configurationSnapshot: {
      ...study.configurationSnapshot,
      inherited: false,
      updatedAt: new Date().toISOString(),
      programs: study.configurationSnapshot.programs.map((program) =>
        program.id === programId ? { ...program, ...changes } : program,
      ),
    },
  });
}

export function updateProgramPhaseCount(study: Study, programId: string, phaseCount: number): Study {
  const normalizedCount = Math.max(1, Math.min(8, Math.trunc(phaseCount)));
  return withUpdatedAt({
    ...study,
    configurationSnapshot: {
      ...study.configurationSnapshot,
      inherited: false,
      updatedAt: new Date().toISOString(),
      programs: study.configurationSnapshot.programs.map((program) => {
        if (program.id !== programId) return program;
        const existing = program.phaseTimings ?? [];
        const generated = createPhaseTimings(normalizedCount, program.cycleSeconds);
        const phaseTimings = Array.from({ length: normalizedCount }, (_, index) => existing[index] ?? generated[index]);
        return { ...program, phases: normalizedCount, phaseTimings };
      }),
    },
  });
}

export function updateProgramPhase(
  study: Study,
  programId: string,
  phaseId: string,
  changes: Partial<Omit<SignalPhaseTiming, 'id'>>,
): Study {
  return withUpdatedAt({
    ...study,
    configurationSnapshot: {
      ...study.configurationSnapshot,
      inherited: false,
      updatedAt: new Date().toISOString(),
      programs: study.configurationSnapshot.programs.map((program) =>
        program.id === programId
          ? { ...program, phaseTimings: program.phaseTimings.map((phase) => (phase.id === phaseId ? { ...phase, ...changes } : phase)) }
          : program,
      ),
    },
  });
}

export function addSignalMovementAssignment(study: Study): Study {
  const existing = study.configurationSnapshot.signalMovementAssignments ?? [];
  const access = study.configurationSnapshot.accesses[0];
  const program = study.configurationSnapshot.programs[0];
  const phase = program?.phaseTimings[0];
  if (!access || !program || !phase) return study;

  const nextNumber = existing.reduce((maximum, assignment) => {
    const match = assignment.id.match(/signal-group-(\d+)$/);
    return match ? Math.max(maximum, Number(match[1])) : maximum;
  }, 0) + 1;
  const preferredMovement: MovementKey = access.movements.through
    ? 'through'
    : (Object.entries(access.movements).find(([, enabled]) => enabled)?.[0] as MovementKey | undefined) ?? 'through';
  const assignment: SignalMovementAssignment = {
    id: `signal-group-${nextNumber}`,
    accessId: access.id,
    movement: preferredMovement,
    programId: program.id,
    phaseId: phase.id,
    lanes: null,
    saturationFlowPerLane: null,
    effectiveGreenSeconds: null,
  };

  return withUpdatedAt({
    ...study,
    configurationSnapshot: {
      ...study.configurationSnapshot,
      inherited: false,
      updatedAt: new Date().toISOString(),
      signalMovementAssignments: [...existing, assignment],
    },
  });
}

export function updateSignalMovementAssignment(
  study: Study,
  assignmentId: string,
  changes: Partial<Omit<SignalMovementAssignment, 'id'>>,
): Study {
  const assignments = study.configurationSnapshot.signalMovementAssignments ?? [];
  return withUpdatedAt({
    ...study,
    configurationSnapshot: {
      ...study.configurationSnapshot,
      inherited: false,
      updatedAt: new Date().toISOString(),
      signalMovementAssignments: assignments.map((assignment) =>
        assignment.id === assignmentId ? { ...assignment, ...changes } : assignment,
      ),
    },
  });
}

export function removeSignalMovementAssignment(study: Study, assignmentId: string): Study {
  const assignments = study.configurationSnapshot.signalMovementAssignments ?? [];
  return withUpdatedAt({
    ...study,
    configurationSnapshot: {
      ...study.configurationSnapshot,
      inherited: false,
      updatedAt: new Date().toISOString(),
      signalMovementAssignments: assignments.filter((assignment) => assignment.id !== assignmentId),
    },
  });
}

export function validateStudy(study: Study, captureComplete: boolean, confirmLegacy = false): Study {
  const isObserved = (study.source ?? 'observed') === 'observed';
  const legacyApproved = !study.legacyUnverified || confirmLegacy;
  const validated = isObserved && captureComplete && legacyApproved;

  return {
    ...study,
    status: validated ? 'validated' : 'incomplete',
    legacyUnverified: validated ? false : study.legacyUnverified,
    updatedAt: new Date().toISOString(),
  };
}

export function markStudyExported(study: Study): Study {
  return {
    ...study,
    status: study.status === 'validated' ? 'exported' : 'incomplete',
    updatedAt: new Date().toISOString(),
  };
}
