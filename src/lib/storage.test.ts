import { beforeEach, describe, expect, it } from 'vitest';
import { createDefaultStudy } from './study';
import { loadStoredState, saveStoredState } from './storage';

describe('local storage persistence', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('round-trips active study state with a schema version', () => {
    const state = {
      catalogVersion: '2026-09-25',
      intersectionConfigs: {},
      lastConfiguration: null,
      activeStudy: createDefaultStudy('INT-001'),
      preferences: { intervalMinutes: 15 },
    };

    saveStoredState(state);

    expect(loadStoredState()).toMatchObject({
      schemaVersion: 1,
      activeStudy: { intersectionId: 'INT-001', currentStep: 0, status: 'draft' },
      preferences: { intervalMinutes: 15 },
    });
  });
});
