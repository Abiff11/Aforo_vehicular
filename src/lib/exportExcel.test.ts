import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { exportStudyWorkbook } from './exportExcel';
import { createDefaultStudy } from './study';
import { intersections } from '../data/intersections';
import type { Study } from './types';

function createFichaStudy(): Study {
  const study = createDefaultStudy('INT-001');
  const firstInterval = study.intervals[0].id;
  const secondInterval = study.intervals[1].id;

  return {
    ...study,
    metadata: {
      ...study.metadata,
      date: '2026-09-28',
      surveyor: 'Aforador prueba',
      weather: 'Despejado',
      observedSaturationFlowPerLane: 1800,
      notes: 'Estudio de validación',
    },
    rows: study.rows.map((row) => {
      if (row.accessId === 'north' && row.intervalId === firstInterval) {
        return {
          ...row,
          left: 10,
          through: 80,
          right: 10,
          heavy: 12,
          motorcycles: 8,
          bicycles: 3,
          pedestrians: 5,
          maxQueue: 14,
          averageQueue: 8,
          queueLength: 56,
          stoppedVehiclesPerCycle: 7,
          observedCycle: 90,
          observedProgram: 'P1',
          notes: 'Demanda alta',
        };
      }

      if (row.accessId === 'north' && row.intervalId === secondInterval) {
        return {
          ...row,
          left: 5,
          through: 40,
          right: 5,
          heavy: 6,
          motorcycles: 4,
          maxQueue: 18,
          averageQueue: 10,
          queueLength: 72,
          stoppedVehiclesPerCycle: 9,
        };
      }

      return row;
    }),
  };
}

describe('exportStudyWorkbook', () => {
  it('creates the seven required sheets without invalid numeric values', () => {
    const study = createDefaultStudy('INT-001');
    const workbook = exportStudyWorkbook(study, intersections[0]);
    const names = workbook.SheetNames;

    expect(names).toEqual([
      '01_FICHA_TECNICA',
      '02_DASHBOARD',
      '03_AFORO_DETALLADO',
      '04_PROGRAMACION',
      '05_COLAS_OPERACION',
      '06_INDICADORES',
      '07_INSTRUCTIVO',
    ]);

    const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' });
    const parsed = XLSX.read(buffer, { type: 'buffer' });
    const allCells = parsed.SheetNames.flatMap((name) => Object.values(parsed.Sheets[name]));

    expect(allCells.some((cell) => typeof cell === 'object' && String(cell.v).match(/NaN|Infinity|#DIV\/0!/))).toBe(false);
  });

  it('builds a ficha tecnica with the reference sections and consolidated interval data', () => {
    const study = createFichaStudy();
    const workbook = exportStudyWorkbook(study, intersections[0]);
    const ficha = XLSX.utils.sheet_to_json<Array<string | number>>(workbook.Sheets['01_FICHA_TECNICA'], {
      header: 1,
      defval: '',
    });

    expect(ficha.some((row) => row.includes('1. DATOS GENERALES'))).toBe(true);
    expect(ficha.some((row) => row.includes('2. DATOS DEL SEMÁFORO'))).toBe(true);
    expect(ficha.some((row) => row.includes('3. AFORO VEHICULAR – INTERVALOS DE 15 MINUTOS'))).toBe(true);
    expect(ficha.some((row) => row.includes('4. RESUMEN Y HORA DE MÁXIMA DEMANDA'))).toBe(true);
    expect(ficha.some((row) => row.includes('5. CONTROL DE COLAS Y OPERACIÓN'))).toBe(true);
    expect(ficha.some((row) => row.includes('6. INDICADORES SEMAFÓRICOS'))).toBe(true);
    expect(ficha.some((row) => row.includes('lunes'))).toBe(true);

    const intervalRow = ficha.find((row) => row[0] === study.intervals[0].label);
    expect(intervalRow).toEqual([
      study.intervals[0].label,
      10,
      80,
      10,
      0,
      100,
      12,
      8,
      3,
      5,
      'Demanda alta',
    ]);
  });

  it('exports each detailed row total instead of repeating the full access total', () => {
    const study = createFichaStudy();
    const workbook = exportStudyWorkbook(study, intersections[0]);
    const detailed = XLSX.utils.sheet_to_json<Record<string, string | number>>(workbook.Sheets['03_AFORO_DETALLADO']);
    const firstNorth = detailed.find(
      (row) => row.Intervalo === study.intervals[0].label && row.Acceso === 'Norte',
    );

    expect(firstNorth?.Total).toBe(100);
  });

  it('exports queue operation and semaphoric indicators from the calculated source of truth', () => {
    const study = createFichaStudy();
    const workbook = exportStudyWorkbook(study, intersections[0]);
    const queues = XLSX.utils.sheet_to_json<Record<string, string | number>>(workbook.Sheets['05_COLAS_OPERACION']);
    const indicators = XLSX.utils.sheet_to_json<Record<string, string | number>>(workbook.Sheets['06_INDICADORES']);
    const north = queues.find((row) => row.Acceso === 'Norte');
    const indicatorMap = new Map(indicators.map((row) => [row.Indicador, row.Valor]));

    expect(north).toMatchObject({
      ColaMaxima: 18,
      ColaPromedio: 9,
      LongitudMaxima: 72,
      DetenidosPorCiclo: 8,
    });
    expect(indicatorMap.get('Flujo hora pico (veh/h)')).toBe(150);
    expect(indicatorMap.get('Verde efectivo (s)')).toBe(40);
    expect(Number(indicatorMap.get('Proporción de verde g/C'))).toBeCloseTo(40 / 90);
    expect(indicatorMap.get('Flujo de saturación observado (veh/h/carril)')).toBe(1800);
    expect(Number(indicatorMap.get('Relación demanda/capacidad (v/c)'))).toBeCloseTo(150 / 6400);
  });
});
