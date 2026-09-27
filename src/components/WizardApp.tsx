import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  CircleHelp,
  Download,
  Eraser,
  Save,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { wizardSteps } from '../data/tutorial';
import { calculateRowMotorizedTotal, calculateStudySummary } from '../lib/calculations';
import { downloadStudyWorkbook } from '../lib/exportExcel';
import {
  calculateRoadTrafficProfile,
  createTrafficStudyForIntersection,
  parseRoadTrafficCsv,
} from '../lib/roadTrafficImport';
import {
  addSignalMovementAssignment,
  createDefaultStudy,
  createDefaultStudyMetadata,
  hasCapturedData,
  markStudyExported,
  rebuildStudyRows,
  removeSignalMovementAssignment,
  updateAccessConfig,
  updateAccessMovement,
  updateProgram,
  updateProgramPhase,
  updateProgramPhaseCount,
  updateSignalMovementAssignment,
  validateStudy,
} from '../lib/study';
import { createInitialState, loadStoredState, saveStoredState, STORAGE_KEY } from '../lib/storage';
import type { CorridorTrafficStudy, RoadTrafficProfile } from '../lib/roadTrafficImport';
import type {
  CaptureRow,
  Intersection,
  MovementKey,
  SignalMovementAssignment,
  StoredState,
  Study,
  StudyMetadata,
} from '../lib/types';
import { IntersectionMap } from './IntersectionMap';
import { ResultsDashboard } from './ResultsDashboard';

const movementLabels: Record<MovementKey, string> = {
  left: 'Izq',
  through: 'Frente',
  right: 'Der',
  uTurn: 'Retorno',
};

const fullMovementLabels: Record<MovementKey, string> = {
  left: 'Izquierda',
  through: 'Frente',
  right: 'Derecha',
  uTurn: 'Retorno',
};

const UNASSIGNED_INTERSECTION_ID = '__UNASSIGNED__';

interface RoadTrafficImportState {
  fileName: string;
  corridorName: string;
  point: string;
  profile: RoadTrafficProfile;
  studies: CorridorTrafficStudy[];
}

function getInitialState(): StoredState {
  if (typeof localStorage === 'undefined') return createInitialState();
  return loadStoredState();
}

function updateStudyRow(study: Study, rowId: string, field: keyof CaptureRow, rawValue: string): Study {
  const numericFields: Array<keyof CaptureRow> = [
    'left',
    'through',
    'right',
    'uTurn',
    'heavy',
    'motorcycles',
    'bicycles',
    'pedestrians',
    'maxQueue',
    'averageQueue',
    'queueLength',
    'stoppedVehiclesPerCycle',
    'observedCycle',
  ];
  const value = numericFields.includes(field) ? (rawValue === '' ? null : Number(rawValue)) : rawValue;
  return {
    ...study,
    status: study.status === 'validated' || study.status === 'exported' ? 'draft' : study.status,
    rows: study.rows.map((row) => (row.id === rowId ? { ...row, [field]: value } : row)),
    updatedAt: new Date().toISOString(),
  };
}

function applyStudyMetadata(study: Study, metadata: StudyMetadata, rebuildRows: boolean): Study {
  const next: Study = {
    ...study,
    status: study.status === 'validated' || study.status === 'exported' ? 'draft' : study.status,
    metadata: { ...metadata },
    updatedAt: new Date().toISOString(),
  };
  if (!rebuildRows) return next;

  try {
    return rebuildStudyRows(next);
  } catch {
    return next;
  }
}

function readFileText(file: File): Promise<string> {
  if (typeof file.text === 'function') return file.text();

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(new Error('No se pudo leer el archivo CSV.'));
    reader.readAsText(file);
  });
}

function parseOptionalNumber(value: string): number | null {
  return value === '' ? null : Number(value);
}

function createIntersection(latitude: number, longitude: number, existing: Intersection[]): Intersection {
  const mapNumber = existing.reduce((maximum, intersection) => Math.max(maximum, intersection.mapNumber), 0) + 1;
  const suffix = String(mapNumber).padStart(3, '0');
  return {
    id: `INT-${suffix}`,
    mapNumber,
    name: `Interseccion ${suffix}`,
    municipality: 'Oaxaca de Juárez',
    locality: 'Oaxaca de Juárez',
    verificationStatus: 'pending',
    latitude,
    longitude,
    notes: '',
    linkedCsvFileName: undefined,
    relatedIntersectionIds: [],
  };
}

function isAssignedStudy(study: Study): boolean {
  return !study.intersectionId.startsWith('__');
}

function studyStatusLabel(study: Study): string {
  if (study.status === 'validated') return 'Validado';
  if (study.status === 'exported') return 'Exportado';
  if (study.status === 'incomplete') return 'Incompleto';
  return 'Borrador';
}

