import { createDefaultStudyMetadata } from './study';
import type { StoredState, Study, StudyMetadata, VersionedStoredState } from './types';

export const STORAGE_KEY = 'aforos.state.v1';

const LEGACY_STEP_TO_STUDY_FIRST_STEP = [1, 2, 3, 0, 4, 5, 6, 7] as const;

function defaultStudiesByIntersection(activeStudy: Study | null): Record<string, Study> {
  if (!activeStudy || activeStudy.intersectionId.startsWith('__')) {
    return {};
  }

  return { [activeStudy.intersectionId]: activeStudy };
}

function defaultStudyTemplate(activeStudy: Study | null): StudyMetadata {
  return activeStudy?.metadata ? { ...activeStudy.metadata } : createDefaultStudyMetadata();
}

function migrateLegacyWizardStep(study: Study | null): Study | null {
  if (!study) {
    return null;
  }

  const currentStep = LEGACY_STEP_TO_STUDY_FIRST_STEP[study.currentStep] ?? 0;
  return { ...study, currentStep };
}

export function createInitialState(): StoredState {
  return {
    catalogVersion: '2026-09-25',
    customIntersections: [],
    intersectionConfigs: {},
    lastConfiguration: null,
    activeStudy: null,
    studyTemplate: createDefaultStudyMetadata(),
    studiesByIntersection: {},
    preferences: { intervalMinutes: 15 },
  };
}

export function saveStoredState(state: StoredState): void {
  const payload: VersionedStoredState = {
    schemaVersion: 1,
    ...state,
    customIntersections: state.customIntersections ?? [],
    studyTemplate: state.studyTemplate ?? defaultStudyTemplate(state.activeStudy),
    studiesByIntersection: state.studiesByIntersection ?? defaultStudiesByIntersection(state.activeStudy),
  };

  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

export function loadStoredState(): VersionedStoredState {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return { schemaVersion: 1, ...createInitialState() };
  }

  try {
    const parsed = JSON.parse(raw) as VersionedStoredState;
    if (parsed.schemaVersion !== 1) {
      return { schemaVersion: 1, ...createInitialState() };
    }

    const isLegacyWizardState = parsed.studyTemplate === undefined && parsed.studiesByIntersection === undefined;
    const activeStudy = isLegacyWizardState ? migrateLegacyWizardStep(parsed.activeStudy) : parsed.activeStudy;

    return {
      ...parsed,
      activeStudy,
      customIntersections: parsed.customIntersections ?? [],
      studyTemplate: parsed.studyTemplate ?? defaultStudyTemplate(activeStudy),
      studiesByIntersection: parsed.studiesByIntersection ?? defaultStudiesByIntersection(activeStudy),
    };
  } catch {
    return { schemaVersion: 1, ...createInitialState() };
  }
}
