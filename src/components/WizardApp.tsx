import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  CircleHelp,
  Download,
  Save,
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
  createDefaultStudy,
  rebuildStudyRows,
  updateAccessConfig,
  updateAccessMovement,
  updateProgram,
  updateProgramPhase,
  updateProgramPhaseCount,
} from '../lib/study';
import { createInitialState, loadStoredState, saveStoredState } from '../lib/storage';
import type { CorridorTrafficStudy, RoadTrafficProfile } from '../lib/roadTrafficImport';
import type { CaptureRow, Intersection, MovementKey, StoredState, Study } from '../lib/types';
import { IntersectionMap } from './IntersectionMap';

const movementLabels: Record<MovementKey, string> = {
  left: 'Izq',
  through: 'Frente',
  right: 'Der',
  uTurn: 'Retorno',
};

const UNASSIGNED_INTERSECTION_ID = '__UNASSIGNED__';
const numberFormat = new Intl.NumberFormat('es-MX');

interface RoadTrafficImportState {
  fileName: string;
  corridorName: string;
  point: string;
  profile: RoadTrafficProfile;
  studies: CorridorTrafficStudy[];
}

function getInitialState(): StoredState {
  if (typeof localStorage === 'undefined') {
    return createInitialState();
  }

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
    rows: study.rows.map((row) => (row.id === rowId ? { ...row, [field]: value } : row)),
    updatedAt: new Date().toISOString(),
  };
}

function updateStudyMetadata(
  study: Study,
  field: keyof Study['metadata'],
  value: string | number | null,
): Study {
  const next: Study = {
    ...study,
    metadata: { ...study.metadata, [field]: value },
    updatedAt: new Date().toISOString(),
  };

  if (['startTime', 'endTime', 'intervalMinutes'].includes(field)) {
    try {
      return rebuildStudyRows(next);
    } catch {
      return next;
    }
  }

  return next;
}

