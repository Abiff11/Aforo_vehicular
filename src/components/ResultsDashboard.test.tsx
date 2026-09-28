import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { calculateStudySummary } from '../lib/calculations';
import { createDefaultStudy } from '../lib/study';
import { createTrafficStudyForIntersection, parseRoadTrafficCsv } from '../lib/roadTrafficImport';
import { intersections } from '../data/intersections';
import type { AccessConfig, CaptureRow, IntervalBlock, SignalMovementAssignment, SignalProgram } from '../lib/types';
import { ResultsDashboard } from './ResultsDashboard';

const roadTrafficCsv = `CARRETERA,"CLAVE CARRETERA",RUTA,"PUNTO GENERADOR",KM,TIPO,SC,TDPA2024,M,A,B,C2,C3,T3S2,T3S3,T3S2R4,OTROS,AUTOS,AUTOBUSES,CAMIONES,D,K',LAT,LONG
"Huajuapan de León - Oaxaca",20056,MEX-190,"T. Aut. Cuacnopalan - Oaxaca",181.8,3,1,24977,10.6,80.5,2,3.1,1.2,0.9,0.5,0.8,0.4,91.1,2,6.9,0.511,0.076,17.139925,-96.776604
`;

function summaryForStudy() {
  const study = createDefaultStudy('INT-001');
  const summary = calculateStudySummary(
    study.rows,
    study.configurationSnapshot.accesses,
    study.metadata.intervalMinutes,
    {
      programs: study.configurationSnapshot.programs,
      assignments: study.configurationSnapshot.signalMovementAssignments ?? [],
    },
  );
  return { study, summary };
}

const formalIntervals: IntervalBlock[] = [
  { id: '07:00-07:15', start: '07:00', end: '07:15', label: '07:00-07:15' },
  { id: '07:15-07:30', start: '07:15', end: '07:30', label: '07:15-07:30' },
  { id: '07:30-07:45', start: '07:30', end: '07:45', label: '07:30-07:45' },
  { id: '07:45-08:00', start: '07:45', end: '08:00', label: '07:45-08:00' },
];

const formalAccess: AccessConfig = {
  id: 'north',
  name: 'Norte',
  lanes: 2,
  movements: { left: true, through: true, right: true, uTurn: false },
};

const formalProgram: SignalProgram = {
  id: 'p1',
  name: 'Pico AM',
  startTime: '07:00',
  endTime: '09:00',
  cycleSeconds: 90,
  phases: 1,
  greenSeconds: 40,
  amberSeconds: 3,
  redSeconds: 47,
  clearanceSeconds: null,
  phaseTimings: [
    { id: 'phase-1', name: 'Fase 1', cycleSeconds: 90, greenSeconds: 40, amberSeconds: 3, redSeconds: 47 },
  ],
  notes: '',
};

const formalAssignment: SignalMovementAssignment = {
  id: 'north-through',
  accessId: 'north',
  movement: 'through',
  programId: 'p1',
  phaseId: 'phase-1',
  lanes: 2,
  saturationFlowPerLane: 1800,
  saturationSource: 'measured',
  effectiveGreenSeconds: 40,
};

function formalRow(interval: IntervalBlock, through: number): CaptureRow {
  return {
    id: `${interval.id}-north`,
    intervalId: interval.id,
    intervalLabel: interval.label,
    intervalStart: interval.start,
    intervalEnd: interval.end,
    accessId: 'north',
    accessName: 'Norte',
    left: 0,
    through,
    right: 0,
    uTurn: null,
    heavy: 0,
    motorcycles: 0,
    bicycles: 0,
    pedestrians: 0,
    maxQueue: null,
    averageQueue: null,
    queueLength: null,
    stoppedVehiclesPerCycle: null,
    observedCycle: null,
    observedProgram: '',
    notes: '',
  };
}

