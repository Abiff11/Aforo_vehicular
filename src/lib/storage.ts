import { createDefaultStudyMetadata } from './study';
import type { Intersection, IntersectionConfig, StoredState, Study, StudyMetadata, VersionedStoredState } from './types';

export const STORAGE_KEY = 'aforos.state.v1';

const LEGACY_STEP_TO_STUDY_FIRST_STEP = [1, 2, 3, 0, 4, 5, 6, 7] as const;
const LEGACY_CATALOG_VERSION = '2026-09-25';
const MANUAL_MAP_VERSION = 'manual-map-v1';
const LEGACY_CATALOG_IDS = new Set(
  Array.from({ length: 47 }, (_, index) => `INT-${String(index + 1).padStart(3, '0')}`),
);

function defaultStudiesByIntersection(activeStudy: Study | null): Record<string, Study> {
  if (!activeStudy || activeStudy.intersectionId.startsWith('__')) return {};
  return { [activeStudy.intersectionId]: activeStudy };
}

function migrateIntersections(savedIntersections: Intersection[] | undefined, catalogVersion: string | undefined): Intersection[] {
  const saved = savedIntersections ?? [];
  if (catalogVersion !== LEGACY_CATALOG_VERSION) return saved;
  return saved.filter((intersection) => !LEGACY_CATALOG_IDS.has(intersection.id));
}

function migrateMetadata(metadata: StudyMetadata): StudyMetadata {
  return {
    date: metadata.date,
    startTime: metadata.startTime,
    endTime: metadata.endTime,
    intervalMinutes: metadata.intervalMinutes,
    surveyor: metadata.surveyor,
    weather: metadata.weather,
    notes: metadata.notes ?? '',
  };
}

function defaultStudyTemplate(activeStudy: Study | null): StudyMetadata {
  return activeStudy?.metadata ? migrateMetadata(activeStudy.metadata) : createDefaultStudyMetadata();
}

function migrateConfig(config: IntersectionConfig): IntersectionConfig {
  return {
    ...config,
    signalMovementAssignments: (config.signalMovementAssignments ?? []).map((assignment) => ({
      ...assignment,
      saturationSource: assignment.saturationSource ?? 'unknown',
    })),
  };
}

function migrateStudy(study: Study, legacyUnverified: boolean, remapWizardStep: boolean): Study {
  const currentStep = remapWizardStep ? (LEGACY_STEP_TO_STUDY_FIRST_STEP[study.currentStep] ?? 0) : study.currentStep;
  return {
    ...study,
    currentStep,
    metadata: migrateMetadata(study.metadata),
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
    catalogVersion: MANUAL_MAP_VERSION,
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
    schemaVersion: 3,
    ...state,
    catalogVersion: MANUAL_MAP_VERSION,
    customIntersections: state.customIntersections ?? [],
    studyTemplate: migrateMetadata(state.studyTemplate ?? defaultStudyTemplate(state.activeStudy)),
    studiesByIntersection: state.studiesByIntersection ?? defaultStudiesByIntersection(state.activeStudy),
  };

  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

export function loadStoredState(): VersionedStoredState {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return { schemaVersion: 3, ...createInitialState() };

  try {
    const parsed = JSON.parse(raw) as VersionedStoredState;
    if (parsed.schemaVersion !== 1 && parsed.schemaVersion !== 2 && parsed.schemaVersion !== 3) {
      return { schemaVersion: 3, ...createInitialState() };
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
      schemaVersion: 3,
      catalogVersion: MANUAL_MAP_VERSION,
      activeStudy,
      customIntersections: migrateIntersections(parsed.customIntersections, parsed.catalogVersion),
      intersectionConfigs,
      lastConfiguration: parsed.lastConfiguration ? migrateConfig(parsed.lastConfiguration) : null,
      studyTemplate: parsed.studyTemplate ? migrateMetadata(parsed.studyTemplate) : defaultStudyTemplate(activeStudy),
      studiesByIntersection,
    };
  } catch {
    return { schemaVersion: 3, ...createInitialState() };
  }
}
