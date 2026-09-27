import type { AccessConfig, IntersectionConfig, MovementKey, SignalPhaseTiming, SignalProgram, Study } from './types';
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
      cycleSeconds: 90,
      phases: 2,
      greenSeconds: 40,
      amberSeconds: 3,
      redSeconds: 47,
      clearanceSeconds: null,
      phaseTimings: createPhaseTimings(2, 90),
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
    amberSeconds: 3,
    redSeconds: null,
  }));
}

export function createDefaultConfiguration(intersectionId: string, inherited = false): IntersectionConfig {
  return {
    intersectionId,
    inherited,
    accesses: createDefaultAccesses(),
    programs: createDefaultPrograms(),
    updatedAt: new Date().toISOString(),
  };
}

export function createDefaultStudy(intersectionId: string): Study {
  const configurationSnapshot = createDefaultConfiguration(intersectionId);
  const intervals = generateIntervals('07:00', '09:00', 15);
  const now = new Date().toISOString();

  return {
    id: `AF-${now.slice(0, 10).replaceAll('-', '')}-${intersectionId}`,
    intersectionId,
    currentStep: 0,
    metadata: {
      date: now.slice(0, 10),
      startTime: '07:00',
      endTime: '09:00',
      intervalMinutes: 15,
      surveyor: '',
      weather: '',
      notes: '',
    },
    configurationSnapshot,
    intervals,
    rows: createEmptyCaptureRows(intervals, configurationSnapshot.accesses),
    status: 'draft',
    createdAt: now,
    updatedAt: now,
  };
}

export function rebuildStudyRows(study: Study): Study {
  const intervals = generateIntervals(study.metadata.startTime, study.metadata.endTime, study.metadata.intervalMinutes);

  return {
    ...study,
    intervals,
    rows: createEmptyCaptureRows(intervals, study.configurationSnapshot.accesses),
    updatedAt: new Date().toISOString(),
  };
}

function withUpdatedAt(study: Study): Study {
  return { ...study, updatedAt: new Date().toISOString() };
}

function rebuildRowsWithConfiguration(study: Study): Study {
  return {
    ...study,
    rows: createEmptyCaptureRows(study.intervals, study.configurationSnapshot.accesses),
    updatedAt: new Date().toISOString(),
  };
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
        access.id === accessId
          ? {
              ...access,
              movements: { ...access.movements, [movement]: enabled },
            }
          : access,
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
      updatedAt: new Date().toISOString(),
      programs: study.configurationSnapshot.programs.map((program) =>
        program.id === programId
          ? {
              ...program,
              ...changes,
            }
          : program,
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
      updatedAt: new Date().toISOString(),
      programs: study.configurationSnapshot.programs.map((program) => {
        if (program.id !== programId) {
          return program;
        }

        const existing = program.phaseTimings ?? [];
        const phaseTimings = Array.from({ length: normalizedCount }, (_, index) => {
          return existing[index] ?? createPhaseTimings(normalizedCount, program.cycleSeconds)[index];
        });

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
      updatedAt: new Date().toISOString(),
      programs: study.configurationSnapshot.programs.map((program) =>
        program.id === programId
          ? {
              ...program,
              phaseTimings: program.phaseTimings.map((phase) => (phase.id === phaseId ? { ...phase, ...changes } : phase)),
            }
          : program,
      ),
    },
  });
}
