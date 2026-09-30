import { describe, expect, it } from 'vitest';
import { intersections } from '../data/intersections';
import { createDefaultStudy } from './study';
import {
  createIntersectionTrafficEstimate,
  parseRoadTrafficCsv,
} from './roadTrafficImport';
import {
  allocateTdpaTemporalVolume,
  createTdpaTemporalEstimate,
  UNIFORM_TDPA_TEMPORAL_DISTRIBUTION,
  validateTdpaTemporalDistribution,
} from './tdpaTemporalProfile';

const sourceCsv = `CARRETERA,"CLAVE CARRETERA",RUTA,"PUNTO GENERADOR",KM,TIPO,SC,TDPA2024,M,A,B,C2,C3,T3S2,T3S3,T3S2R4,OTROS,AUTOS,AUTOBUSES,CAMIONES,D,K',LAT,LONG
"Huajuapan de León - Oaxaca",20056,MEX-190,"T. Aut. Cuacnopalan - Oaxaca",181.8,3,1,24977,10.6,80.5,2,3.1,1.2,0.9,0.5,0.8,0.4,91.1,2,6.9,0.511,0.076,17.139925,-96.776604
`;

describe('TDPA temporal profile', () => {
  it('exposes the uniform 25/25/25/25 distribution only as an explicit preset', () => {
    expect(UNIFORM_TDPA_TEMPORAL_DISTRIBUTION).toEqual([25, 25, 25, 25]);
  });

  it('requires exactly four 15-minute percentages that sum to 100 percent', () => {
    expect(validateTdpaTemporalDistribution([20, 30, 25, 25])).toEqual([]);
    expect(validateTdpaTemporalDistribution([20, 30, 20, 20])).toContain(
      'La distribución temporal TDPA debe sumar exactamente 100%.',
    );
    expect(validateTdpaTemporalDistribution([30, 30, 30, 20])).toContain(
      'La distribución temporal TDPA excede 100%.',
    );
    expect(validateTdpaTemporalDistribution([50, 50, 0])).toContain(
      'El perfil temporal TDPA debe contener exactamente cuatro intervalos de 15 minutos.',
    );
  });

  it('rejects invalid percentages in a temporal interval', () => {
    expect(validateTdpaTemporalDistribution([25, -1, 26, 50])).toContain(
      'El porcentaje del intervalo 2 debe estar entre 0% y 100%.',
    );
    expect(validateTdpaTemporalDistribution([25, 25, 25, 125])).toContain(
      'El porcentaje del intervalo 4 debe estar entre 0% y 100%.',
    );
  });

  it('allocates a uniform profile without losing the hourly total to rounding', () => {
    const intervals = allocateTdpaTemporalVolume(1898, UNIFORM_TDPA_TEMPORAL_DISTRIBUTION);

    expect(intervals).toEqual([475, 475, 474, 474]);
    expect(intervals.reduce((sum, value) => sum + value, 0)).toBe(1898);
  });

  it('allocates a custom profile by largest remainder and preserves the total', () => {
    const intervals = allocateTdpaTemporalVolume(1898, [20, 30, 25, 25]);

    expect(intervals).toEqual([380, 569, 475, 474]);
    expect(intervals.reduce((sum, value) => sum + value, 0)).toBe(1898);
  });

  it('generates four estimated intervals preserving every movement and access hourly total', () => {
    const [record] = parseRoadTrafficCsv(sourceCsv);
    const study = createDefaultStudy(intersections[0].id);
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

    const temporal = createTdpaTemporalEstimate(
      trafficEstimate,
      UNIFORM_TDPA_TEMPORAL_DISTRIBUTION,
    );

    expect(temporal.distribution).toEqual([25, 25, 25, 25]);
    expect(temporal.intervals.map((interval) => interval.label)).toEqual([
      '0–15 min',
      '15–30 min',
      '30–45 min',
      '45–60 min',
    ]);
    expect(temporal.intervals.map((interval) => interval.total)).toEqual([478, 474, 473, 473]);
    expect(temporal.intervals.reduce((sum, interval) => sum + interval.total, 0)).toBe(1898);

    const north = temporal.intervals.map((interval) => interval.accesses.find((access) => access.accessId === 'north'));
    expect(north.map((access) => access?.total)).toEqual([244, 242, 242, 242]);
    expect(north.reduce((sum, access) => sum + (access?.movements.through ?? 0), 0)).toBe(776);
    expect(north.reduce((sum, access) => sum + (access?.total ?? 0), 0)).toBe(970);
  });
});