export function WizardApp() {
  const [state, setState] = useState<StoredState>(getInitialState);
  const [helpStepIndex, setHelpStepIndex] = useState<number | null>(null);
  const [roadTrafficImport, setRoadTrafficImport] = useState<RoadTrafficImportState | null>(null);
  const [roadTrafficImportError, setRoadTrafficImportError] = useState<string | null>(null);

  const customIntersections = useMemo(() => state.customIntersections ?? [], [state.customIntersections]);
  const studiesByIntersection = useMemo(() => state.studiesByIntersection ?? {}, [state.studiesByIntersection]);
  const studyTemplate = useMemo(() => state.studyTemplate ?? createDefaultStudyMetadata(), [state.studyTemplate]);
  const activeStudy = state.activeStudy ?? createDefaultStudy(UNASSIGNED_INTERSECTION_ID, studyTemplate);
  const selectedIntersection = customIntersections.find((intersection) => intersection.id === activeStudy.intersectionId) ?? null;
  const activeHelp = helpStepIndex === null ? null : wizardSteps[helpStepIndex];

  const summary = useMemo(
    () =>
      calculateStudySummary(
        activeStudy.rows,
        activeStudy.configurationSnapshot.accesses,
        activeStudy.metadata.intervalMinutes,
        {
          programs: activeStudy.configurationSnapshot.programs,
          assignments: activeStudy.configurationSnapshot.signalMovementAssignments ?? [],
          observedSaturationFlowPerLane: activeStudy.metadata.observedSaturationFlowPerLane,
        },
      ),
    [activeStudy],
  );

  const relatedIntersectionIds = selectedIntersection?.relatedIntersectionIds ?? activeStudy.relatedIntersectionIds ?? [];
  const linkedIntersectionOptions = useMemo(
    () => customIntersections
      .filter((intersection) => intersection.id !== selectedIntersection?.id)
      .sort((left, right) => left.mapNumber - right.mapNumber),
    [customIntersections, selectedIntersection?.id],
  );

  function persist(nextState: StoredState): void {
    setState(nextState);
    saveStoredState(nextState);
  }

  function setActiveStudy(study: Study): void {
    const nextStudies = { ...studiesByIntersection };
    if (isAssignedStudy(study)) nextStudies[study.intersectionId] = study;
    persist({ ...state, activeStudy: study, studiesByIntersection: nextStudies });
  }

  function updateSharedMetadata(field: keyof StudyMetadata, value: string | number | null): void {
    const nextTemplate = { ...studyTemplate, [field]: value } as StudyMetadata;
    const rebuildRows = ['startTime', 'endTime', 'intervalMinutes'].includes(field);
    const studiesWithCapture = [activeStudy, ...Object.values(studiesByIntersection)].filter(
      (study, index, all) => isAssignedStudy(study) && all.findIndex((candidate) => candidate.id === study.id) === index && hasCapturedData(study),
    );

    if (
      rebuildRows &&
      studiesWithCapture.length > 0 &&
      !window.confirm('Ya existen datos capturados. Cambiar el periodo o intervalo regenerará la tabla conservando sólo las filas compatibles. ¿Continuar?')
    ) {
      return;
    }

    const nextStudies = Object.fromEntries(
      Object.entries(studiesByIntersection).map(([intersectionId, study]) => [
        intersectionId,
        applyStudyMetadata(study, nextTemplate, rebuildRows),
      ]),
    );
    const nextActiveStudy = isAssignedStudy(activeStudy)
      ? (nextStudies[activeStudy.intersectionId] ?? applyStudyMetadata(activeStudy, nextTemplate, rebuildRows))
      : applyStudyMetadata(activeStudy, nextTemplate, rebuildRows);

    persist({
      ...state,
      studyTemplate: nextTemplate,
      studiesByIntersection: nextStudies,
      activeStudy: nextActiveStudy,
      preferences: { ...state.preferences, intervalMinutes: nextTemplate.intervalMinutes },
    });
  }

  function buildStudyForIntersection(intersection: Intersection): Study {
    const storedStudy = studiesByIntersection[intersection.id];
    if (storedStudy) {
      return {
        ...storedStudy,
        currentStep: 1,
        metadata: { ...studyTemplate },
        relatedIntersectionIds: intersection.relatedIntersectionIds ?? storedStudy.relatedIntersectionIds,
        updatedAt: new Date().toISOString(),
      };
    }

    const existingConfig = state.intersectionConfigs[intersection.id];
    const fallbackStudy = createDefaultStudy(intersection.id, studyTemplate);
    const configuredStudy = existingConfig
      ? { ...fallbackStudy, configurationSnapshot: existingConfig }
      : state.lastConfiguration
        ? {
            ...fallbackStudy,
            configurationSnapshot: {
              ...state.lastConfiguration,
              intersectionId: intersection.id,
              inherited: true,
              updatedAt: new Date().toISOString(),
            },
          }
        : fallbackStudy;

    const alignedStudy = rebuildStudyRows(configuredStudy);
    return {
      ...alignedStudy,
      currentStep: 1,
      relatedIntersectionIds: intersection.relatedIntersectionIds ?? [],
    };
  }

  function addIntersection(latitude: number, longitude: number): void {
    const intersection = createIntersection(latitude, longitude, customIntersections);
    const nextIntersections = [...customIntersections, intersection];
    const study = buildStudyForIntersection(intersection);
    setRoadTrafficImport(null);
    setRoadTrafficImportError(null);
    persist({
      ...state,
      customIntersections: nextIntersections,
      activeStudy: study,
      studiesByIntersection: { ...studiesByIntersection, [intersection.id]: study },
    });
  }

  function startStudy(intersectionId: string): void {
    const intersection = customIntersections.find((candidate) => candidate.id === intersectionId);
    if (!intersection || selectedIntersection?.id === intersectionId) return;
    const study = buildStudyForIntersection(intersection);
    setRoadTrafficImport(null);
    setRoadTrafficImportError(null);
    persist({
      ...state,
      activeStudy: study,
      studiesByIntersection: { ...studiesByIntersection, [intersection.id]: study },
    });
  }

  function updateIntersection(changes: Partial<Omit<Intersection, 'id' | 'mapNumber'>>): void {
    if (!selectedIntersection) return;
    const nextIntersections = customIntersections.map((intersection) =>
      intersection.id === selectedIntersection.id ? { ...intersection, ...changes } : intersection,
    );
    persist({ ...state, customIntersections: nextIntersections, activeStudy });
  }

  function renameIntersection(rawId: string): void {
    if (!selectedIntersection) return;
    const nextId = rawId.trim().toUpperCase();
    if (!nextId || nextId === selectedIntersection.id || customIntersections.some((intersection) => intersection.id === nextId)) return;

    const oldId = selectedIntersection.id;
    const remapRelated = (ids: string[]) => ids.map((id) => (id === oldId ? nextId : id));
    const nextIntersections = customIntersections.map((intersection) => ({
      ...intersection,
      id: intersection.id === oldId ? nextId : intersection.id,
      relatedIntersectionIds: remapRelated(intersection.relatedIntersectionIds ?? []),
    }));

    const existingConfig = state.intersectionConfigs[oldId];
    const nextConfigs = { ...state.intersectionConfigs };
    if (existingConfig) {
      delete nextConfigs[oldId];
      nextConfigs[nextId] = { ...existingConfig, intersectionId: nextId };
    }

    const nextStudies: Record<string, Study> = {};
    for (const [intersectionId, study] of Object.entries(studiesByIntersection)) {
      const renamed = intersectionId === oldId;
      const nextStudyId = renamed ? nextId : intersectionId;
      nextStudies[nextStudyId] = {
        ...study,
        intersectionId: renamed ? nextId : study.intersectionId,
        relatedIntersectionIds: remapRelated(study.relatedIntersectionIds),
        configurationSnapshot: renamed ? { ...study.configurationSnapshot, intersectionId: nextId } : study.configurationSnapshot,
        updatedAt: new Date().toISOString(),
      };
    }

    const nextStudy = nextStudies[nextId] ?? {
      ...activeStudy,
      intersectionId: nextId,
      relatedIntersectionIds: remapRelated(activeStudy.relatedIntersectionIds),
      configurationSnapshot: { ...activeStudy.configurationSnapshot, intersectionId: nextId },
      updatedAt: new Date().toISOString(),
    };
    nextStudies[nextId] = nextStudy;

    persist({
      ...state,
      customIntersections: nextIntersections,
      intersectionConfigs: nextConfigs,
      studiesByIntersection: nextStudies,
      activeStudy: nextStudy,
      lastConfiguration: state.lastConfiguration?.intersectionId === oldId
        ? { ...state.lastConfiguration, intersectionId: nextId }
        : state.lastConfiguration,
    });
  }

  function toggleRelatedIntersection(intersectionId: string): void {
    if (!selectedIntersection) return;
    const nextRelatedIntersectionIds = relatedIntersectionIds.includes(intersectionId)
      ? relatedIntersectionIds.filter((id) => id !== intersectionId)
      : [...relatedIntersectionIds, intersectionId];
    const nextIntersections = customIntersections.map((intersection) =>
      intersection.id === selectedIntersection.id
        ? { ...intersection, relatedIntersectionIds: nextRelatedIntersectionIds }
        : intersection,
    );
    const nextStudy = {
      ...activeStudy,
      relatedIntersectionIds: nextRelatedIntersectionIds,
      updatedAt: new Date().toISOString(),
    };
    persist({
      ...state,
      customIntersections: nextIntersections,
      activeStudy: nextStudy,
      studiesByIntersection: { ...studiesByIntersection, [nextStudy.intersectionId]: nextStudy },
    });
  }

  async function importRoadTrafficCsv(files: FileList | null): Promise<void> {
    const file = files?.[0];
    if (!file || !selectedIntersection) return;

    try {
      const [record] = parseRoadTrafficCsv(await readFileText(file));
      if (!record) throw new Error('El CSV no contiene registros de TDPA.');

      const linkedIntersection = { ...selectedIntersection, linkedCsvFileName: file.name };
      const imported = createTrafficStudyForIntersection(record, linkedIntersection, activeStudy);
      const nextIntersections = customIntersections.map((intersection) =>
        intersection.id === linkedIntersection.id ? linkedIntersection : intersection,
      );

      setRoadTrafficImport({
        fileName: file.name,
        corridorName: linkedIntersection.name,
        point: record.point,
        profile: calculateRoadTrafficProfile(record),
        studies: [imported],
      });
      setRoadTrafficImportError(null);
      persist({
        ...state,
        customIntersections: nextIntersections,
        activeStudy: imported.study,
        studiesByIntersection: { ...studiesByIntersection, [linkedIntersection.id]: imported.study },
      });
    } catch (error) {
      setRoadTrafficImport(null);
      setRoadTrafficImportError(error instanceof Error ? error.message : 'No se pudo importar el CSV TDPA.');
    }
  }

  function goToStep(index: number): void {
    if (!selectedIntersection && index > 1) return;
    setActiveStudy({ ...activeStudy, currentStep: Math.max(0, Math.min(index, wizardSteps.length - 1)) });
  }

  function saveConfiguration(): void {
    if (!selectedIntersection) return;
    const config = { ...activeStudy.configurationSnapshot, inherited: false, updatedAt: new Date().toISOString() };
    const nextStudy = { ...activeStudy, configurationSnapshot: config };
    persist({
      ...state,
      lastConfiguration: config,
      intersectionConfigs: { ...state.intersectionConfigs, [activeStudy.intersectionId]: config },
      activeStudy: nextStudy,
      studiesByIntersection: { ...studiesByIntersection, [nextStudy.intersectionId]: nextStudy },
    });
  }

  function toggleMovement(accessId: string, movement: MovementKey): void {
    const access = activeStudy.configurationSnapshot.accesses.find((candidate) => candidate.id === accessId);
    if (!access) return;
    const enabling = !access.movements[movement];
    const losesCapturedValue = !enabling && activeStudy.rows.some((row) => row.accessId === accessId && row[movement] !== null);
    if (losesCapturedValue && !window.confirm('Este movimiento ya tiene datos capturados. Deshabilitarlo eliminará esos valores de la tabla. ¿Continuar?')) return;
    setActiveStudy(updateAccessMovement(activeStudy, accessId, movement, enabling));
  }

  function updateSignalGroup(assignment: SignalMovementAssignment, changes: Partial<Omit<SignalMovementAssignment, 'id'>>): void {
    setActiveStudy(updateSignalMovementAssignment(activeStudy, assignment.id, changes));
  }

  function validateCurrentStudy(): void {
    let confirmLegacy = false;
    if (activeStudy.legacyUnverified) {
      confirmLegacy = window.confirm('Este estudio proviene de una versión anterior. ¿Confirmas que revisaste los ceros históricos y la captura completa?');
      if (!confirmLegacy) return;
    }
    setActiveStudy(validateStudy(activeStudy, summary.isComplete, confirmLegacy));
  }

  function clearActiveIntersection(): void {
    if (!selectedIntersection) return;
    if (!window.confirm('¿Limpiar los campos y datos de esta intersección desde este paso en adelante?')) return;

    const clearedIntersection: Intersection = {
      ...selectedIntersection,
      name: '',
      municipality: '',
      locality: '',
      notes: '',
      linkedCsvFileName: undefined,
      relatedIntersectionIds: [],
      verificationStatus: 'pending',
    };
    const nextIntersections = customIntersections.map((intersection) =>
      intersection.id === selectedIntersection.id ? clearedIntersection : intersection,
    );
    const nextConfigs = { ...state.intersectionConfigs };
    delete nextConfigs[selectedIntersection.id];
    const freshStudy = { ...createDefaultStudy(selectedIntersection.id, studyTemplate), currentStep: 1 };

    setRoadTrafficImport(null);
    setRoadTrafficImportError(null);
    persist({
      ...state,
      customIntersections: nextIntersections,
      intersectionConfigs: nextConfigs,
      activeStudy: freshStudy,
      studiesByIntersection: { ...studiesByIntersection, [selectedIntersection.id]: freshStudy },
    });
  }

  function clearEntireStudy(): void {
    if (!window.confirm('¿Borrar todo el estudio, todas las intersecciones y toda la memoria guardada?')) return;
    localStorage.removeItem(STORAGE_KEY);
    setRoadTrafficImport(null);
    setRoadTrafficImportError(null);
    setHelpStepIndex(null);
    setState(createInitialState());
  }

  function exportExcel(): void {
    if (!selectedIntersection) return;
    downloadStudyWorkbook(activeStudy, selectedIntersection);
    setActiveStudy(markStudyExported(activeStudy));
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Aforo semaforizado</p>
          <h1>Aforos Intersecciones</h1>
        </div>
        <div className="status-pill"><Save size={16} /> Guardado automaticamente</div>
      </header>

      <nav className="stepper" aria-label="Progreso">
        {wizardSteps.map((step, index) => (
          <div className={index === activeStudy.currentStep ? 'step active' : index < activeStudy.currentStep ? 'step done' : 'step'} key={step.label}>
            <button className="step-main" onClick={() => goToStep(index)} type="button"><span>{index + 1}</span>{step.label}</button>
            <button aria-label={`Ayuda para ${step.label}`} className="step-help" onClick={() => setHelpStepIndex(index)} title={`Ayuda: ${step.label}`} type="button">
              <CircleHelp size={17} />
            </button>
          </div>
        ))}
      </nav>

      {activeHelp && (
        <div className="help-backdrop" role="presentation" onClick={() => setHelpStepIndex(null)}>
          <section aria-labelledby="help-title" className="help-modal" role="dialog" onClick={(event) => event.stopPropagation()}>
            <div className="help-header">
              <div><p className="eyebrow">Tutorial del paso</p><h2 id="help-title">{activeHelp.helpTitle}</h2></div>
              <button aria-label="Cerrar ayuda" className="icon-button" onClick={() => setHelpStepIndex(null)} type="button"><X size={20} /></button>
            </div>
            <p>{activeHelp.helpBody}</p>
            <ol className="help-list">{activeHelp.helpChecklist.map((item) => <li key={item}>{item}</li>)}</ol>
          </section>
        </div>
      )}

      {selectedIntersection?.linkedCsvFileName && (
        <div style={{ padding: '12px 28px 0' }}><span className="status-pill">{selectedIntersection.linkedCsvFileName} vinculado</span></div>
      )}

      <section className="workspace">
        {activeStudy.currentStep === 0 && (
          <section>
            <div className="section-heading">
              <div>
                <h2>Datos del estudio</h2>
                <p className="section-description">Estos datos se guardan como memoria común y se reutilizan en todas las intersecciones del estudio.</p>
              </div>
              <button className="danger-button" onClick={clearEntireStudy} type="button"><Trash2 size={16} /> Limpiar estudio</button>
            </div>
            <div className="panel form-grid study-form">
              <label>Fecha<input type="date" value={studyTemplate.date} onChange={(event) => updateSharedMetadata('date', event.target.value)} /></label>
              <label>Hora inicio<input type="time" value={studyTemplate.startTime} onChange={(event) => updateSharedMetadata('startTime', event.target.value)} /></label>
              <label>Hora termino<input type="time" value={studyTemplate.endTime} onChange={(event) => updateSharedMetadata('endTime', event.target.value)} /></label>
              <label>
                Intervalo (min)
                <select value={studyTemplate.intervalMinutes} onChange={(event) => updateSharedMetadata('intervalMinutes', Number(event.target.value))}>
                  {[5, 10, 15, 20, 30].map((minutes) => <option key={minutes} value={minutes}>{minutes}</option>)}
                </select>
              </label>
              <label>Aforador<input value={studyTemplate.surveyor} onChange={(event) => updateSharedMetadata('surveyor', event.target.value)} /></label>
              <label>Clima<input value={studyTemplate.weather} onChange={(event) => updateSharedMetadata('weather', event.target.value)} /></label>
              <label>
                Flujo de saturación general de referencia (veh/h/carril)
                <input min={0} type="number" value={studyTemplate.observedSaturationFlowPerLane ?? ''} onChange={(event) => updateSharedMetadata('observedSaturationFlowPerLane', parseOptionalNumber(event.target.value))} />
                <small>Referencia histórica. La capacidad formal usa la saturación configurada en cada grupo movimiento–fase.</small>
              </label>
              <label>Observaciones generales<input value={studyTemplate.notes} onChange={(event) => updateSharedMetadata('notes', event.target.value)} /></label>
            </div>
          </section>
        )}

        {activeStudy.currentStep === 1 && (
          <div className="two-column">
            <section>
              <h2>Intersecciones de trabajo</h2>
              <IntersectionMap intersections={customIntersections} selectedIntersectionId={selectedIntersection?.id ?? null} onCreate={addIntersection} onSelect={startStudy} />
            </section>
            <aside className="panel">
              {!selectedIntersection ? (
                <>
                  <h3>Nueva interseccion</h3>
                  <p>Crea un marcador en el mapa para comenzar.</p>
                  <p>Haz clic sobre el mapa o usa el boton para colocar el primer punto. Las coordenadas se guardaran automaticamente.</p>
                </>
              ) : (
                <>
                  <div className="intersection-card-heading">
                    <h3>{selectedIntersection.id}</h3>
                    <button className="danger-secondary" onClick={clearActiveIntersection} type="button"><Eraser size={15} /> Limpiar campos</button>
                  </div>
                  <label>Clave de interseccion<input defaultValue={selectedIntersection.id} key={`id-${selectedIntersection.id}`} onBlur={(event) => renameIntersection(event.target.value)} /></label>
                  <label>Nombre<input value={selectedIntersection.name} onChange={(event) => updateIntersection({ name: event.target.value })} /></label>
                  <label>Municipio<input value={selectedIntersection.municipality} onChange={(event) => updateIntersection({ municipality: event.target.value })} /></label>
                  <label>Localidad<input value={selectedIntersection.locality} onChange={(event) => updateIntersection({ locality: event.target.value })} /></label>
                  <div className="form-grid">
                    <label>Latitud<input readOnly value={selectedIntersection.latitude.toFixed(7)} /></label>
                    <label>Longitud<input readOnly value={selectedIntersection.longitude.toFixed(7)} /></label>
                  </div>
                  <label>Observaciones de la interseccion<input value={selectedIntersection.notes} onChange={(event) => updateIntersection({ notes: event.target.value })} /></label>

                  <section className="linked-intersections">
                    <div className="linked-header"><h4>Intersecciones vinculadas</h4><span>{relatedIntersectionIds.length} vinculadas</span></div>
                    <div className="linked-list">
                      {linkedIntersectionOptions.length === 0 && <small>Crea otro marcador para poder vincularlo.</small>}
                      {linkedIntersectionOptions.map((intersection) => (
                        <label className="linked-option" key={intersection.id}>
                          <input aria-label={`${intersection.id} ${intersection.name}`} checked={relatedIntersectionIds.includes(intersection.id)} onChange={() => toggleRelatedIntersection(intersection.id)} type="checkbox" />
                          <span><strong>{intersection.id}</strong>{intersection.name}</span>
                        </label>
                      ))}
                    </div>
                  </section>

                  <div className="import-panel">
                    <label>
                      <span className="file-label"><Upload size={16} /> Importar CSV TDPA</span>
                      <input accept=".csv,text/csv" aria-label="Importar CSV TDPA" type="file" onChange={(event) => void importRoadTrafficCsv(event.target.files)} />
                    </label>
                    <small>El CSV genera una estimación TDPA independiente. No crea giros, peatones, bicicletas, intervalos de 15 min ni FHP observado.</small>
                  </div>
                  {roadTrafficImportError && <p className="warning"><AlertTriangle size={16} />{roadTrafficImportError}</p>}
                </>
              )}
            </aside>
          </div>
        )}

        {activeStudy.currentStep === 2 && (
          <section>
            <div className="section-heading">
              <h2>Configuracion de accesos</h2>
              <button className="primary" onClick={saveConfiguration} type="button"><CheckCircle2 size={16} /> Guardar configuracion</button>
            </div>
            {activeStudy.configurationSnapshot.inherited && <p className="warning"><AlertTriangle size={16} />Configuracion heredada: revisar antes de continuar.</p>}
            <div className="access-grid">
              {activeStudy.configurationSnapshot.accesses.map((access) => (
                <article className="access-card" key={access.id}>
                  <h3>{access.name}</h3>
                  <label>Nombre del acceso<input value={access.name} onChange={(event) => setActiveStudy(updateAccessConfig(activeStudy, access.id, { name: event.target.value }))} /></label>
                  <label>Carriles<input min={1} type="number" value={access.lanes} onChange={(event) => setActiveStudy(updateAccessConfig(activeStudy, access.id, { lanes: Number(event.target.value) || 1 }))} /></label>
                  <div className="movement-row">
                    {Object.entries(movementLabels).map(([key, label]) => (
                      <button className={access.movements[key as MovementKey] ? 'badge enabled' : 'badge'} key={key} onClick={() => toggleMovement(access.id, key as MovementKey)} type="button">{label}</button>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}

        {activeStudy.currentStep === 3 && (
          <section>
            <h2>Programacion semaforica</h2>
            <p className="section-description">El verde programado describe el controlador. El verde efectivo para capacidad se captura por grupo movimiento–fase.</p>
            {activeStudy.configurationSnapshot.programs.map((program) => (
              <article className="panel" key={program.id}>
                <div className="form-grid">
                  <label>Programa<input value={program.name} onChange={(event) => setActiveStudy(updateProgram(activeStudy, program.id, { name: event.target.value }))} /></label>
                  <label>Hora inicio<input type="time" value={program.startTime} onChange={(event) => setActiveStudy(updateProgram(activeStudy, program.id, { startTime: event.target.value }))} /></label>
                  <label>Hora termino<input type="time" value={program.endTime} onChange={(event) => setActiveStudy(updateProgram(activeStudy, program.id, { endTime: event.target.value }))} /></label>
                  <label>Ciclo programado (s)<input type="number" value={program.cycleSeconds ?? ''} onChange={(event) => setActiveStudy(updateProgram(activeStudy, program.id, { cycleSeconds: parseOptionalNumber(event.target.value) }))} /></label>
                  <label>Verde programado (s)<input type="number" value={program.greenSeconds ?? ''} onChange={(event) => setActiveStudy(updateProgram(activeStudy, program.id, { greenSeconds: parseOptionalNumber(event.target.value) }))} /></label>
                  <label>Ambar (s)<input type="number" value={program.amberSeconds ?? ''} onChange={(event) => setActiveStudy(updateProgram(activeStudy, program.id, { amberSeconds: parseOptionalNumber(event.target.value) }))} /></label>
                  <label>Rojo (s)<input type="number" value={program.redSeconds ?? ''} onChange={(event) => setActiveStudy(updateProgram(activeStudy, program.id, { redSeconds: parseOptionalNumber(event.target.value) }))} /></label>
                  <label>Fases<input min={1} max={8} type="number" value={program.phases ?? ''} onChange={(event) => setActiveStudy(updateProgramPhaseCount(activeStudy, program.id, Number(event.target.value) || 1))} /></label>
                </div>
                <div className="access-grid">
                  {program.phaseTimings.map((phase) => (
                    <article className="access-card" key={phase.id}>
                      <h3>{phase.name}</h3>
                      {(['cycleSeconds', 'greenSeconds', 'amberSeconds', 'redSeconds'] as const).map((field) => (
                        <label key={field}>
                          {field === 'cycleSeconds' ? 'Ciclo' : field === 'greenSeconds' ? 'Verde programado' : field === 'amberSeconds' ? 'Ambar' : 'Rojo'} (s)
                          <input type="number" value={phase[field] ?? ''} onChange={(event) => setActiveStudy(updateProgramPhase(activeStudy, program.id, phase.id, { [field]: parseOptionalNumber(event.target.value) }))} />
                        </label>
                      ))}
                    </article>
                  ))}
                </div>
              </article>
            ))}

            <section className="panel">
              <div className="section-heading">
                <div>
                  <h3>Grupos movimiento–fase</h3>
                  <p className="section-description">Configure únicamente grupos con correspondencia real entre acceso, movimiento y fase. Sin todos los insumos, capacidad y v/c quedan N/D.</p>
                </div>
                <button className="primary" onClick={() => setActiveStudy(addSignalMovementAssignment(activeStudy))} type="button">Agregar grupo semafórico</button>
              </div>
              {(activeStudy.configurationSnapshot.signalMovementAssignments ?? []).length === 0 && <p>Ningún grupo configurado.</p>}
              <div className="access-grid">
                {(activeStudy.configurationSnapshot.signalMovementAssignments ?? []).map((assignment) => {
                  const selectedAccess = activeStudy.configurationSnapshot.accesses.find((access) => access.id === assignment.accessId);
                  const selectedProgram = activeStudy.configurationSnapshot.programs.find((program) => program.id === assignment.programId);
                  return (
                    <article className="access-card" key={assignment.id}>
                      <h4>{assignment.id}</h4>
                      <label>
                        Acceso
                        <select aria-label={`Acceso grupo ${assignment.id}`} value={assignment.accessId} onChange={(event) => updateSignalGroup(assignment, { accessId: event.target.value })}>
                          {activeStudy.configurationSnapshot.accesses.map((access) => <option key={access.id} value={access.id}>{access.name}</option>)}
                        </select>
                      </label>
                      <label>
                        Movimiento
                        <select aria-label={`Movimiento grupo ${assignment.id}`} value={assignment.movement} onChange={(event) => updateSignalGroup(assignment, { movement: event.target.value as MovementKey })}>
                          {(Object.keys(fullMovementLabels) as MovementKey[]).map((movement) => (
                            <option disabled={selectedAccess ? !selectedAccess.movements[movement] : false} key={movement} value={movement}>{fullMovementLabels[movement]}</option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Programa
                        <select
                          aria-label={`Programa grupo ${assignment.id}`}
                          value={assignment.programId}
                          onChange={(event) => {
                            const programId = event.target.value;
                            const firstPhase = activeStudy.configurationSnapshot.programs.find((program) => program.id === programId)?.phaseTimings[0];
                            updateSignalGroup(assignment, { programId, phaseId: firstPhase?.id ?? '' });
                          }}
                        >
                          {activeStudy.configurationSnapshot.programs.map((program) => <option key={program.id} value={program.id}>{program.name}</option>)}
                        </select>
                      </label>
                      <label>
                        Fase
                        <select aria-label={`Fase grupo ${assignment.id}`} value={assignment.phaseId} onChange={(event) => updateSignalGroup(assignment, { phaseId: event.target.value })}>
                          {(selectedProgram?.phaseTimings ?? []).map((phase) => <option key={phase.id} value={phase.id}>{phase.name}</option>)}
                        </select>
                      </label>
                      <label>Carriles del grupo<input aria-label={`Carriles grupo ${assignment.id}`} min={1} type="number" value={assignment.lanes ?? ''} onChange={(event) => updateSignalGroup(assignment, { lanes: parseOptionalNumber(event.target.value) })} /></label>
                      <label>Saturación (veh/h/carril)<input aria-label={`Saturación grupo ${assignment.id}`} min={0} type="number" value={assignment.saturationFlowPerLane ?? ''} onChange={(event) => updateSignalGroup(assignment, { saturationFlowPerLane: parseOptionalNumber(event.target.value) })} /></label>
                      <label>Verde efectivo (s)<input aria-label={`Verde efectivo grupo ${assignment.id}`} min={0} type="number" value={assignment.effectiveGreenSeconds ?? ''} onChange={(event) => updateSignalGroup(assignment, { effectiveGreenSeconds: parseOptionalNumber(event.target.value) })} /></label>
                      <button className="danger-secondary" onClick={() => setActiveStudy(removeSignalMovementAssignment(activeStudy, assignment.id))} type="button">Eliminar grupo</button>
                    </article>
                  );
                })}
              </div>
            </section>
          </section>
        )}

        {activeStudy.currentStep === 4 && (
          <section>
            <h2>Tabla unica de aforo</h2>
            {(activeStudy.source ?? 'observed') === 'estimated_tdpa' && <p className="warning">Esta intersección tiene una estimación TDPA asociada. La tabla permanece vacía hasta que se realice captura de campo.</p>}
            <div className="table-wrap capture">
              <table>
                <thead>
                  <tr>
                    <th>Intervalo</th><th>Acceso</th><th>Izq</th><th>Frente</th><th>Der</th><th>Retorno</th><th>Total capturado</th><th>Pesados</th><th>Motos</th><th>Bicicletas</th><th>Peatones</th><th>Cola max</th><th>Cola prom</th><th>Longitud cola (m)</th><th>Det./ciclo</th><th>Ciclo obs.</th><th>Programa</th><th>Observaciones</th>
                  </tr>
                </thead>
                <tbody>
                  {activeStudy.rows.map((row) => {
                    const access = activeStudy.configurationSnapshot.accesses.find((candidate) => candidate.id === row.accessId) ?? activeStudy.configurationSnapshot.accesses[0];
                    return (
                      <tr key={row.id}>
                        <td>{row.intervalLabel}</td><td>{row.accessName}</td>
                        {(['left', 'through', 'right', 'uTurn'] as MovementKey[]).map((field) => (
                          <td key={field}>
                            {access.movements[field] ? (
                              <input
                                aria-label={`${fullMovementLabels[field]} · ${row.intervalLabel} · ${row.accessName}`}
                                min={0}
                                type="number"
                                value={row[field] ?? ''}
                                onChange={(event) => setActiveStudy(updateStudyRow(activeStudy, row.id, field, event.target.value))}
                              />
                            ) : 'N/A'}
                          </td>
                        ))}
                        <td>{calculateRowMotorizedTotal(row, access)}</td>
                        {(['heavy', 'motorcycles', 'bicycles', 'pedestrians', 'maxQueue', 'averageQueue', 'queueLength', 'stoppedVehiclesPerCycle', 'observedCycle'] as Array<keyof CaptureRow>).map((field) => (
                          <td key={field}><input min={0} type="number" value={String(row[field] ?? '')} onChange={(event) => setActiveStudy(updateStudyRow(activeStudy, row.id, field, event.target.value))} /></td>
                        ))}
                        <td><input value={row.observedProgram} onChange={(event) => setActiveStudy(updateStudyRow(activeStudy, row.id, 'observedProgram', event.target.value))} /></td>
                        <td><input value={row.notes} onChange={(event) => setActiveStudy(updateStudyRow(activeStudy, row.id, 'notes', event.target.value))} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {activeStudy.currentStep === 5 && (
          <section>
            <div className="section-heading">
              <div><h2>Validacion</h2><p>Estado del estudio: {studyStatusLabel(activeStudy)}</p></div>
              <button className="primary" onClick={validateCurrentStudy} type="button">Validar estudio</button>
            </div>
            {(activeStudy.source ?? 'observed') === 'estimated_tdpa' && <p className="warning">Una estimación TDPA no puede validarse como aforo observado.</p>}
            {activeStudy.legacyUnverified && <p className="warning">Estudio legado pendiente de revisar. Confirme los ceros históricos antes de validarlo.</p>}
            {summary.issues.length === 0 ? (
              <p className="result"><CheckCircle2 size={18} /> Sin errores obligatorios detectados.</p>
            ) : (
              <div className="panel">
                <p className="warning"><AlertTriangle size={16} /> Se detectaron {summary.issues.length} observaciones.</p>
                <ul>{summary.issues.slice(0, 30).map((issue, index) => <li key={`${issue}-${index}`}>{issue}</li>)}</ul>
              </div>
            )}
            <div className="summary-grid">{summary.dataQuality.map((item) => <div className="kpi" key={item}>{item}</div>)}</div>
          </section>
        )}

        {activeStudy.currentStep === 6 && (
          <section>
            <h2>Resultados</h2>
            {roadTrafficImport && (
              <div className="panel import-result-panel">
                <strong>{roadTrafficImport.point}</strong>
                <p>CSV TDPA vinculado exclusivamente a {roadTrafficImport.corridorName} como estimación de planeación.</p>
              </div>
            )}
            <ResultsDashboard
              summary={summary}
              intervalMinutes={activeStudy.metadata.intervalMinutes}
              source={activeStudy.source ?? 'observed'}
              tdpaEstimate={activeStudy.tdpaEstimate ?? null}
              legacyUnverified={activeStudy.legacyUnverified ?? false}
            />
          </section>
        )}

        {activeStudy.currentStep === 7 && (
          <section className="panel">
            <h2>Exportar estudio</h2>
            <p>Genera el XLSX con ficha tecnica, dashboard, aforo detallado, programacion, colas, ciclos, indicadores formales e instructivo.</p>
            {summary.isPartial && (activeStudy.source ?? 'observed') === 'observed' && <p className="warning">El Excel se exportará como estudio incompleto con resultados parciales.</p>}
            {(activeStudy.source ?? 'observed') === 'estimated_tdpa' && <p className="warning">El Excel identificará los datos como estimación TDPA, no como aforo observado.</p>}
            <button className="primary" disabled={!selectedIntersection} onClick={exportExcel} type="button"><Download size={16} /> Exportar Excel</button>
          </section>
        )}
      </section>

      <footer className="footer-nav">
        <button disabled={activeStudy.currentStep === 0} onClick={() => goToStep(activeStudy.currentStep - 1)} type="button"><ArrowLeft size={16} /> Anterior</button>
        <span>{selectedIntersection ? `${selectedIntersection.id} · ${selectedIntersection.name || 'Sin nombre'}` : 'Datos generales del estudio'}</span>
        <button disabled={activeStudy.currentStep === wizardSteps.length - 1 || (activeStudy.currentStep >= 1 && !selectedIntersection)} onClick={() => goToStep(activeStudy.currentStep + 1)} type="button">
          Siguiente <ArrowRight size={16} />
        </button>
      </footer>
    </main>
  );
}
