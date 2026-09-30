import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { calculateStudySummary } from '../lib/calculations';
import {
  createIntersectionTrafficEstimate,
  createTrafficStudyForIntersection,
  parseRoadTrafficCsv,
} from '../lib/roadTrafficImport';
import { intersections } from '../data/intersections';
import { ResultsDashboard } from './ResultsDashboard';

const roadTrafficCsv = `CARRETERA,"CLAVE CARRETERA",RUTA,"PUNTO GENERADOR",KM,TIPO,SC,TDPA2024,M,A,B,C2,C3,T3S2,T3S3,T3S2R4,OTROS,AUTOS,AUTOBUSES,CAMIONES,D,K',LAT,LONG
"Huajuapan de León - Oaxaca",20056,MEX-190,"T. Aut. Cuacnopalan - Oaxaca",181.8,3,1,24977,10.6,80.5,2,3.1,1.2,0.9,0.5,0.8,0.4,91.1,2,6.9,0.511,0.076,17.139925,-96.776604
`;

describe('ResultsDashboard TDPA executive results', () => {
  it('shows validated access and movement estimates with calculation traceability', () => {
    const [record] = parseRoadTrafficCsv(roadTrafficCsv);
    const { study } = createTrafficStudyForIntersection(record, intersections[0]);
    const trafficEstimate = createIntersectionTrafficEstimate(
      record,
      study.configurationSnapshot.accesses,
      {
        mainDirectionAccessId: 'north',
        oppositeDirectionAccessId: 'south',
        movementDistributionByAccess: {
          north: { left: 10, through: 80, right: 10, uTurn: 0 },
          south: { left: 10, through: 80, right: 10, uTurn: 0 },
        },
      },
    );
    const summary = calculateStudySummary(
      study.rows,
      study.configurationSnapshot.accesses,
      study.metadata.intervalMinutes,
    );

    render(
      <ResultsDashboard
        summary={summary}
        intervalMinutes={study.metadata.intervalMinutes}
        source="estimated_tdpa"
        tdpaEstimate={study.tdpaEstimate ?? null}
        tdpaTrafficEstimate={trafficEstimate}
        legacyUnverified={false}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Resultados estimados mediante TDPA' })).toBeInTheDocument();
    expect(screen.getByText('Año de referencia')).toBeInTheDocument();
    expect(screen.getByText('2024')).toBeInTheDocument();

    const table = screen.getByRole('table', { name: 'Distribución estimada TDPA por acceso y movimiento' });
    expect(within(table).getByRole('cell', { name: 'Principal' })).toBeInTheDocument();
    expect(within(table).getByRole('cell', { name: 'Norte' })).toBeInTheDocument();
    expect(within(table).getByRole('cell', { name: '776' })).toBeInTheDocument();
    expect(within(table).getByRole('cell', { name: 'Opuesto' })).toBeInTheDocument();
    expect(within(table).getByRole('cell', { name: 'Sur' })).toBeInTheDocument();
    expect(within(table).getByRole('cell', { name: '742' })).toBeInTheDocument();

    expect(screen.getByRole('heading', { name: 'Volumen estimado por acceso' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Distribución estimada por movimiento' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Cómo se obtuvo este resultado' })).toBeInTheDocument();
    expect(screen.getByText(/TDPA 24,977 veh\/día/)).toBeInTheDocument();
    expect(screen.getByText(/K' 7.6%/)).toBeInTheDocument();
    expect(screen.getByText(/D 51.1%/)).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Volumen por intervalo' })).not.toBeInTheDocument();
  });
});
