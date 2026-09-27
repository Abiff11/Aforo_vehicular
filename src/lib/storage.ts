import type { StoredState, VersionedStoredState } from './types';

export const STORAGE_KEY = 'aforos.state.v1';

export function createInitialState(): StoredState {
  return {
    catalogVersion: '2026-09-25',
    customIntersections: [],
    intersectionConfigs: {},
    lastConfiguration: null,
    activeStudy: null,
    preferences: { intervalMinutes: 15 },
  };
}

export function saveStoredState(state: StoredState): void {
  const payload: VersionedStoredState = {
    schemaVersion: 1,
    ...state,
    customIntersections: state.customIntersections ?? [],
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
    };
  } catch {
    return { schemaVersion: 1, ...createInitialState() };
  }
}
