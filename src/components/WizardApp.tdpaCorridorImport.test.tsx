import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { createDefaultStudy } from '../lib/study';
import { createInitialState, saveStoredState, STORAGE_KEY } from '../lib/storage';
import type { Intersection, VersionedStoredState } from '../lib/types';
import { WizardApp } from './WizardApp';

const multiRoadCsv = `CARRETERA,"CLAVE CARRETERA",RUTA,"PUNTO GENERADOR",KM,TDPA2026,M,AUTOS,AUTOBUSES,CAMIONES,D,K',LAT,LONG
"Carretera A",A-001,RUTA-A,"Punto A1",10,20000,10,85,2,3,0.52,0.08,17.0002,-96.7000
"Carretera A",A-001,RUTA-A,"Punto A2",20,24000,10,85,2,3,0.52,0.08,17.0102,-96.7000
"Carretera B",B-001,RUTA-B,"Punto B1",5,50000,10,85,2,3,0.52,0.08,18.0000,-97.0000
`;

const corridorIntersections: Intersection[] = [
  {
    id: 'INT-A',
    mapNumber: 1,
    name: 'Carretera A / Calle 1',
    municipality: 'Oaxaca de Juárez',
    locality: 'Oaxaca de Juárez',
    verificationStatus: 'verified',
    latitude: 17.0000,
    longitude: -96.7000,
    notes: '',
    relatedIntersectionIds: ['INT-B'],
  },
  {
    id: 'INT-B',
    mapNumber: 2,
    name: 'Carretera A / Calle 2',
    municipality: 'Oaxaca de Juárez',
    locality: 'Oaxaca de Juárez',
    verificationStatus: 'verified',
    latitude: 17.0100,
    longitude: -96.7000,
    notes: '',
    relatedIntersectionIds: ['INT-C'],
  },
  {
    id: 'INT-C',
    mapNumber: 3,
    name: 'Carretera A / Calle 3',
    municipality: 'Oaxaca de Juárez',
    locality: 'Oaxaca de Juárez',
    verificationStatus: 'verified',
    latitude: 17.0200,
    longitude: -96.7000,
    notes: '',
    relatedIntersectionIds: [],
  },
];

describe('WizardApp TDPA corridor import', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('applies every CSV record to the linked corridor while preserving observed capture', async () => {
    const studyA = { ...createDefaultStudy('INT-A'), currentStep: 1, relatedIntersectionIds: ['INT-B'] };
    const observedB = createDefaultStudy('INT-B');
    observedB.metadata.surveyor = 'Aforador de campo';
    observedB.rows[0].through = 37;
    const studyC = createDefaultStudy('INT-C');
    const initial = createInitialState();

    saveStoredState({
      ...initial,
      customIntersections: corridorIntersections,
      activeStudy: studyA,
      studiesByIntersection: {
        'INT-A': studyA,
        'INT-B': observedB,
        'INT-C': studyC,
      },
    });

    render(<WizardApp />);
    fireEvent.change(screen.getByLabelText('Importar CSV TDPA'), {
      target: { files: [new File([multiRoadCsv], 'corredor.csv', { type: 'text/csv' })] },
    });

    await waitFor(() => {
      expect(screen.getByText('3 intersecciones del corredor preparadas con TDPA.')).toBeInTheDocument();
    });
    const guide = screen.getByRole('status', { name: 'Guía posterior a importación TDPA' });
    expect(guide).toHaveTextContent('Corredor: Carretera A. Punto activo: Punto A1.');

    const persisted = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as VersionedStoredState;
    const persistedIntersections = persisted.customIntersections ?? [];
    const persistedStudies = persisted.studiesByIntersection ?? {};
    expect(persisted.activeStudy?.intersectionId).toBe('INT-A');
    expect(persisted.activeStudy?.currentStep).toBe(1);
    expect(persisted.activeStudy?.tdpaEstimate?.point).toBe('Punto A1');

    expect(persistedIntersections.map((intersection) => intersection.linkedCsvFileName)).toEqual([
      'corredor.csv',
      'corredor.csv',
      'corredor.csv',
    ]);
    expect([
      persistedStudies['INT-A']?.tdpaEstimate?.dailyTraffic,
      persistedStudies['INT-B']?.tdpaEstimate?.dailyTraffic,
      persistedStudies['INT-C']?.tdpaEstimate?.dailyTraffic,
    ]).toEqual([20000, 24000, 24000]);
    expect([
      persistedStudies['INT-A']?.currentStep,
      persistedStudies['INT-B']?.currentStep,
      persistedStudies['INT-C']?.currentStep,
    ]).toEqual([1, 1, 1]);

    expect(persistedStudies['INT-B']?.source).toBe('observed');
    expect(persistedStudies['INT-B']?.rows[0].through).toBe(37);
    expect(persistedStudies['INT-B']?.metadata.surveyor).toBe('Aforador de campo');
    expect(persistedStudies['INT-C']?.source).toBe('estimated_tdpa');
  });
});
