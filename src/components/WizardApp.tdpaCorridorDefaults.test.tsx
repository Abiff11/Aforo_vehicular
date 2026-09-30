import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { createTrafficStudyForIntersection, parseRoadTrafficCsv } from '../lib/roadTrafficImport';
import { createInitialState, loadStoredState, saveStoredState } from '../lib/storage';
import type { Intersection, Study } from '../lib/types';
import { WizardApp } from './WizardApp';

const roadTrafficCsv = `CARRETERA,"CLAVE CARRETERA",RUTA,"PUNTO GENERADOR",KM,TDPA2026,M,AUTOS,AUTOBUSES,CAMIONES,D,K',LAT,LONG
"Carretera A",A-001,RUTA-A,"Punto A1",10,20000,10,85,2,3,0.52,0.08,17.0002,-96.7000
"Carretera A",A-001,RUTA-A,"Punto A2",20,24000,10,85,2,3,0.52,0.08,17.0102,-96.7000
`;

const corridorIntersections: Intersection[] = [
  {
    id: 'INT-A', mapNumber: 1, name: 'Carretera A / Calle 1', municipality: 'Oaxaca de Juárez', locality: 'Oaxaca de Juárez',
    verificationStatus: 'verified', latitude: 17, longitude: -96.7, notes: '', linkedCsvFileName: 'corredor.csv', relatedIntersectionIds: ['INT-B'],
  },
  {
    id: 'INT-B', mapNumber: 2, name: 'Carretera A / Calle 2', municipality: 'Oaxaca de Juárez', locality: 'Oaxaca de Juárez',
    verificationStatus: 'verified', latitude: 17.01, longitude: -96.7, notes: '', linkedCsvFileName: 'corredor.csv', relatedIntersectionIds: ['INT-C'],
  },
  {
    id: 'INT-C', mapNumber: 3, name: 'Carretera A / Calle 3', municipality: 'Oaxaca de Juárez', locality: 'Oaxaca de Juárez',
    verificationStatus: 'verified', latitude: 17.02, longitude: -96.7, notes: '', linkedCsvFileName: 'corredor.csv', relatedIntersectionIds: [],
  },
];

function prepareStudy(intersection: Intersection, recordIndex: number): Study {
  const records = parseRoadTrafficCsv(roadTrafficCsv);
  const { study } = createTrafficStudyForIntersection(records[Math.min(recordIndex, records.length - 1)], intersection);
  return { ...study, currentStep: 2, relatedIntersectionIds: intersection.relatedIntersectionIds ?? [] };
}

describe('WizardApp TDPA corridor defaults', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('applies one TDPA base configuration to the linked corridor and keeps later intersection edits independent', () => {
    const initial = createInitialState();
    const studyA = prepareStudy(corridorIntersections[0], 0);
    const studyB = prepareStudy(corridorIntersections[1], 1);
    const studyC = prepareStudy(corridorIntersections[2], 1);

    saveStoredState({
      ...initial,
      customIntersections: corridorIntersections,
      activeStudy: studyA,
      studiesByIntersection: { 'INT-A': studyA, 'INT-B': studyB, 'INT-C': studyC },
    });

    render(<WizardApp />);

    fireEvent.change(screen.getByLabelText('Porcentaje Frente Norte'), { target: { value: '70' } });
    fireEvent.change(screen.getByLabelText('Porcentaje Derecha Norte'), { target: { value: '20' } });
    fireEvent.click(screen.getByRole('button', { name: 'Usar uniforme 25/25/25/25' }));
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar configuración TDPA al corredor' }));

    let persisted = loadStoredState();
    expect(persisted.studiesByIntersection?.['INT-B']?.tdpaCorridorSettings?.movementDistributionByAccess.north).toEqual({
      left: 10, through: 70, right: 20, uTurn: 0,
    });
    expect(persisted.studiesByIntersection?.['INT-C']?.tdpaCorridorSettings?.temporalDistribution).toEqual([25, 25, 25, 25]);

    fireEvent.change(screen.getByLabelText('Porcentaje Frente Norte'), { target: { value: '60' } });

    persisted = loadStoredState();
    expect(persisted.activeStudy?.tdpaCorridorSettings?.movementDistributionByAccess.north.through).toBe(60);
    expect(persisted.studiesByIntersection?.['INT-B']?.tdpaCorridorSettings?.movementDistributionByAccess.north.through).toBe(70);
  });
});
