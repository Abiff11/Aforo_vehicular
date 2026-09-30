import { describe, expect, it } from 'vitest';
import { createTrafficStudyForIntersection, parseRoadTrafficCsv } from './roadTrafficImport';
import type { Intersection } from './types';

const firstCsv = `CARRETERA,"CLAVE CARRETERA",RUTA,"PUNTO GENERADOR",KM,TDPA2024,M,AUTOS,AUTOBUSES,CAMIONES,D,K',LAT,LONG
"Carretera A",A-001,RUTA-A,"Punto A1",10,20000,10,85,2,3,0.52,0.08,17.0002,-96.7000
`;

const updatedCsv = `CARRETERA,"CLAVE CARRETERA",RUTA,"PUNTO GENERADOR",KM,TDPA2026,M,AUTOS,AUTOBUSES,CAMIONES,D,K',LAT,LONG
"Carretera A",A-001,RUTA-A,"Punto A2",10,24000,10,85,2,3,0.52,0.08,17.0002,-96.7000
`;

const intersection: Intersection = {
  id: 'INT-A',
  mapNumber: 1,
  name: 'Carretera A / Calle 1',
  municipality: 'Oaxaca de Juárez',
  locality: 'Oaxaca de Juárez',
  verificationStatus: 'verified',
  latitude: 17,
  longitude: -96.7,
  notes: '',
  relatedIntersectionIds: [],
};

describe('TDPA reimport lifecycle', () => {
  it('invalidates a previously generated and validated estimate when the TDPA source changes', () => {
    const [firstRecord] = parseRoadTrafficCsv(firstCsv);
    const [updatedRecord] = parseRoadTrafficCsv(updatedCsv);
    const initial = createTrafficStudyForIntersection(firstRecord, intersection).study;
    const generated = {
      ...initial,
      tdpaGeneratedAt: '2026-09-30T12:00:00.000Z',
      status: 'validated' as const,
    };

    const reimported = createTrafficStudyForIntersection(updatedRecord, intersection, generated).study;

    expect(reimported.tdpaEstimate?.referenceYear).toBe(2026);
    expect(reimported.tdpaEstimate?.dailyTraffic).toBe(24000);
    expect(reimported.tdpaGeneratedAt).toBeNull();
    expect(reimported.status).toBe('draft');
  });
});
