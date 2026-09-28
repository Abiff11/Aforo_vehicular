import { describe, expect, it } from 'vitest';
import { intersections } from '../data/intersections';
import {
  calculateRoadTrafficProfile,
  createCorridorTrafficStudies,
  createIntersectionTrafficEstimate,
  createTrafficStudyForIntersection,
  DEFAULT_MOVEMENT_DISTRIBUTION,
  findCorridorIntersections,
  parseRoadTrafficCsv,
  validateMovementDistribution,
} from './roadTrafficImport';
import { calculateStudySummary } from './calculations';
import { createDefaultStudy } from './study';

const sourceCsv = `CARRETERA,"CLAVE CARRETERA",RUTA,"PUNTO GENERADOR",KM,TIPO,SC,TDPA2024,M,A,B,C2,C3,T3S2,T3S3,T3S2R4,OTROS,AUTOS,AUTOBUSES,CAMIONES,D,K',LAT,LONG
"Huajuapan de León - Oaxaca",20056,MEX-190,"T. Aut. Cuacnopalan - Oaxaca",181.8,3,1,24977,10.6,80.5,2,3.1,1.2,0.9,0.5,0.8,0.4,91.1,2,6.9,0.511,0.076,17.139925,-96.776604
`;

describe('road traffic import', () => {
  it('parses the SCT-style road CSV and calculates design-hour flow', () => {
    const [record] = parseRoadTrafficCsv(sourceCsv);
    const profile = calculateRoadTrafficProfile(record);

    expect(record.point).toBe('T. Aut. Cuacnopalan - Oaxaca');
    expect(record.referenceYear).toBe(2024);
    expect(profile.dailyTraffic).toBe(24977);
    expect(profile.designHourTotal).toBe(1898);
    expect(profile.mainDirectionHour).toBe(970);
    expect(profile.oppositeDirectionHour).toBe(928);
    expect(profile.hourlyMotorcycles).toBe(201);
    expect(profile.hourlyHeavyVehicles).toBe(169);
  });

  it('uses the most recent TDPA year available in the CSV', () => {
    const csv = `CARRETERA,"CLAVE CARRETERA",RUTA,"PUNTO GENERADOR",KM,TDPA2024,TDPA2026,M,AUTOS,AUTOBUSES,CAMIONES,D,K',LAT,LONG\nRuta,1,MEX-190,Punto,10,21000,24000,10,85,2,3,0.52,0.08,17.1,-96.7\n`;

    const [record] = parseRoadTrafficCsv(csv);

    expect(record.referenceYear).toBe(2026);
    expect(record.annualDailyTraffic).toBe(24000);
  });

  it('detects the Carretera Panamericana corridor from INT-009', () => {
    const corridor = findCorridorIntersections(intersections, 'INT-009');

    expect(corridor.map((intersection) => intersection.id)).toEqual([
      'INT-009',
      'INT-011',
      'INT-012',
      'INT-013',
      'INT-016',
      'INT-018',
    ]);
  });

  it('validates configurable movement percentages as exactly 100 percent', () => {
    expect(DEFAULT_MOVEMENT_DISTRIBUTION).toEqual({ left: 10, through: 80, right: 10, uTurn: 0 });
    expect(validateMovementDistribution({ left: 12.5, through: 77.5, right: 10, uTurn: 0 })).toEqual([]);
    expect(validateMovementDistribution({ left: 10, through: 75, right: 10, uTurn: 0 })).toContain(
      'La distribución de movimientos debe sumar exactamente 100%.',
    );
    expect(validateMovementDistribution({ left: 10, through: 85, right: 10, uTurn: 0 })).toContain(
      'La distribución de movimientos excede 100%.',
    );
  });

  it('rejects flow assigned to a movement disabled in the physical configuration', () => {
    const study = createDefaultStudy(intersections[0].id);
    const north = study.configurationSnapshot.accesses.find((access) => access.id === 'north');
    if (!north) throw new Error('Acceso norte no encontrado');
    north.movements.right = false;

    const issues = validateMovementDistribution(
      { left: 10, through: 80, right: 10, uTurn: 0 },
      north.movements,
    );

    expect(issues).toContain('El movimiento Derecha está deshabilitado y debe tener 0%.');
  });

  it('creates a configurable design-hour estimate for one intersection without losing vehicles to rounding', () => {
    const [record] = parseRoadTrafficCsv(sourceCsv);
    const study = createDefaultStudy(intersections[0].id);
    const estimate = createIntersectionTrafficEstimate(record, study.configurationSnapshot.accesses, {
      mainDirectionAccessId: 'north',
      oppositeDirectionAccessId: 'south',
      movementDistributionByAccess: {
        north: { left: 12.5, through: 77.5, right: 10, uTurn: 0 },
        south: { left: 10, through: 80, right: 10, uTurn: 0 },
      },
    });

    expect(estimate.referenceYear).toBe(2024);
    expect(estimate.designHourTotal).toBe(1898);
    expect(estimate.accesses).toHaveLength(2);

    const north = estimate.accesses.find((access) => access.accessId === 'north');
    const south = estimate.accesses.find((access) => access.accessId === 'south');

    expect(north?.hourlyVolume).toBe(970);
    expect(north?.movements).toEqual({ left: 121, through: 752, right: 97, uTurn: 0 });
    expect(Object.values(north?.movements ?? {}).reduce((sum, value) => sum + value, 0)).toBe(970);
    expect(south?.hourlyVolume).toBe(928);
    expect(Object.values(south?.movements ?? {}).reduce((sum, value) => sum + value, 0)).toBe(928);
  });

  it('creates a TDPA estimate without fabricating an observed intersection count', () => {
    const [record] = parseRoadTrafficCsv(sourceCsv);
    const imported = createTrafficStudyForIntersection(record, intersections[8]);
    const summary = calculateStudySummary(
      imported.study.rows,
      imported.study.configurationSnapshot.accesses,
      imported.study.metadata.intervalMinutes,
    );

    expect(imported.study.source).toBe('estimated_tdpa');
    expect(imported.study.currentStep).toBe(6);
    expect(imported.study.tdpaEstimate).toMatchObject({
      referenceYear: 2024,
      dailyTraffic: 24977,
      designHourFactor: 0.076,
      directionalDistribution: 0.511,
      designHourTotal: 1898,
      mainDirectionHour: 970,
      oppositeDirectionHour: 928,
      hourlyMotorcycles: 201,
      hourlyHeavyVehicles: 169,
    });
    expect(imported.study.rows.every((row) =>
      row.left === null &&
      row.through === null &&
      row.right === null &&
      row.uTurn === null &&
      row.heavy === null &&
      row.motorcycles === null &&
      row.bicycles === null &&
      row.pedestrians === null
    )).toBe(true);
    expect(summary.totalMotorized).toBe(0);
    expect(summary.peakHour).toBeNull();
  });

  it('attaches TDPA to an existing observed capture without reclassifying or overwriting it', () => {
    const [record] = parseRoadTrafficCsv(sourceCsv);
    const base = createDefaultStudy(intersections[0].id);
    const observed = {
      ...base,
      rows: base.rows.map((item, index) => index === 0 ? { ...item, through: 25 } : item),
    };
    const imported = createTrafficStudyForIntersection(record, intersections[0], observed);

    expect(imported.study.source).toBe('observed');
    expect(imported.study.rows[0].through).toBe(25);
    expect(imported.study.tdpaEstimate).toMatchObject({ designHourTotal: 1898 });
  });

  it('keeps corridor estimates separate instead of distributing TDPA into 15-minute rows', () => {
    const [record] = parseRoadTrafficCsv(sourceCsv);
    const studies = createCorridorTrafficStudies(record, intersections, 'INT-009');

    expect(studies).toHaveLength(6);
    expect(studies.every(({ study }) => study.source === 'estimated_tdpa')).toBe(true);
    expect(studies.every(({ study }) => study.rows.every((row) => row.through === null))).toBe(true);
    expect(studies.every(({ study }) => study.tdpaEstimate?.designHourTotal === 1898)).toBe(true);
  });
});