function readFileText(file: File): Promise<string> {
  if (typeof file.text === 'function') {
    return file.text();
  }

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

function formatNullable(value: number | null, digits = 0): string {
  if (value === null || !Number.isFinite(value)) return 'N/D';
  return value.toLocaleString('es-MX', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
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

export function WizardApp() {
  const [state, setState] = useState<StoredState>(getInitialState);
  const [helpStepIndex, setHelpStepIndex] = useState<number | null>(null);
  const [roadTrafficImport, setRoadTrafficImport] = useState<RoadTrafficImportState | null>(null);
  const [roadTrafficImportError, setRoadTrafficImportError] = useState<string | null>(null);

  const customIntersections = state.customIntersections ?? [];
  const persistedStudy =
    state.activeStudy && customIntersections.some((intersection) => intersection.id === state.activeStudy?.intersectionId)
      ? state.activeStudy
      : null;
  const activeStudy = persistedStudy ?? createDefaultStudy(UNASSIGNED_INTERSECTION_ID);
  const selectedIntersection =
    customIntersections.find((intersection) => intersection.id === activeStudy.intersectionId) ?? null;
  const activeHelp = helpStepIndex === null ? null : wizardSteps[helpStepIndex];

  const summary = useMemo(
    () =>
      calculateStudySummary(
        activeStudy.rows,
        activeStudy.configurationSnapshot.accesses,
        activeStudy.metadata.intervalMinutes,
        {
          programs: activeStudy.configurationSnapshot.programs,
          observedSaturationFlowPerLane: activeStudy.metadata.observedSaturationFlowPerLane,
        },
      ),
    [activeStudy],
  );

  const relatedIntersectionIds = selectedIntersection?.relatedIntersectionIds ?? activeStudy.relatedIntersectionIds ?? [];
  const linkedIntersectionOptions = useMemo(
    () =>
      customIntersections
        .filter((intersection) => intersection.id !== selectedIntersection?.id)
        .sort((left, right) => left.mapNumber - right.mapNumber),
    [customIntersections, selectedIntersection?.id],
  );

  function persist(nextState: StoredState): void {
    setState(nextState);
    saveStoredState(nextState);
  }

  function setActiveStudy(study: Study): void {
    persist({ ...state, activeStudy: study });
  }

  function buildStudyForIntersection(intersection: Intersection): Study {
    const existingConfig = state.intersectionConfigs[intersection.id];
    const fallbackStudy = createDefaultStudy(intersection.id);
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

    return {
      ...configuredStudy,
      relatedIntersectionIds: intersection.relatedIntersectionIds ?? [],
    };
  }

  function addIntersection(latitude: number, longitude: number): void {
    const intersection = createIntersection(latitude, longitude, customIntersections);
    const nextIntersections = [...customIntersections, intersection];
    const study = buildStudyForIntersection(intersection);

    setRoadTrafficImport(null);
    setRoadTrafficImportError(null);
    persist({ ...state, customIntersections: nextIntersections, activeStudy: study });
  }

  function startStudy(intersectionId: string): void {
    const intersection = customIntersections.find((candidate) => candidate.id === intersectionId);
    if (!intersection) return;

    if (persistedStudy?.intersectionId === intersectionId) {
      return;
    }

    setRoadTrafficImport(null);
    setRoadTrafficImportError(null);
    persist({ ...state, activeStudy: buildStudyForIntersection(intersection) });
  }

  function updateIntersection(changes: Partial<Omit<Intersection, 'id' | 'mapNumber'>>): void {
    if (!selectedIntersection) return;

    const nextIntersections = customIntersections.map((intersection) =>
      intersection.id === selectedIntersection.id ? { ...intersection, ...changes } : intersection,
    );
    persist({ ...state, customIntersections: nextIntersections, activeStudy: activeStudy });
  }

  function renameIntersection(rawId: string): void {
    if (!selectedIntersection) return;
    const nextId = rawId.trim().toUpperCase();
    if (!nextId || nextId === selectedIntersection.id) return;
    if (customIntersections.some((intersection) => intersection.id === nextId)) return;

    const oldId = selectedIntersection.id;
    const nextIntersections = customIntersections.map((intersection) => ({
      ...intersection,
      id: intersection.id === oldId ? nextId : intersection.id,
      relatedIntersectionIds: (intersection.relatedIntersectionIds ?? []).map((id) => (id === oldId ? nextId : id)),
    }));

    const existingConfig = state.intersectionConfigs[oldId];
    const nextConfigs = { ...state.intersectionConfigs };
    if (existingConfig) {
      delete nextConfigs[oldId];
      nextConfigs[nextId] = { ...existingConfig, intersectionId: nextId };
    }

    const nextStudy: Study = {
      ...activeStudy,
      intersectionId: nextId,
      relatedIntersectionIds: activeStudy.relatedIntersectionIds.map((id) => (id === oldId ? nextId : id)),
      configurationSnapshot: { ...activeStudy.configurationSnapshot, intersectionId: nextId },
      updatedAt: new Date().toISOString(),
    };

    persist({
      ...state,
      customIntersections: nextIntersections,
      intersectionConfigs: nextConfigs,
      activeStudy: nextStudy,
      lastConfiguration:
        state.lastConfiguration?.intersectionId === oldId
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

    persist({ ...state, customIntersections: nextIntersections, activeStudy: nextStudy });
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
      persist({ ...state, customIntersections: nextIntersections, activeStudy: imported.study });
    } catch (error) {
      setRoadTrafficImport(null);
      setRoadTrafficImportError(error instanceof Error ? error.message : 'No se pudo importar el CSV TDPA.');
    }
  }

  function goToStep(index: number): void {
    if (!selectedIntersection && index > 0) return;
    setActiveStudy({ ...activeStudy, currentStep: Math.max(0, Math.min(index, wizardSteps.length - 1)) });
  }

  function saveConfiguration(): void {
    if (!selectedIntersection) return;
    const config = { ...activeStudy.configurationSnapshot, inherited: false, updatedAt: new Date().toISOString() };
    persist({
      ...state,
      lastConfiguration: config,
      intersectionConfigs: { ...state.intersectionConfigs, [activeStudy.intersectionId]: config },
      activeStudy: { ...activeStudy, configurationSnapshot: config },
    });
  }

  function exportExcel(): void {
    if (!selectedIntersection) return;
    downloadStudyWorkbook(activeStudy, selectedIntersection);
    setActiveStudy({ ...activeStudy, status: 'exported' });
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Aforo semaforizado</p>
          <h1>Aforos Intersecciones</h1>
        </div>
        <div className="status-pill">
          <Save size={16} />
          Guardado automaticamente
        </div>
      </header>

      <nav className="stepper" aria-label="Progreso">
        {wizardSteps.map((step, index) => (
          <div
            className={index === activeStudy.currentStep ? 'step active' : index < activeStudy.currentStep ? 'step done' : 'step'}
            key={step.label}
          >
            <button className="step-main" onClick={() => goToStep(index)} type="button">
              <span>{index + 1}</span>
              {step.label}
            </button>
            <button
              aria-label={`Ayuda para ${step.label}`}
              className="step-help"
              onClick={() => setHelpStepIndex(index)}
              title={`Ayuda: ${step.label}`}
              type="button"
            >
              <CircleHelp size={17} />
            </button>
          </div>
        ))}
      </nav>

      {activeHelp && (
        <div className="help-backdrop" role="presentation" onClick={() => setHelpStepIndex(null)}>
          <section
            aria-labelledby="help-title"
            className="help-modal"
            role="dialog"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="help-header">
              <div>
                <p className="eyebrow">Tutorial del paso</p>
                <h2 id="help-title">{activeHelp.helpTitle}</h2>
              </div>
              <button aria-label="Cerrar ayuda" className="icon-button" onClick={() => setHelpStepIndex(null)} type="button">
                <X size={20} />
              </button>
            </div>
            <p>{activeHelp.helpBody}</p>
            <ol className="help-list">
              {activeHelp.helpChecklist.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ol>
          </section>
        </div>
      )}

      {selectedIntersection?.linkedCsvFileName && (
        <div style={{ padding: '12px 28px 0' }}>
          <span className="status-pill">{selectedIntersection.linkedCsvFileName} vinculado</span>
        </div>
      )}

      <section className="workspace">
        {activeStudy.currentStep === 0 && (
          <div className="two-column">
            <section>
              <h2>Intersecciones de trabajo</h2>
              <IntersectionMap
                intersections={customIntersections}
                selectedIntersectionId={selectedIntersection?.id ?? null}
                onCreate={addIntersection}
                onSelect={startStudy}
              />
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
                  <h3>{selectedIntersection.id}</h3>
                  <label>
                    Clave de interseccion
                    <input
                      defaultValue={selectedIntersection.id}
                      key={`id-${selectedIntersection.id}`}
                      onBlur={(event) => renameIntersection(event.target.value)}
                    />
                  </label>
                  <label>
                    Nombre
                    <input
                      value={selectedIntersection.name}
                      onChange={(event) => updateIntersection({ name: event.target.value })}
                    />
                  </label>
                  <label>
                    Municipio
                    <input
                      value={selectedIntersection.municipality}
                      onChange={(event) => updateIntersection({ municipality: event.target.value })}
                    />
                  </label>
                  <label>
                    Localidad
                    <input
                      value={selectedIntersection.locality}
                      onChange={(event) => updateIntersection({ locality: event.target.value })}
                    />
                  </label>
                  <div className="form-grid">
                    <label>
                      Latitud
                      <input readOnly value={selectedIntersection.latitude.toFixed(7)} />
                    </label>
                    <label>
                      Longitud
                      <input readOnly value={selectedIntersection.longitude.toFixed(7)} />
                    </label>
                  </div>
                  <label>
                    Observaciones de la interseccion
                    <input
                      value={selectedIntersection.notes}
                      onChange={(event) => updateIntersection({ notes: event.target.value })}
                    />
                  </label>

                  <section className="linked-intersections">
                    <div className="linked-header">
                      <h4>Intersecciones vinculadas</h4>
                      <span>{relatedIntersectionIds.length} vinculadas</span>
                    </div>
                    <div className="linked-list">
                      {linkedIntersectionOptions.length === 0 && <small>Crea otro marcador para poder vincularlo.</small>}
                      {linkedIntersectionOptions.map((intersection) => (
                        <label className="linked-option" key={intersection.id}>
                          <input
                            aria-label={`${intersection.id} ${intersection.name}`}
                            checked={relatedIntersectionIds.includes(intersection.id)}
                            onChange={() => toggleRelatedIntersection(intersection.id)}
                            type="checkbox"
                          />
                          <span>
                            <strong>{intersection.id}</strong>
                            {intersection.name}
                          </span>
                        </label>
                      ))}
                    </div>
                  </section>

                  <div className="import-panel">
                    <label>
                      <span className="file-label">
                        <Upload size={16} />
                        Importar CSV TDPA
                      </span>
                      <input
                        accept=".csv,text/csv"
                        aria-label="Importar CSV TDPA"
                        type="file"
                        onChange={(event) => {
                          void importRoadTrafficCsv(event.target.files);
                        }}
                      />
                    </label>
                    <small>El CSV se vincula unicamente a esta interseccion y alimenta su estudio de hora de diseño.</small>
                  </div>
                  {roadTrafficImportError && (
                    <p className="warning">
                      <AlertTriangle size={16} />
                      {roadTrafficImportError}
                    </p>
                  )}
                </>
              )}
            </aside>
          </div>
        )}

        {activeStudy.currentStep === 1 && (
          <section>
            <div className="section-heading">
              <h2>Configuracion de accesos</h2>
              <button className="primary" onClick={saveConfiguration} type="button">
                <CheckCircle2 size={16} />
                Guardar configuracion
              </button>
            </div>
            {activeStudy.configurationSnapshot.inherited && (
              <p className="warning">
                <AlertTriangle size={16} />
                Configuracion heredada: revisar antes de continuar.
              </p>
            )}
            <div className="access-grid">
              {activeStudy.configurationSnapshot.accesses.map((access) => (
                <article className="access-card" key={access.id}>
                  <h3>{access.name}</h3>
                  <label>
                    Nombre del acceso
                    <input
                      value={access.name}
                      onChange={(event) => setActiveStudy(updateAccessConfig(activeStudy, access.id, { name: event.target.value }))}
                    />
                  </label>
                  <label>
                    Carriles
                    <input
                      min={1}
                      type="number"
                      value={access.lanes}
                      onChange={(event) =>
                        setActiveStudy(updateAccessConfig(activeStudy, access.id, { lanes: Number(event.target.value) || 1 }))
                      }
                    />
                  </label>
                  <div className="movement-row">
                    {Object.entries(movementLabels).map(([key, label]) => (
                      <button
                        className={access.movements[key as MovementKey] ? 'badge enabled' : 'badge'}
                        key={key}
                        onClick={() =>
                          setActiveStudy(
                            updateAccessMovement(activeStudy, access.id, key as MovementKey, !access.movements[key as MovementKey]),
                          )
                        }
                        type="button"
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}

        {activeStudy.currentStep === 2 && (
          <section>
            <h2>Programacion semaforica</h2>
            {activeStudy.configurationSnapshot.programs.map((program) => (
              <article className="panel" key={program.id}>
                <div className="form-grid">
                  <label>
                    Programa
                    <input value={program.name} onChange={(event) => setActiveStudy(updateProgram(activeStudy, program.id, { name: event.target.value }))} />
                  </label>
                  <label>
                    Hora inicio
                    <input type="time" value={program.startTime} onChange={(event) => setActiveStudy(updateProgram(activeStudy, program.id, { startTime: event.target.value }))} />
                  </label>
                  <label>
                    Hora termino
                    <input type="time" value={program.endTime} onChange={(event) => setActiveStudy(updateProgram(activeStudy, program.id, { endTime: event.target.value }))} />
                  </label>
                  <label>
                    Ciclo (s)
                    <input type="number" value={program.cycleSeconds ?? ''} onChange={(event) => setActiveStudy(updateProgram(activeStudy, program.id, { cycleSeconds: parseOptionalNumber(event.target.value) }))} />
                  </label>
                  <label>
                    Verde (s)
                    <input type="number" value={program.greenSeconds ?? ''} onChange={(event) => setActiveStudy(updateProgram(activeStudy, program.id, { greenSeconds: parseOptionalNumber(event.target.value) }))} />
                  </label>
                  <label>
                    Ambar (s)
                    <input type="number" value={program.amberSeconds ?? ''} onChange={(event) => setActiveStudy(updateProgram(activeStudy, program.id, { amberSeconds: parseOptionalNumber(event.target.value) }))} />
                  </label>
                  <label>
                    Rojo (s)
                    <input type="number" value={program.redSeconds ?? ''} onChange={(event) => setActiveStudy(updateProgram(activeStudy, program.id, { redSeconds: parseOptionalNumber(event.target.value) }))} />
                  </label>
                  <label>
                    Fases
                    <input
                      min={1}
                      max={8}
                      type="number"
                      value={program.phases ?? 1}
                      onChange={(event) => setActiveStudy(updateProgramPhaseCount(activeStudy, program.id, Number(event.target.value) || 1))}
                    />
                  </label>
                </div>
                <div className="access-grid">
                  {program.phaseTimings.map((phase) => (
                    <article className="access-card" key={phase.id}>
                      <h3>{phase.name}</h3>
                      {(['cycleSeconds', 'greenSeconds', 'amberSeconds', 'redSeconds'] as const).map((field) => (
                        <label key={field}>
                          {field === 'cycleSeconds' ? 'Ciclo' : field === 'greenSeconds' ? 'Verde' : field === 'amberSeconds' ? 'Ambar' : 'Rojo'} (s)
                          <input
                            type="number"
                            value={phase[field] ?? ''}
                            onChange={(event) =>
                              setActiveStudy(updateProgramPhase(activeStudy, program.id, phase.id, { [field]: parseOptionalNumber(event.target.value) }))
                            }
                          />
                        </label>
                      ))}
                    </article>
                  ))}
                </div>
              </article>
            ))}
          </section>
        )}

        {activeStudy.currentStep === 3 && (
          <section>
            <h2>Datos del estudio</h2>
            <div className="panel form-grid">
              <label>
                Fecha
                <input type="date" value={activeStudy.metadata.date} onChange={(event) => setActiveStudy(updateStudyMetadata(activeStudy, 'date', event.target.value))} />
              </label>
              <label>
                Hora inicio
                <input type="time" value={activeStudy.metadata.startTime} onChange={(event) => setActiveStudy(updateStudyMetadata(activeStudy, 'startTime', event.target.value))} />
              </label>
              <label>
                Hora termino
                <input type="time" value={activeStudy.metadata.endTime} onChange={(event) => setActiveStudy(updateStudyMetadata(activeStudy, 'endTime', event.target.value))} />
              </label>
              <label>
                Intervalo (min)
                <select value={activeStudy.metadata.intervalMinutes} onChange={(event) => setActiveStudy(updateStudyMetadata(activeStudy, 'intervalMinutes', Number(event.target.value)))}>
                  {[5, 10, 15, 20, 30].map((minutes) => <option key={minutes} value={minutes}>{minutes}</option>)}
                </select>
              </label>
              <label>
                Aforador
                <input value={activeStudy.metadata.surveyor} onChange={(event) => setActiveStudy(updateStudyMetadata(activeStudy, 'surveyor', event.target.value))} />
              </label>
              <label>
                Clima
                <input value={activeStudy.metadata.weather} onChange={(event) => setActiveStudy(updateStudyMetadata(activeStudy, 'weather', event.target.value))} />
              </label>
              <label>
                Flujo de saturación observado (veh/h/carril)
                <input
                  min={0}
                  type="number"
                  value={activeStudy.metadata.observedSaturationFlowPerLane ?? ''}
                  onChange={(event) => setActiveStudy(updateStudyMetadata(activeStudy, 'observedSaturationFlowPerLane', parseOptionalNumber(event.target.value)))}
                />
              </label>
              <label>
                Observaciones generales
                <input value={activeStudy.metadata.notes} onChange={(event) => setActiveStudy(updateStudyMetadata(activeStudy, 'notes', event.target.value))} />
              </label>
            </div>
          </section>
        )}

        {activeStudy.currentStep === 4 && (
          <section>
            <h2>Tabla unica de aforo</h2>
            <div className="table-wrap capture">
              <table>
                <thead>
                  <tr>
                    <th>Intervalo</th>
                    <th>Acceso</th>
                    <th>Izq</th>
                    <th>Frente</th>
                    <th>Der</th>
                    <th>Retorno</th>
                    <th>Total</th>
                    <th>Pesados</th>
                    <th>Motos</th>
                    <th>Bicicletas</th>
                    <th>Peatones</th>
                    <th>Cola max</th>
                    <th>Cola prom</th>
                    <th>Longitud cola (m)</th>
                    <th>Det./ciclo</th>
                    <th>Ciclo obs.</th>
                    <th>Programa</th>
                    <th>Observaciones</th>
                  </tr>
                </thead>
                <tbody>
                  {activeStudy.rows.map((row) => {
                    const access = activeStudy.configurationSnapshot.accesses.find((candidate) => candidate.id === row.accessId) ?? activeStudy.configurationSnapshot.accesses[0];
                    return (
                      <tr key={row.id}>
                        <td>{row.intervalLabel}</td>
                        <td>{row.accessName}</td>
                        {(['left', 'through', 'right', 'uTurn'] as MovementKey[]).map((field) => (
                          <td key={field}>
                            {access.movements[field] ? (
                              <input min={0} type="number" value={row[field] ?? ''} onChange={(event) => setActiveStudy(updateStudyRow(activeStudy, row.id, field, event.target.value))} />
                            ) : 'N/A'}
                          </td>
                        ))}
                        <td>{calculateRowMotorizedTotal(row, access)}</td>
                        {(['heavy', 'motorcycles', 'bicycles', 'pedestrians', 'maxQueue', 'averageQueue', 'queueLength', 'stoppedVehiclesPerCycle', 'observedCycle'] as Array<keyof CaptureRow>).map((field) => (
                          <td key={field}>
                            <input min={0} type="number" value={String(row[field] ?? '')} onChange={(event) => setActiveStudy(updateStudyRow(activeStudy, row.id, field, event.target.value))} />
                          </td>
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
            <h2>Validacion</h2>
            {summary.issues.length === 0 ? (
              <p className="result"><CheckCircle2 size={18} /> Sin errores obligatorios detectados.</p>
            ) : (
              <div className="panel">
                <p className="warning"><AlertTriangle size={16} /> Se detectaron {summary.issues.length} observaciones.</p>
                <ul>{summary.issues.slice(0, 30).map((issue) => <li key={issue}>{issue}</li>)}</ul>
              </div>
            )}
            <div className="summary-grid">
              {summary.dataQuality.map((item) => <div className="kpi" key={item}>{item}</div>)}
            </div>
          </section>
        )}

        {activeStudy.currentStep === 6 && (
          <section>
            <h2>Resultados</h2>
            {roadTrafficImport && (
              <div className="panel">
                <strong>{roadTrafficImport.point}</strong>
                <p>CSV TDPA aplicado exclusivamente a {roadTrafficImport.corridorName}.</p>
              </div>
            )}
            <div className="summary-grid">
              <article className="kpi"><span>Volumen total</span><strong>{numberFormat.format(summary.totalMotorized)}</strong></article>
              <article className="kpi"><span>Intervalo máximo</span><strong>{summary.peakInterval ? `${summary.peakInterval.label} · ${numberFormat.format(summary.peakInterval.volume)}` : 'N/D'}</strong></article>
              <article className="kpi"><span>Hora de máxima demanda</span><strong>{summary.peakHour ? `${summary.peakHour.label} · ${numberFormat.format(summary.peakHour.volume)}` : 'N/D'}</strong></article>
              <article className="kpi"><span>{summary.peakHour?.factorLabel ?? 'FHP'}</span><strong>{summary.peakHour?.factor === null || summary.peakHour?.factor === undefined ? 'N/D' : summary.peakHour.factor.toFixed(3)}</strong></article>
              <article className="kpi"><span>Promedio 15 min</span><strong>{formatNullable(summary.averageIntervalVolume, 1)}</strong></article>
              <article className="kpi"><span>g/C</span><strong>{formatNullable(summary.signalIndicators.greenRatio, 3)}</strong></article>
              <article className="kpi"><span>v/c</span><strong>{formatNullable(summary.signalIndicators.volumeCapacityRatio, 3)}</strong></article>
              <article className="kpi"><span>Pesados</span><strong>{numberFormat.format(summary.totalHeavy)}</strong></article>
              <article className="kpi"><span>Motos</span><strong>{numberFormat.format(summary.totalMotorcycles)}</strong></article>
              <article className="kpi"><span>Bicicletas</span><strong>{numberFormat.format(summary.totalBicycles)}</strong></article>
              <article className="kpi"><span>Peatones</span><strong>{numberFormat.format(summary.totalPedestrians)}</strong></article>
            </div>

            <div className="two-column">
              <section className="panel">
                <h3>Volumen por intervalo</h3>
                <table>
                  <thead><tr><th>Intervalo</th><th>Volumen</th></tr></thead>
                  <tbody>{summary.byInterval.map((interval) => <tr key={interval.intervalId}><td>{interval.label}</td><td>{numberFormat.format(interval.total)}</td></tr>)}</tbody>
                </table>
              </section>
              <section className="panel">
                <h3>Volumen por acceso</h3>
                <table>
                  <thead><tr><th>Acceso</th><th>Volumen</th></tr></thead>
                  <tbody>{summary.byAccess.map((access) => <tr key={access.accessId}><td>{access.accessName}</td><td>{numberFormat.format(access.volume)}</td></tr>)}</tbody>
                </table>
              </section>
            </div>
          </section>
        )}

        {activeStudy.currentStep === 7 && (
          <section className="panel">
            <h2>Exportar estudio</h2>
            <p>Genera el XLSX con ficha tecnica, dashboard, aforo detallado, programacion, colas, indicadores e instructivo.</p>
            <button className="primary" disabled={!selectedIntersection} onClick={exportExcel} type="button">
              <Download size={16} />
              Exportar Excel
            </button>
          </section>
        )}
      </section>

      <footer className="footer-nav">
        <button disabled={activeStudy.currentStep === 0} onClick={() => goToStep(activeStudy.currentStep - 1)} type="button">
          <ArrowLeft size={16} />
          Anterior
        </button>
        <span>{selectedIntersection ? `${selectedIntersection.id} · ${selectedIntersection.name}` : 'Sin interseccion seleccionada'}</span>
        <button disabled={!selectedIntersection || activeStudy.currentStep === wizardSteps.length - 1} onClick={() => goToStep(activeStudy.currentStep + 1)} type="button">
          Siguiente
          <ArrowRight size={16} />
        </button>
      </footer>
    </main>
  );
}
