import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  CircleHelp,
  Download,
  FileSpreadsheet,
  RefreshCw,
  Save,
  X,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { intersections } from '../data/intersections';
import { wizardSteps } from '../data/tutorial';
import { calculateRowMotorizedTotal, calculateStudySummary } from '../lib/calculations';
import { downloadStudyWorkbook } from '../lib/exportExcel';
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
import type { CaptureRow, MovementKey, StoredState, Study } from '../lib/types';

const movementLabels: Record<MovementKey, string> = {
  left: 'Izq',
  through: 'Frente',
  right: 'Der',
  uTurn: 'Retorno',
};
const palette = ['#1f6feb', '#16a34a', '#f97316', '#7c3aed'];

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
    'observedCycle',
  ];
  const value = numericFields.includes(field) ? (rawValue === '' ? null : Number(rawValue)) : rawValue;

  return {
    ...study,
    rows: study.rows.map((row) => (row.id === rowId ? { ...row, [field]: value } : row)),
    updatedAt: new Date().toISOString(),
  };
}

function updateStudyMetadata(study: Study, field: keyof Study['metadata'], value: string | number): Study {
  const next: Study = {
    ...study,
    metadata: {
      ...study.metadata,
      [field]: value,
    },
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

export function WizardApp() {
  const [state, setState] = useState<StoredState>(getInitialState);
  const [helpStepIndex, setHelpStepIndex] = useState<number | null>(null);
  const activeStudy = state.activeStudy ?? createDefaultStudy(intersections[0].id);
  const activeHelp = helpStepIndex === null ? null : wizardSteps[helpStepIndex];
  const selectedIntersection =
    intersections.find((intersection) => intersection.id === activeStudy.intersectionId) ?? intersections[0];
  const summary = useMemo(
    () =>
      calculateStudySummary(
        activeStudy.rows,
        activeStudy.configurationSnapshot.accesses,
        activeStudy.metadata.intervalMinutes,
      ),
    [activeStudy],
  );
  const intervalChart = useMemo(() => {
    const byInterval = new Map<string, { interval: string; volume: number }>();
    for (const row of activeStudy.rows) {
      const access = activeStudy.configurationSnapshot.accesses.find((item) => item.id === row.accessId);
      if (!access) continue;
      const current = byInterval.get(row.intervalId) ?? { interval: row.intervalLabel, volume: 0 };
      current.volume += calculateRowMotorizedTotal(row, access);
      byInterval.set(row.intervalId, current);
    }
    return Array.from(byInterval.values());
  }, [activeStudy]);

  function persist(nextState: StoredState): void {
    setState(nextState);
    saveStoredState(nextState);
  }

  function setActiveStudy(study: Study): void {
    persist({ ...state, activeStudy: study });
  }

  function startStudy(intersectionId: string): void {
    const existingConfig = state.intersectionConfigs[intersectionId];
    const fallbackStudy = createDefaultStudy(intersectionId);
    const study = existingConfig
      ? { ...fallbackStudy, configurationSnapshot: existingConfig }
      : state.lastConfiguration
        ? {
            ...fallbackStudy,
            configurationSnapshot: {
              ...state.lastConfiguration,
              intersectionId,
              inherited: true,
              updatedAt: new Date().toISOString(),
            },
          }
        : fallbackStudy;

    persist({ ...state, activeStudy: study });
  }

  function goToStep(index: number): void {
    setActiveStudy({ ...activeStudy, currentStep: Math.max(0, Math.min(index, wizardSteps.length - 1)) });
  }

  function saveConfiguration(): void {
    const config = { ...activeStudy.configurationSnapshot, inherited: false, updatedAt: new Date().toISOString() };
    persist({
      ...state,
      lastConfiguration: config,
      intersectionConfigs: { ...state.intersectionConfigs, [activeStudy.intersectionId]: config },
      activeStudy: { ...activeStudy, configurationSnapshot: config },
    });
  }

  function exportExcel(): void {
    downloadStudyWorkbook(activeStudy, selectedIntersection);
    setActiveStudy({ ...activeStudy, status: 'exported' });
  }

  function parseOptionalNumber(value: string): number | null {
    return value === '' ? null : Number(value);
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

      <section className="workspace">
        {activeStudy.currentStep === 0 && (
          <div className="two-column">
            <section>
              <h2>Seleccionar interseccion</h2>
              <div className="intersection-list">
                {intersections.map((intersection) => (
                  <button
                    className={intersection.id === activeStudy.intersectionId ? 'intersection selected' : 'intersection'}
                    key={intersection.id}
                    onClick={() => startStudy(intersection.id)}
                    type="button"
                  >
                    <strong>{intersection.id}</strong>
                    <span>{intersection.name}</span>
                    <small>
                      {intersection.latitude.toFixed(6)}, {intersection.longitude.toFixed(6)}
                    </small>
                  </button>
                ))}
              </div>
            </section>
            <aside className="panel">
              <h3>{selectedIntersection.id}</h3>
              <p>{selectedIntersection.name}</p>
              <dl>
                <dt>Municipio</dt>
                <dd>{selectedIntersection.municipality}</dd>
                <dt>Estado</dt>
                <dd>{selectedIntersection.verificationStatus === 'verified' ? 'Verificada' : 'Por verificar'}</dd>
                <dt>Coordenadas</dt>
                <dd>
                  {selectedIntersection.latitude}, {selectedIntersection.longitude}
                </dd>
              </dl>
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
            <div className="program-grid">
              {activeStudy.configurationSnapshot.programs.map((program) => (
                <article className="program-card" key={program.id}>
                  <div className="form-grid compact">
                    <label>
                      Programa
                      <input
                        value={program.name}
                        onChange={(event) => setActiveStudy(updateProgram(activeStudy, program.id, { name: event.target.value }))}
                      />
                    </label>
                    <label>
                      Inicio
                      <input
                        type="time"
                        value={program.startTime}
                        onChange={(event) => setActiveStudy(updateProgram(activeStudy, program.id, { startTime: event.target.value }))}
                      />
                    </label>
                    <label>
                      Termino
                      <input
                        type="time"
                        value={program.endTime}
                        onChange={(event) => setActiveStudy(updateProgram(activeStudy, program.id, { endTime: event.target.value }))}
                      />
                    </label>
                    <label>
                      Ciclo total
                      <input
                        min={1}
                        type="number"
                        value={program.cycleSeconds ?? ''}
                        onChange={(event) =>
                          setActiveStudy(updateProgram(activeStudy, program.id, { cycleSeconds: parseOptionalNumber(event.target.value) }))
                        }
                      />
                    </label>
                    <label>
                      Verde
                      <input
                        min={0}
                        type="number"
                        value={program.greenSeconds ?? ''}
                        onChange={(event) =>
                          setActiveStudy(updateProgram(activeStudy, program.id, { greenSeconds: parseOptionalNumber(event.target.value) }))
                        }
                      />
                    </label>
                    <label>
                      Ambar
                      <input
                        min={0}
                        type="number"
                        value={program.amberSeconds ?? ''}
                        onChange={(event) =>
                          setActiveStudy(updateProgram(activeStudy, program.id, { amberSeconds: parseOptionalNumber(event.target.value) }))
                        }
                      />
                    </label>
                    <label>
                      Rojo
                      <input
                        min={0}
                        type="number"
                        value={program.redSeconds ?? ''}
                        onChange={(event) =>
                          setActiveStudy(updateProgram(activeStudy, program.id, { redSeconds: parseOptionalNumber(event.target.value) }))
                        }
                      />
                    </label>
                    <label>
                      Numero de fases
                      <input
                        max={8}
                        min={1}
                        type="number"
                        value={program.phases ?? 1}
                        onChange={(event) => setActiveStudy(updateProgramPhaseCount(activeStudy, program.id, Number(event.target.value) || 1))}
                      />
                    </label>
                  </div>
                  <h3>Ciclos por fase</h3>
                  <div className="phase-grid">
                    {program.phaseTimings.map((phase) => (
                      <article className="phase-card" key={phase.id}>
                        <label>
                          Nombre
                          <input
                            value={phase.name}
                            onChange={(event) =>
                              setActiveStudy(updateProgramPhase(activeStudy, program.id, phase.id, { name: event.target.value }))
                            }
                          />
                        </label>
                        <label>
                          Ciclo
                          <input
                            min={1}
                            type="number"
                            value={phase.cycleSeconds ?? ''}
                            onChange={(event) =>
                              setActiveStudy(
                                updateProgramPhase(activeStudy, program.id, phase.id, {
                                  cycleSeconds: parseOptionalNumber(event.target.value),
                                }),
                              )
                            }
                          />
                        </label>
                        <label>
                          Verde
                          <input
                            min={0}
                            type="number"
                            value={phase.greenSeconds ?? ''}
                            onChange={(event) =>
                              setActiveStudy(
                                updateProgramPhase(activeStudy, program.id, phase.id, {
                                  greenSeconds: parseOptionalNumber(event.target.value),
                                }),
                              )
                            }
                          />
                        </label>
                        <label>
                          Ambar
                          <input
                            min={0}
                            type="number"
                            value={phase.amberSeconds ?? ''}
                            onChange={(event) =>
                              setActiveStudy(
                                updateProgramPhase(activeStudy, program.id, phase.id, {
                                  amberSeconds: parseOptionalNumber(event.target.value),
                                }),
                              )
                            }
                          />
                        </label>
                        <label>
                          Rojo
                          <input
                            min={0}
                            type="number"
                            value={phase.redSeconds ?? ''}
                            onChange={(event) =>
                              setActiveStudy(
                                updateProgramPhase(activeStudy, program.id, phase.id, {
                                  redSeconds: parseOptionalNumber(event.target.value),
                                }),
                              )
                            }
                          />
                        </label>
                      </article>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}

        {activeStudy.currentStep === 3 && (
          <section>
            <h2>Datos del estudio</h2>
            <div className="form-grid">
              <label>
                Fecha
                <input
                  type="date"
                  value={activeStudy.metadata.date}
                  onChange={(event) => setActiveStudy(updateStudyMetadata(activeStudy, 'date', event.target.value))}
                />
              </label>
              <label>
                Hora inicio
                <input
                  type="time"
                  value={activeStudy.metadata.startTime}
                  onChange={(event) => setActiveStudy(updateStudyMetadata(activeStudy, 'startTime', event.target.value))}
                />
              </label>
              <label>
                Hora termino
                <input
                  type="time"
                  value={activeStudy.metadata.endTime}
                  onChange={(event) => setActiveStudy(updateStudyMetadata(activeStudy, 'endTime', event.target.value))}
                />
              </label>
              <label>
                Intervalo
                <select
                  value={activeStudy.metadata.intervalMinutes}
                  onChange={(event) =>
                    setActiveStudy(updateStudyMetadata(activeStudy, 'intervalMinutes', Number(event.target.value)))
                  }
                >
                  {[5, 10, 15, 20, 30].map((value) => (
                    <option key={value} value={value}>
                      {value} minutos
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Aforador
                <input
                  value={activeStudy.metadata.surveyor}
                  onChange={(event) => setActiveStudy(updateStudyMetadata(activeStudy, 'surveyor', event.target.value))}
                />
              </label>
              <label>
                Clima
                <input
                  value={activeStudy.metadata.weather}
                  onChange={(event) => setActiveStudy(updateStudyMetadata(activeStudy, 'weather', event.target.value))}
                />
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
                    <th>Bicis</th>
                    <th>Peatones</th>
                    <th>Cola max</th>
                  </tr>
                </thead>
                <tbody>
                  {activeStudy.rows.map((row) => {
                    const access = activeStudy.configurationSnapshot.accesses.find((item) => item.id === row.accessId);
                    const total = access ? calculateRowMotorizedTotal(row, access) : 0;
                    return (
                      <tr key={row.id}>
                        <td>{row.intervalLabel}</td>
                        <td>{row.accessName}</td>
                        {(['left', 'through', 'right', 'uTurn'] as const).map((field) => (
                          <td key={field}>
                            {access?.movements[field] ? (
                              <input
                                inputMode="numeric"
                                value={row[field] ?? ''}
                                onChange={(event) => setActiveStudy(updateStudyRow(activeStudy, row.id, field, event.target.value))}
                              />
                            ) : (
                              <span className="na">N/A</span>
                            )}
                          </td>
                        ))}
                        <td className="computed">{total}</td>
                        {(['heavy', 'motorcycles', 'bicycles', 'pedestrians', 'maxQueue'] as const).map((field) => (
                          <td key={field}>
                            <input
                              inputMode="numeric"
                              value={row[field] ?? ''}
                              onChange={(event) => setActiveStudy(updateStudyRow(activeStudy, row.id, field, event.target.value))}
                            />
                          </td>
                        ))}
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
            <h2>Validacion del estudio</h2>
            <div className="validation-grid">
              {summary.issues.length === 0 ? (
                <article className="result ok">
                  <CheckCircle2 size={20} />
                  Sin errores obligatorios
                </article>
              ) : (
                summary.issues.slice(0, 8).map((issue) => (
                  <article className="result issue" key={issue}>
                    <AlertTriangle size={20} />
                    {issue}
                  </article>
                ))
              )}
              {summary.dataQuality.map((item) => (
                <article className="result" key={item}>
                  <CheckCircle2 size={20} />
                  {item}
                </article>
              ))}
            </div>
          </section>
        )}

        {activeStudy.currentStep === 6 && (
          <section>
            <h2>Resultados</h2>
            <div className="kpi-grid">
              <article>
                <span>Volumen total</span>
                <strong>{summary.totalMotorized.toLocaleString('es-MX')}</strong>
              </article>
              <article>
                <span>Hora pico</span>
                <strong>{summary.peakHour?.label ?? 'N/D'}</strong>
              </article>
              <article>
                <span>{summary.peakHour?.factorLabel ?? 'FHP'}</span>
                <strong>{summary.peakHour?.factor?.toFixed(2) ?? 'N/D'}</strong>
              </article>
              <article>
                <span>Peatones</span>
                <strong>{summary.totalPedestrians.toLocaleString('es-MX')}</strong>
              </article>
            </div>
            <div className="charts">
              <article>
                <h3>Volumen por intervalo</h3>
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={intervalChart}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="interval" />
                    <YAxis />
                    <Tooltip />
                    <Line type="monotone" dataKey="volume" stroke="#1f6feb" strokeWidth={3} />
                  </LineChart>
                </ResponsiveContainer>
              </article>
              <article>
                <h3>Volumen por acceso</h3>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={summary.byAccess}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="accessName" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="volume" fill="#16a34a" />
                  </BarChart>
                </ResponsiveContainer>
              </article>
              <article>
                <h3>Movimientos</h3>
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie data={summary.byMovement} dataKey="volume" nameKey="movement" outerRadius={90} label>
                      {summary.byMovement.map((entry, index) => (
                        <Cell key={entry.movement} fill={palette[index % palette.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </article>
            </div>
          </section>
        )}

        {activeStudy.currentStep === 7 && (
          <section className="export-panel">
            <FileSpreadsheet size={48} />
            <h2>Exportar Excel</h2>
            <p>{activeStudy.id}.xlsx</p>
            <button className="primary big" onClick={exportExcel} type="button">
              <Download size={18} />
              Generar XLSX
            </button>
            <button
              className="secondary"
              onClick={() => persist({ ...state, activeStudy: createDefaultStudy(activeStudy.intersectionId) })}
              type="button"
            >
              <RefreshCw size={16} />
              Finalizar y comenzar nuevo
            </button>
          </section>
        )}
      </section>

      <footer className="footer-nav">
        <button disabled={activeStudy.currentStep === 0} onClick={() => goToStep(activeStudy.currentStep - 1)} type="button">
          <ArrowLeft size={16} />
          Anterior
        </button>
        <span>
          {selectedIntersection.id} · {activeStudy.metadata.date} · {activeStudy.metadata.startTime}-{activeStudy.metadata.endTime}
        </span>
        <button disabled={activeStudy.currentStep === wizardSteps.length - 1} onClick={() => goToStep(activeStudy.currentStep + 1)} type="button">
          Siguiente
          <ArrowRight size={16} />
        </button>
      </footer>
    </main>
  );
}
