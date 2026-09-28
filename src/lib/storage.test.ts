import { beforeEach, describe, expect, it } from 'vitest';
import { addSignalMovementAssignment, createDefaultStudy, updateProgram } from './study';
import { createInitialState, loadStoredState, saveStoredState, STORAGE_KEY } from './storage';

describe('local storage persistence', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('starts with shared study metadata and an empty manually created intersection list', () => {
    const state = createInitialState();

    expect(state.studyTemplate).toMatchObject({
      startTime: '07:00',
      endTime: '09:00',
      intervalMinutes: 15,
      surveyor: '',
      weather: '',
    });
    expect(state.studyTemplate).not.toHaveProperty('observedSaturationFlowPerLane');
    expect(state.catalogVersion).toBe('manual-map-v1');
    expect(state.customIntersections).toEqual([]);
    expect(state.studiesByIntersection).toEqual({});
  });

  it('round-trips current state with schema version 3', () => {
    const study = createDefaultStudy('INT-001');
    const state = {
      ...createInitialState(),
      activeStudy: study,
      studiesByIntersection: { 'INT-001': study },
    };

    saveStoredState(state);

    expect(loadStoredState()).toMatchObject({
      schemaVersion: 3,
      catalogVersion: 'manual-map-v1',
      activeStudy: {
        intersectionId: 'INT-001',
        currentStep: 0,
        status: 'draft',
        source: 'observed',
        legacyUnverified: false,
      },
      studiesByIntersection: {
        'INT-001': { intersectionId: 'INT-001', status: 'draft', source: 'observed' },
      },
      preferences: { intervalMinutes: 15 },
    });
  });

  it('removes the old seeded catalog while preserving intersections created after it', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        schemaVersion: 3,
        ...createInitialState(),
        catalogVersion: '2026-09-25',
        customIntersections: [
          {
            id: 'INT-001',
            mapNumber: 1,
            name: 'Intersección precargada',
            municipality: 'Oaxaca de Juárez',
            locality: 'Oaxaca de Juárez',
            verificationStatus: 'verified',
            latitude: 17.07,
            longitude: -96.72,
            notes: '',
          },
          {
            id: 'INT-047',
            mapNumber: 47,
            name: 'Intersección precargada 47',
            municipality: 'Oaxaca de Juárez',
            locality: 'Oaxaca de Juárez',
            verificationStatus: 'verified',
            latitude: 17.05,
            longitude: -96.70,
            notes: '',
          },
          {
            id: 'INT-048',
            mapNumber: 48,
            name: 'Punto creado por el usuario',
            municipality: 'Oaxaca de Juárez',
            locality: 'Oaxaca de Juárez',
            verificationStatus: 'pending',
            latitude: 17.06,
            longitude: -96.73,
            notes: '',
          },
        ],
      }),
    );

    const loaded = loadStoredState();
    const loadedIntersections = loaded.customIntersections ?? [];

    expect(loaded.catalogVersion).toBe('manual-map-v1');
    expect(loadedIntersections).toHaveLength(1);
    expect(loadedIntersections[0]).toMatchObject({ id: 'INT-048', name: 'Punto creado por el usuario' });
  });

  it('keeps manually created low-numbered intersections after migration is complete', () => {
    const manualIntersection = {
      id: 'INT-001',
      mapNumber: 1,
      name: 'Punto manual',
      municipality: 'Oaxaca de Juárez',
      locality: 'Oaxaca de Juárez',
      verificationStatus: 'pending' as const,
      latitude: 17.06,
      longitude: -96.73,
      notes: '',
    };
    saveStoredState({ ...createInitialState(), customIntersections: [manualIntersection] });

    expect(loadStoredState().customIntersections).toEqual([manualIntersection]);
  });

  it('migrates schema 2 by dropping global saturation and preserving lane-group saturation with unknown origin', () => {
    const study = addSignalMovementAssignment(createDefaultStudy('INT-004'));
    const assignment = study.configurationSnapshot.signalMovementAssignments![0];
    const legacyAssignment = {
      ...assignment,
      saturationSource: undefined,
      saturationFlowPerLane: 1750,
    };
    const legacyMetadata = { ...study.metadata, observedSaturationFlowPerLane: 1900 };
    const legacyStudy = {
      ...study,
      metadata: legacyMetadata,
      configurationSnapshot: {
        ...study.configurationSnapshot,
        signalMovementAssignments: [legacyAssignment],
      },
    };

    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        schemaVersion: 2,
        ...createInitialState(),
        activeStudy: legacyStudy,
        studyTemplate: legacyMetadata,
        studiesByIntersection: { 'INT-004': legacyStudy },
      }),
    );

    const loaded = loadStoredState();
    expect(loaded.schemaVersion).toBe(3);
    expect(loaded.studyTemplate).not.toHaveProperty('observedSaturationFlowPerLane');
    expect(loaded.activeStudy?.metadata).not.toHaveProperty('observedSaturationFlowPerLane');
    expect(loaded.activeStudy?.configurationSnapshot.signalMovementAssignments?.[0]).toMatchObject({
      saturationFlowPerLane: 1750,
      saturationSource: 'unknown',
    });
  });

  it('migrates schema 1 non-destructively and marks historical zero rows as unverified', () => {
    let activeStudy = { ...createDefaultStudy('INT-009'), currentStep: 3 };
    activeStudy = updateProgram(activeStudy, 'p1', { cycleSeconds: 90, greenSeconds: 40, amberSeconds: 3, redSeconds: 47 });
    activeStudy = {
      ...activeStudy,
      rows: activeStudy.rows.map((row) => ({
        ...row,
        left: row.left ?? 0,
        through: row.through ?? 0,
        right: row.right ?? 0,
        heavy: row.heavy ?? 0,
        motorcycles: row.motorcycles ?? 0,
        bicycles: row.bicycles ?? 0,
        pedestrians: row.pedestrians ?? 0,
      })),
    };
    const legacy = {
      ...activeStudy,
      source: undefined,
      tdpaEstimate: undefined,
      legacyUnverified: undefined,
      configurationSnapshot: {
        ...activeStudy.configurationSnapshot,
        signalMovementAssignments: undefined,
      },
    };

    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        schemaVersion: 1,
        catalogVersion: '2026-09-25',
        customIntersections: [],
        intersectionConfigs: {},
        lastConfiguration: null,
        activeStudy: legacy,
        preferences: { intervalMinutes: 15 },
      }),
    );

    const loaded = loadStoredState();

    expect(loaded.schemaVersion).toBe(3);
    expect(loaded.activeStudy).toMatchObject({
      intersectionId: 'INT-009',
      currentStep: 0,
      source: 'observed',
      legacyUnverified: true,
    });
    expect(loaded.activeStudy?.rows[0]).toMatchObject({ left: 0, through: 0, right: 0 });
    expect(loaded.activeStudy?.configurationSnapshot.programs[0].greenSeconds).toBe(40);
    expect(loaded.activeStudy?.configurationSnapshot.signalMovementAssignments).toEqual([]);
    expect(loaded.studyTemplate).toMatchObject({ intervalMinutes: 15, startTime: '07:00' });
    expect(loaded.studiesByIntersection?.['INT-009']).toMatchObject({
      intersectionId: 'INT-009',
      currentStep: 0,
      legacyUnverified: true,
    });
  });
});
