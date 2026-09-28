import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { StudySource, StudySummary, TdpaEstimate } from '../lib/types';

const numberFormat = new Intl.NumberFormat('es-MX');

interface ResultsDashboardProps {
  summary: StudySummary;
  intervalMinutes: number;
  source?: StudySource;
  tdpaEstimate?: TdpaEstimate | null;
  legacyUnverified?: boolean;
}

function formatNullable(value: number | null | undefined, digits = 0): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return 'N/D';
  return value.toLocaleString('es-MX', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function DashboardChart({
  title,
  data,
  dataKey,
  labelKey,
}: {
  title: string;
  data: Array<Record<string, string | number>>;
  dataKey: string;
  labelKey: string;
}) {
  return (
    <article className="dashboard-chart panel">
      <h3>{title}</h3>
      <div className="chart-frame" aria-label={`Gráfica: ${title}`} role="img">
        <ResponsiveContainer height={260} width="100%">
          <BarChart data={data} margin={{ top: 8, right: 12, left: 4, bottom: 34 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis angle={-25} dataKey={labelKey} height={62} interval={0} textAnchor="end" tick={{ fontSize: 11 }} />
            <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={54} />
            <Tooltip formatter={(value) => numberFormat.format(Number(value))} />
            <Bar dataKey={dataKey} fill="#1f6feb" name="Volumen" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </article>
  );
}

function TdpaPanel({ estimate }: { estimate: TdpaEstimate | null | undefined }) {
  return (
    <>
      <p className="warning">ESTIMACIÓN TDPA — NO SUSTITUYE UN AFORO DE INTERSECCIÓN EN CAMPO.</p>
      <section className="dashboard-table panel">
        <h3>Estimación TDPA</h3>
        {!estimate ? (
          <p>N/D — no existe un registro TDPA válido asociado.</p>
        ) : (
          <div className="dashboard-kpis">
            <article className="kpi"><span>TDPA</span><strong>{numberFormat.format(estimate.dailyTraffic)}</strong></article>
            <article className="kpi"><span>K&apos;</span><strong>{estimate.designHourFactor.toFixed(3)}</strong></article>
            <article className="kpi"><span>D</span><strong>{estimate.directionalDistribution.toFixed(3)}</strong></article>
            <article className="kpi"><span>Volumen hora de diseño estimado</span><strong>{numberFormat.format(estimate.designHourTotal)}</strong></article>
            <article className="kpi"><span>Dirección principal estimada</span><strong>{numberFormat.format(estimate.mainDirectionHour)}</strong></article>
            <article className="kpi"><span>Dirección opuesta estimada</span><strong>{numberFormat.format(estimate.oppositeDirectionHour)}</strong></article>
            <article className="kpi"><span>Motos/h estimadas</span><strong>{numberFormat.format(estimate.hourlyMotorcycles)}</strong></article>
            <article className="kpi"><span>Pesados/h estimados</span><strong>{numberFormat.format(estimate.hourlyHeavyVehicles)}</strong></article>
          </div>
        )}
      </section>
    </>
  );
}

export function ResultsDashboard({
  summary,
  intervalMinutes,
  source = 'observed',
  tdpaEstimate = null,
  legacyUnverified = false,
}: ResultsDashboardProps) {
  if (source === 'estimated_tdpa') {
    return (
      <div className="results-dashboard">
        <TdpaPanel estimate={tdpaEstimate} />
      </div>
    );
  }

  const intervalChartData = summary.byInterval
    .filter((interval) => interval.complete)
    .map((interval) => ({ label: interval.label, volumen: interval.total }));
  const accessChartData = summary.byAccess.map((access) => ({ label: access.accessName, volumen: access.volume }));
  const movementChartData = summary.byMovement.map((movement) => ({ label: movement.movement, volumen: movement.volume }));
  const hasCompleteIntervals = intervalChartData.length > 0;
  const cycleSummaries = summary.cycleSummaries ?? [];
  const signalGroups = summary.signalGroupIndicators ?? [];

  return (
    <div className="results-dashboard">
      {summary.isPartial && <p className="warning">Resultados parciales: la captura observada no está completa.</p>}
      {legacyUnverified && <p className="warning">Captura heredada pendiente de revisión: los ceros históricos no pueden distinguirse de valores iniciales.</p>}
      {(summary.warnings?.length ?? 0) > 0 && (
        <section className="panel">
          <h3>Advertencias del cálculo</h3>
          <ul>{summary.warnings?.map((warning) => <li key={warning}>{warning}</li>)}</ul>
        </section>
      )}

      <div className="dashboard-kpis">
        <article className="kpi">
          <span>{summary.isComplete ? 'Volumen total observado' : 'Volumen registrado parcial'}</span>
          <strong>{numberFormat.format(summary.totalMotorized)}</strong>
        </article>
        <article className="kpi"><span>Completitud</span><strong>{summary.completionPercent.toFixed(1)}%</strong></article>
        <article className="kpi"><span>Intervalo máximo válido</span><strong>{summary.peakInterval ? `${summary.peakInterval.label} · ${numberFormat.format(summary.peakInterval.volume)}` : 'N/D'}</strong></article>
        <article className="kpi"><span>Hora de máxima demanda</span><strong>{summary.peakHour ? `${summary.peakHour.label} · ${numberFormat.format(summary.peakHour.volume)}` : 'N/D'}</strong></article>
        <article className="kpi"><span><abbr title="Factor de Hora Pico">{summary.peakHour?.factorLabel ?? 'FHP'}</abbr></span><strong>{summary.peakHour?.factor === null || summary.peakHour?.factor === undefined ? 'N/D' : summary.peakHour.factor.toFixed(3)}</strong></article>
        <article className="kpi"><span>Promedio {intervalMinutes} min válido</span><strong>{hasCompleteIntervals ? formatNullable(summary.averageIntervalVolume, 1) : 'N/D'}</strong></article>
        <article className="kpi"><span>Pesados capturados</span><strong>{numberFormat.format(summary.totalHeavy)}</strong></article>
        <article className="kpi"><span>Motos capturadas</span><strong>{numberFormat.format(summary.totalMotorcycles)}</strong></article>
        <article className="kpi"><span>Bicicletas capturadas</span><strong>{numberFormat.format(summary.totalBicycles)}</strong></article>
        <article className="kpi"><span>Peatones capturados</span><strong>{numberFormat.format(summary.totalPedestrians)}</strong></article>
      </div>

      <section className="panel">
        <h3>Calidad de captura</h3>
        <div className="summary-grid">
          <div className="kpi">{summary.completeRows}/{summary.completeRows + summary.incompleteRows + summary.errorRows} filas completas</div>
          <div className="kpi">{summary.incompleteRows} filas incompletas</div>
          <div className="kpi">{summary.errorRows} filas con error</div>
          <div className="kpi">{summary.completionPercent.toFixed(1)}% de completitud</div>
        </div>
      </section>

      {hasCompleteIntervals ? (
        <div className="dashboard-charts">
          <DashboardChart title="Volumen por intervalo" data={intervalChartData} dataKey="volumen" labelKey="label" />
          <DashboardChart title="Volumen por acceso" data={accessChartData} dataKey="volumen" labelKey="label" />
          <DashboardChart title="Distribución por movimiento" data={movementChartData} dataKey="volumen" labelKey="label" />
        </div>
      ) : (
        <section className="panel">
          <h3>Resultados observados no disponibles</h3>
          <p>N/D — complete al menos un intervalo entero para habilitar las gráficas observadas.</p>
        </section>
      )}

      <section className="dashboard-table panel">
        <h3>Aforo consolidado por intervalo</h3>
        <div className="table-wrap dashboard-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Intervalo</th><th>Estado</th><th>Izquierda</th><th>Frente</th><th>Derecha</th><th>Retorno</th><th>Total</th><th>Pesados</th><th>Motos</th><th>Bicicletas</th><th>Peatones</th><th>Observaciones</th>
              </tr>
            </thead>
            <tbody>
              {summary.byInterval.map((interval) => (
                <tr key={interval.intervalId}>
                  <td>{interval.label}</td>
                  <td>{interval.complete ? 'Completo' : 'Parcial'}</td>
                  <td>{interval.complete ? numberFormat.format(interval.left) : 'N/D'}</td>
                  <td>{interval.complete ? numberFormat.format(interval.through) : 'N/D'}</td>
                  <td>{interval.complete ? numberFormat.format(interval.right) : 'N/D'}</td>
                  <td>{interval.complete ? numberFormat.format(interval.uTurn) : 'N/D'}</td>
                  <td><strong>{interval.complete ? numberFormat.format(interval.total) : 'N/D'}</strong></td>
                  <td>{interval.complete ? numberFormat.format(interval.heavy) : 'N/D'}</td>
                  <td>{interval.complete ? numberFormat.format(interval.motorcycles) : 'N/D'}</td>
                  <td>{interval.complete ? numberFormat.format(interval.bicycles) : 'N/D'}</td>
                  <td>{interval.complete ? numberFormat.format(interval.pedestrians) : 'N/D'}</td>
                  <td>{interval.notes || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="dashboard-table panel">
        <h3>Colas y operación</h3>
        <div className="table-wrap dashboard-table-wrap">
          <table>
            <thead><tr><th>Acceso</th><th>Cola máxima (veh)</th><th>Cola promedio (veh)</th><th>Longitud máxima (m)</th><th>Detenidos/ciclo</th><th>Observaciones</th></tr></thead>
            <tbody>
              {summary.queueByAccess.map((queue) => (
                <tr key={queue.accessId}>
                  <td>{queue.accessName}</td><td>{formatNullable(queue.maxQueue, 1)}</td><td>{formatNullable(queue.averageQueue, 1)}</td><td>{formatNullable(queue.maxQueueLength, 1)}</td><td>{formatNullable(queue.stoppedVehiclesPerCycle, 1)}</td><td>{queue.notes || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="dashboard-table panel">
        <h3>Ciclos observados</h3>
        <div className="table-wrap dashboard-table-wrap">
          <table>
            <thead><tr><th>Acceso</th><th>Promedio observado</th><th>Mínimo</th><th>Máximo</th><th>Programado aplicable</th><th>Diferencia promedio</th></tr></thead>
            <tbody>
              {cycleSummaries.map((cycle) => (
                <tr key={cycle.accessId}>
                  <td>{cycle.accessName}</td><td>{formatNullable(cycle.averageObservedCycle, 1)}</td><td>{formatNullable(cycle.minObservedCycle, 1)}</td><td>{formatNullable(cycle.maxObservedCycle, 1)}</td><td>{formatNullable(cycle.programmedCycleSeconds, 1)}</td><td>{formatNullable(cycle.averageDifferenceSeconds, 1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="dashboard-table panel">
        <h3>Indicadores semafóricos por grupo</h3>
        {signalGroups.length === 0 ? (
          <p>N/D — configure grupos movimiento–fase para calcular capacidad y v/c.</p>
        ) : (
          <div className="table-wrap dashboard-table-wrap">
            <table>
              <thead><tr><th>Acceso</th><th>Movimiento</th><th>Programa</th><th>Fase</th><th>Volumen hora pico</th><th>Saturación</th><th>Carriles</th><th>Verde efectivo</th><th>Ciclo</th><th>g/C</th><th>Capacidad</th><th>v/c</th></tr></thead>
              <tbody>
                {signalGroups.map((group) => (
                  <tr key={group.assignmentId}>
                    <td>{group.accessName}</td><td>{group.movementLabel}</td><td>{group.programId}</td><td>{group.phaseId}</td><td>{formatNullable(group.peakHourVolume)}</td><td>{formatNullable(group.saturationFlowPerLane)}</td><td>{formatNullable(group.lanes)}</td><td>{formatNullable(group.effectiveGreenSeconds, 1)}</td><td>{formatNullable(group.cycleSeconds, 1)}</td><td>{formatNullable(group.greenRatio, 3)}</td><td>{formatNullable(group.capacity)}</td><td>{formatNullable(group.volumeCapacityRatio, 3)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {tdpaEstimate && <TdpaPanel estimate={tdpaEstimate} />}
    </div>
  );
}
