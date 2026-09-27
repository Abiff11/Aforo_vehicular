import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { StudySummary } from '../lib/types';

const numberFormat = new Intl.NumberFormat('es-MX');

interface ResultsDashboardProps {
  summary: StudySummary;
  intervalMinutes: number;
}

function formatNullable(value: number | null, digits = 0): string {
  if (value === null || !Number.isFinite(value)) return 'N/D';
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

export function ResultsDashboard({ summary, intervalMinutes }: ResultsDashboardProps) {
  const intervalChartData = summary.byInterval.map((interval) => ({
    label: interval.label,
    volumen: interval.total,
  }));
  const accessChartData = summary.byAccess.map((access) => ({
    label: access.accessName,
    volumen: access.volume,
  }));
  const movementChartData = summary.byMovement.map((movement) => ({
    label: movement.movement,
    volumen: movement.volume,
  }));
  const indicators = summary.signalIndicators;

  return (
    <div className="results-dashboard">
      <div className="dashboard-kpis">
        <article className="kpi"><span>Volumen total</span><strong>{numberFormat.format(summary.totalMotorized)}</strong></article>
        <article className="kpi"><span>Intervalo máximo</span><strong>{summary.peakInterval ? `${summary.peakInterval.label} · ${numberFormat.format(summary.peakInterval.volume)}` : 'N/D'}</strong></article>
        <article className="kpi"><span>Hora de máxima demanda</span><strong>{summary.peakHour ? `${summary.peakHour.label} · ${numberFormat.format(summary.peakHour.volume)}` : 'N/D'}</strong></article>
        <article className="kpi"><span><abbr title="Factor de Hora Pico">{summary.peakHour?.factorLabel ?? 'FHP'}</abbr></span><strong>{summary.peakHour?.factor === null || summary.peakHour?.factor === undefined ? 'N/D' : summary.peakHour.factor.toFixed(3)}</strong></article>
        <article className="kpi"><span>Promedio {intervalMinutes} min</span><strong>{formatNullable(summary.averageIntervalVolume, 1)}</strong></article>
        <article className="kpi"><span><abbr title="Relación entre verde efectivo y ciclo">g/C</abbr></span><strong>{formatNullable(indicators.greenRatio, 3)}</strong></article>
        <article className="kpi"><span><abbr title="Relación volumen/capacidad">v/c</abbr></span><strong>{formatNullable(indicators.volumeCapacityRatio, 3)}</strong></article>
        <article className="kpi"><span>Pesados</span><strong>{numberFormat.format(summary.totalHeavy)}</strong></article>
        <article className="kpi"><span>Motos</span><strong>{numberFormat.format(summary.totalMotorcycles)}</strong></article>
        <article className="kpi"><span>Bicicletas</span><strong>{numberFormat.format(summary.totalBicycles)}</strong></article>
        <article className="kpi"><span>Peatones</span><strong>{numberFormat.format(summary.totalPedestrians)}</strong></article>
      </div>

      <div className="dashboard-charts">
        <DashboardChart title="Volumen por intervalo" data={intervalChartData} dataKey="volumen" labelKey="label" />
        <DashboardChart title="Volumen por acceso" data={accessChartData} dataKey="volumen" labelKey="label" />
        <DashboardChart title="Distribución por movimiento" data={movementChartData} dataKey="volumen" labelKey="label" />
      </div>

      <section className="dashboard-table panel">
        <h3>Aforo consolidado por intervalo</h3>
        <div className="table-wrap dashboard-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Intervalo</th>
                <th>Izquierda</th>
                <th>Frente</th>
                <th>Derecha</th>
                <th>Retorno</th>
                <th>Total</th>
                <th>Pesados</th>
                <th>Motos</th>
                <th>Bicicletas</th>
                <th>Peatones</th>
                <th>Observaciones</th>
              </tr>
            </thead>
            <tbody>
              {summary.byInterval.map((interval) => (
                <tr key={interval.intervalId}>
                  <td>{interval.label}</td>
                  <td>{numberFormat.format(interval.left)}</td>
                  <td>{numberFormat.format(interval.through)}</td>
                  <td>{numberFormat.format(interval.right)}</td>
                  <td>{numberFormat.format(interval.uTurn)}</td>
                  <td><strong>{numberFormat.format(interval.total)}</strong></td>
                  <td>{numberFormat.format(interval.heavy)}</td>
                  <td>{numberFormat.format(interval.motorcycles)}</td>
                  <td>{numberFormat.format(interval.bicycles)}</td>
                  <td>{numberFormat.format(interval.pedestrians)}</td>
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
            <thead>
              <tr>
                <th>Acceso</th>
                <th>Cola máxima (veh)</th>
                <th>Cola promedio (veh)</th>
                <th>Longitud máxima (m)</th>
                <th>Detenidos/ciclo</th>
                <th>Observaciones</th>
              </tr>
            </thead>
            <tbody>
              {summary.queueByAccess.map((queue) => (
                <tr key={queue.accessId}>
                  <td>{queue.accessName}</td>
                  <td>{formatNullable(queue.maxQueue, 1)}</td>
                  <td>{formatNullable(queue.averageQueue, 1)}</td>
                  <td>{formatNullable(queue.maxQueueLength, 1)}</td>
                  <td>{formatNullable(queue.stoppedVehiclesPerCycle, 1)}</td>
                  <td>{queue.notes || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="dashboard-table panel">
        <h3>Indicadores semafóricos</h3>
        <div className="table-wrap dashboard-table-wrap compact-indicators">
          <table>
            <thead>
              <tr><th>Indicador</th><th>Valor</th></tr>
            </thead>
            <tbody>
              <tr><td>Flujo hora pico (veh/h)</td><td>{formatNullable(indicators.peakHourFlow)}</td></tr>
              <tr><td>Verde efectivo (s)</td><td>{formatNullable(indicators.effectiveGreenSeconds, 1)}</td></tr>
              <tr><td><abbr title="Relación entre verde efectivo y ciclo">Proporción de verde g/C</abbr></td><td>{formatNullable(indicators.greenRatio, 3)}</td></tr>
              <tr><td>Flujo de saturación observado (veh/h/carril)</td><td>{formatNullable(indicators.saturationFlowPerLane)}</td></tr>
              <tr><td>Capacidad estimada (veh/h)</td><td>{formatNullable(indicators.capacity)}</td></tr>
              <tr><td><abbr title="Relación volumen/capacidad">Relación demanda/capacidad v/c</abbr></td><td>{formatNullable(indicators.volumeCapacityRatio, 3)}</td></tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
