import { createDefaultStudyMetadata } from './study';
import type { StoredState, Study, StudyMetadata, VersionedStoredState } from './types';

export const STORAGE_KEY = 'aforos.state.v1';

function defaultStudiesByIntersection(activeStudy: Study | null): Record<string, Study> {
  if (!activeStudy || activeStudy.intersectionId.startsWith('__')) {
    return {};
  }

  return { [activeStudy.intersectionId]: activeStudy };
}

function defaultStudyTemplate(activeStudy: Study | null): StudyMetadata {
  return activeStudy?.metadata ? { ...activeStudy.metadata } : createDefaultStudyMetadata();
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

    return {
      ...parsed,
      customIntersections: parsed.customIntersections ?? [],
      studyTemplate: parsed.studyTemplate ?? defaultStudyTemplate(parsed.activeStudy),
      studiesByIntersection: parsed.studiesByIntersection ?? defaultStudiesByIntersection(parsed.activeStudy),
    };
  } catch {
    return { schemaVersion: 1, ...createInitialState() };
  }
}