describe('ResultsDashboard calculation integrity', () => {
  it('labels incomplete observed data as partial and withholds definitive charts', () => {
    const { study, summary } = summaryForStudy();
    render(
      <ResultsDashboard
        summary={summary}
        intervalMinutes={study.metadata.intervalMinutes}
        source="observed"
        tdpaEstimate={null}
        legacyUnverified={false}
      />,
    );

    expect(screen.getByRole('region', { name: 'Resumen ejecutivo de resultados' })).toBeInTheDocument();
    expect(screen.getByText('Resultados parciales: la captura observada no está completa.')).toBeInTheDocument();
    expect(screen.getByText('Volumen registrado parcial')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Calidad de captura' })).toBeInTheDocument();
    expect(screen.getByText(/0\/32 filas completas/)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Resultados observados no disponibles' })).toBeInTheDocument();
    expect(screen.getByText('N/D — complete al menos un intervalo entero para habilitar las gráficas observadas.')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Volumen por intervalo' })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Ciclos observados' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Indicadores semafóricos por grupo' })).toBeInTheDocument();
    expect(screen.getByText('N/D — configure grupos movimiento–fase para calcular capacidad y v/c.')).toBeInTheDocument();
  });

  it('shows charts when at least one complete observed interval exists', () => {
    const partialRows = [
      formalRow(formalIntervals[0], 100),
      { ...formalRow(formalIntervals[1], 200), left: null },
    ];
    const summary = calculateStudySummary(partialRows, [formalAccess], 15);

    render(
      <ResultsDashboard
        summary={summary}
        intervalMinutes={15}
        source="observed"
        tdpaEstimate={null}
        legacyUnverified={false}
      />,
    );

    expect(screen.getByRole('region', { name: 'Resultados observados' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Volumen por intervalo' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Volumen por acceso' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Distribución por movimiento' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Resultados observados no disponibles' })).not.toBeInTheDocument();
    expect(screen.getByText('Promedio 15 min válido')).toBeInTheDocument();
  });

  it('renders formal lane-group indicators exactly from the shared calculation summary', () => {
    const rows = [100, 120, 140, 160].map((through, index) => formalRow(formalIntervals[index], through));
    const summary = calculateStudySummary(rows, [formalAccess], 15, {
      programs: [formalProgram],
      assignments: [formalAssignment],
    });
    const expected = summary.signalGroupIndicators?.[0];

    render(
      <ResultsDashboard
        summary={summary}
        intervalMinutes={15}
        source="observed"
        tdpaEstimate={null}
        legacyUnverified={false}
      />,
    );

    expect(expected).toBeDefined();
    const section = screen.getByRole('heading', { name: 'Indicadores semafóricos por grupo' }).closest('section');
    expect(section).not.toBeNull();
    const table = within(section as HTMLElement);
    expect(table.getByRole('cell', { name: 'Norte' })).toBeInTheDocument();
    expect(table.getByRole('cell', { name: 'Frente' })).toBeInTheDocument();
    expect(table.getByRole('cell', { name: String(expected?.peakHourVolume) })).toBeInTheDocument();
    expect(table.getByRole('cell', { name: '1,800' })).toBeInTheDocument();
    expect(table.getByRole('cell', { name: '2' })).toBeInTheDocument();
    expect(table.getByRole('cell', { name: '40.0' })).toBeInTheDocument();
    expect(table.getByRole('cell', { name: '90.0' })).toBeInTheDocument();
    expect(table.getByRole('cell', { name: (expected?.greenRatio ?? 0).toFixed(3) })).toBeInTheDocument();
    expect(table.getByRole('cell', { name: '1,600' })).toBeInTheDocument();
    expect(table.getByRole('cell', { name: (expected?.volumeCapacityRatio ?? 0).toFixed(3) })).toBeInTheDocument();
  });

  it('renders TDPA in a separate estimate panel without observed charts when the study is estimate-only', () => {
    const [record] = parseRoadTrafficCsv(roadTrafficCsv);
    const { study } = createTrafficStudyForIntersection(record, intersections[0]);
    const summary = calculateStudySummary(
      study.rows,
      study.configurationSnapshot.accesses,
      study.metadata.intervalMinutes,
      {
        programs: study.configurationSnapshot.programs,
        assignments: study.configurationSnapshot.signalMovementAssignments ?? [],
      },
    );

    render(
      <ResultsDashboard
        summary={summary}
        intervalMinutes={study.metadata.intervalMinutes}
        source="estimated_tdpa"
        tdpaEstimate={study.tdpaEstimate ?? null}
        legacyUnverified={false}
      />,
    );

    expect(screen.getByRole('region', { name: 'Estimación TDPA' })).toBeInTheDocument();
    expect(screen.getByText('ESTIMACIÓN TDPA — NO SUSTITUYE UN AFORO DE INTERSECCIÓN EN CAMPO.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Estimación TDPA' })).toBeInTheDocument();
    expect(screen.getByText('Volumen hora de diseño estimado')).toBeInTheDocument();
    expect(screen.getByText('1,898')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Volumen por intervalo' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Aforo consolidado por intervalo' })).not.toBeInTheDocument();
  });

  it('shows TDPA as an independent panel without promoting partial observed capture to charts', () => {
    const [record] = parseRoadTrafficCsv(roadTrafficCsv);
    const base = createDefaultStudy('INT-001');
    const observed = {
      ...base,
      rows: base.rows.map((row, index) => index === 0 ? { ...row, through: 25 } : row),
    };
    const { study } = createTrafficStudyForIntersection(record, intersections[0], observed);
    const summary = calculateStudySummary(
      study.rows,
      study.configurationSnapshot.accesses,
      study.metadata.intervalMinutes,
      {
        programs: study.configurationSnapshot.programs,
        assignments: study.configurationSnapshot.signalMovementAssignments ?? [],
      },
    );

    render(
      <ResultsDashboard
        summary={summary}
        intervalMinutes={study.metadata.intervalMinutes}
        source={study.source}
        tdpaEstimate={study.tdpaEstimate ?? null}
        legacyUnverified={false}
      />,
    );

    expect(study.source).toBe('observed');
    expect(screen.getByRole('heading', { name: 'Resultados observados no disponibles' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Volumen por intervalo' })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Estimación TDPA' })).toBeInTheDocument();
    expect(screen.getByText('ESTIMACIÓN TDPA — NO SUSTITUYE UN AFORO DE INTERSECCIÓN EN CAMPO.')).toBeInTheDocument();
  });
});