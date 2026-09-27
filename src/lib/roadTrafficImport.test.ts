import { describe, expect, it } from 'vitest';
import { intersections } from '../data/intersections';
import {
  calculateRoadTrafficProfile,
  createCorridorTrafficStudies,
  findCorridorIntersections,
  parseRoadTrafficCsv,
} from './roadTrafficImport';

const sourceCsv = `CARRETERA,"CLAVE CARRETERA",RUTA,"PUNTO GENERADOR",KM,TIPO,SC,TDPA2024,M,A,B,C2,C3,T3S2,T3S3,T3S2R4,OTROS,AUTOS,AUTOBUSES,CAMIONES,D,K',LAT,LONG
"Huajuapan de León - Oaxaca",20056,MEX-190,"T. Aut. Cuacnopalan - Oaxaca",181.8,3,1,24977,10.6,80.5,2,3.1,1.2,0.9,0.5,0.8,0.4,91.1,2,6.9,0.511,0.076,17.139925,-96.776604
`;

describe('road traffic import', () => {
  it('parses the SCT-style road CSV and calculates design-hour flow', () => {
    const [record] = parseRoadTrafficCsv(sourceCsv);
    const profile = calculateRoadTrafficProfile(record);

    expect(record.point).toBe('T. Aut. Cuacnopalan - Oaxaca');
    expect(profile.dailyTraffic).toBe(24977);
    expect(profile.designHourTotal).toBe(1898);
    expect(profile.mainDirectionHour).toBe(970);
    expect(profile.oppositeDirectionHour).toBe(928);
    expect(profile.hourlyMotorcycles).toBe(201);
    expect(profile.hourlyHeavyVehicles).toBe(169);
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

  it('creates complete one-hour studies for every corridor intersection without inventing turning movements', () => {
    const [record] = parseRoadTrafficCsv(sourceCsv);
    const studies = createCorridorTrafficStudies(record, intersections, 'INT-009');
    const first = studies[0];

    expect(studies).toHaveLength(6);
    expect(first.intersection.id).toBe('INT-009');
    expect(first.study.currentStep).toBe(6);
    expect(first.study.metadata).toMatchObject({
      startTime: '07:00',
      endTime: '08:00',
      intervalMinutes: 15,
    });
    expect(first.study.rows.filter((row) => row.accessId === 'north').map((row) => row.through)).toEqual([243, 243, 242, 242]);
    expect(first.study.rows.filter((row) => row.accessId === 'south').map((row) => row.through)).toEqual([232, 232, 232, 232]);
    expect(first.study.rows.every((row) => row.left === 0 && row.right === 0 && row.uTurn === null)).toBe(true);
    expect(first.study.rows.some((row) => row.notes.includes('Giros no disponibles'))).toBe(true);
  });
});
