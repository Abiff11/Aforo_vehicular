import { createDefaultStudyMetadata } from './study';
import type { IntersectionConfig, StoredState, Study, StudyMetadata, VersionedStoredState } from './types';

export const STORAGE_KEY = 'aforos.state.v1';

const LEGACY_STEP_TO_STUDY_FIRST_STEP = [1, 2, 3, 0, 4, 5, 6, 7] as const;

function defaultStudiesByIntersection(activeStudy: Study | null): Record<string, Study> {
  if (!activeStudy || activeStudy.intersectionId.startsWith('__')) return {};
  return { [activeStudy.intersectionId]: activeStudy };
}

function defaultStudyTemplate(activeStudy: Study | null): StudyMetadata {
  return activeStudy?.metadata ? { ...activeStudy.metadata } : createDefaultStudyMetadata();
}

function migrateConfig(config: IntersectionConfig): IntersectionConfig {
  return {
    ...config,
    signalMovementAssignments: config.signalMovementAssignments ?? [],
  };
}

function migrateStudy(study: Study, legacyUnverified: boolean, remapWizardStep: boolean): Study {
  const currentStep = remapWizardStep ? (LEGACY_STEP_TO_STUDY_FIRST_STEP[study.currentStep] ?? 0) : study.currentStep;
  return {
    ...study,
    currentStep,
    source: study.source ?? 'observed',
    tdpaEstimate: study.tdpaEstimate ?? null,
    legacyUnverified: legacyUnverified || study.legacyUnverified === true,
    configurationSnapshot: migrateConfig(study.configurationSnapshot),
  };
}

function migrateStudies(
  studies: Record<string, Study> | undefined,
  legacyUnverified: boolean,
  remapWizardStep: boolean,
): Record<string, Study> {
  return Object.fromEntries(
    Object.entries(studies ?? {}).map(([intersectionId, study]) => [
      intersectionId,
      migrateStudy(study, legacyUnverified, remapWizardStep),
    ]),
  );
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
    schemaVersion: 2,
    ...state,
    customIntersections: state.customIntersections ?? [],
    studyTemplate: state.studyTemplate ?? defaultStudyTemplate(state.activeStudy),
    studiesByIntersection: state.studiesByIntersection ?? defaultStudiesByIntersection(state.activeStudy),
  };

  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

export function loadStoredState(): VersionedStoredState {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return { schemaVersion: 2, ...createInitialState() };

  try {
    const parsed = JSON.parse(raw) as VersionedStoredState;
    if (parsed.schemaVersion !== 1 && parsed.schemaVersion !== 2) {
      return { schemaVersion: 2, ...createInitialState() };
    }

    const isSchema1 = parsed.schemaVersion === 1;
    const isLegacyWizardState = isSchema1 && parsed.studyTemplate === undefined && parsed.studiesByIntersection === undefined;
    const activeStudy = parsed.activeStudy
      ? migrateStudy(parsed.activeStudy, isSchema1, isLegacyWizardState)
      : null;
    const originalStudies = parsed.studiesByIntersection ?? defaultStudiesByIntersection(parsed.activeStudy);
    const studiesByIntersection = migrateStudies(originalStudies, isSchema1, isLegacyWizardState);
    if (activeStudy && !activeStudy.intersectionId.startsWith('__')) {
      studiesByIntersection[activeStudy.intersectionId] = activeStudy;
    }

    const intersectionConfigs = Object.fromEntries(
      Object.entries(parsed.intersectionConfigs ?? {}).map(([intersectionId, config]) => [intersectionId, migrateConfig(config)]),
    );

    return {
      ...parsed,
      schemaVersion: 2,
      activeStudy,
      customIntersections: parsed.customIntersections ?? [],
      intersectionConfigs,
      lastConfiguration: parsed.lastConfiguration ? migrateConfig(parsed.lastConfiguration) : null,
      studyTemplate: parsed.studyTemplate ?? defaultStudyTemplate(activeStudy),
      studiesByIntersection,
    };
  } catch {
    return { schemaVersion: 2, ...createInitialState() };
  }
}
