import { beforeEach, describe, expect, it } from 'vitest';
import { createDefaultStudy } from './study';
import { createInitialState, loadStoredState, saveStoredState, STORAGE_KEY } from './storage';

describe('local storage persistence', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('starts with shared study metadata and an empty per-intersection study registry', () => {
    const state = createInitialState();

    expect(state.studyTemplate).toMatchObject({
      startTime: '07:00',
      endTime: '09:00',
      intervalMinutes: 15,
      surveyor: '',
      weather: '',
    });
    expect(state.studiesByIntersection).toEqual({});
  });

  it('round-trips active study state and studies by intersection with a schema version', () => {
    const study = createDefaultStudy('INT-001');
    const state = {
      ...createInitialState(),
      activeStudy: study,
      studiesByIntersection: { 'INT-001': study },
    };

    saveStoredState(state);

    expect(loadStoredState()).toMatchObject({
      schemaVersion: 1,
      activeStudy: { intersectionId: 'INT-001', currentStep: 0, status: 'draft' },
      studiesByIntersection: {
        'INT-001': { intersectionId: 'INT-001', status: 'draft' },
      },
      preferences: { intervalMinutes: 15 },
    });
  });

  it('upgrades an older payload without discarding its existing active study', () => {
    const activeStudy = createDefaultStudy('INT-009');
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        schemaVersion: 1,
        catalogVersion: '2026-09-25',
        customIntersections: [],
        intersectionConfigs: {},
        lastConfiguration: null,
        activeStudy,
        preferences: { intervalMinutes: 15 },
      }),
    );

    const loaded = loadStoredState();

    expect(loaded.activeStudy?.intersectionId).toBe('INT-009');
    expect(loaded.studyTemplate).toMatchObject({ intervalMinutes: 15, startTime: '07:00' });
    expect(loaded.studiesByIntersection).toEqual({ 'INT-009': activeStudy });
  });
});
