import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { calculateStudySummary } from '../lib/calculations';
import { createDefaultStudy } from '../lib/study';
import { createTrafficStudyForIntersection, parseRoadTrafficCsv } from '../lib/roadTrafficImport';
import { intersections } from '../data/intersections';
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

describe('ResultsDashboard calculation integrity', () => {
  it('labels incomplete observed data as partial and exposes capture quality', () => {
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

    expect(screen.getByText('Resultados parciales: la captura observada no está completa.')).toBeInTheDocument();
    expect(screen.getByText('Volumen registrado parcial')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Calidad de captura' })).toBeInTheDocument();
    expect(screen.getByText(/0\/32 filas completas/)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Ciclos observados' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Indicadores semafóricos por grupo' })).toBeInTheDocument();
    expect(screen.getByText('N/D — configure grupos movimiento–fase para calcular capacidad y v/c.')).toBeInTheDocument();
  });

  it('renders TDPA in a separate estimate panel without observed charts', () => {
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

    expect(screen.getByText('ESTIMACIÓN TDPA — NO SUSTITUYE UN AFORO DE INTERSECCIÓN EN CAMPO.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Estimación TDPA' })).toBeInTheDocument();
    expect(screen.getByText('Volumen hora de diseño estimado')).toBeInTheDocument();
    expect(screen.getByText('1,898')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Volumen por intervalo' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Aforo consolidado por intervalo' })).not.toBeInTheDocument();
  });
});
