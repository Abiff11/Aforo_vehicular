import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { exportStudyWorkbook } from './exportExcel';
import {
  addSignalMovementAssignment,
  createDefaultStudy,
  updateProgram,
  updateProgramPhase,
  updateProgramPhaseCount,
  updateSignalMovementAssignment,
  validateStudy,
} from './study';
import { intersections } from '../data/intersections';
import { createTrafficStudyForIntersection, parseRoadTrafficCsv } from './roadTrafficImport';
import type { Study } from './types';

const roadTrafficCsv = `CARRETERA,"CLAVE CARRETERA",RUTA,"PUNTO GENERADOR",KM,TIPO,SC,TDPA2024,M,A,B,C2,C3,T3S2,T3S3,T3S2R4,OTROS,AUTOS,AUTOBUSES,CAMIONES,D,K',LAT,LONG
"Huajuapan de León - Oaxaca",20056,MEX-190,"T. Aut. Cuacnopalan - Oaxaca",181.8,3,1,24977,10.6,80.5,2,3.1,1.2,0.9,0.5,0.8,0.4,91.1,2,6.9,0.511,0.076,17.139925,-96.776604
`;

function fillCompleteRows(study: Study): Study {
  const peakThrough = new Map(study.intervals.slice(0, 4).map((item, index) => [item.id, [100, 120, 140, 160][index]]));
  return {
    ...study,
    rows: study.rows.map((row) => ({
      ...row,
      left: row.left === null && !study.configurationSnapshot.accesses.find((access) => access.id === row.accessId)?.movements.left ? null : 0,
      through: row.through === null && !study.configurationSnapshot.accesses.find((access) => access.id === row.accessId)?.movements.through
        ? null
        : row.accessId === 'north'
          ? (peakThrough.get(row.intervalId) ?? 10)
          : 0,
      right: row.right === null && !study.configurationSnapshot.accesses.find((access) => access.id === row.accessId)?.movements.right ? null : 0,
      uTurn: null,
      heavy: 0,
      motorcycles: 0,
      bicycles: 0,
      pedestrians: 0,
      observedCycle: row.accessId === 'north' && peakThrough.has(row.intervalId)
        ? [92, 88, 90, 90][study.intervals.findIndex((interval) => interval.id === row.intervalId)]
        : null,
    })),
  };
}

function createFormalStudy(): Study {
  let study = createDefaultStudy('INT-001');
  study = updateProgram(study, 'p1', {
    startTime: '07:00',
    endTime: '09:00',
    cycleSeconds: 90,
    greenSeconds: 40,
    amberSeconds: 3,
    redSeconds: 47,
  });
  study = updateProgramPhaseCount(study, 'p1', 1);
  study = updateProgramPhase(study, 'p1', 'phase-1', { cycleSeconds: 90, greenSeconds: 40, amberSeconds: 3, redSeconds: 47 });
  study = addSignalMovementAssignment(study);
  const assignment = study.configurationSnapshot.signalMovementAssignments![0];
  study = updateSignalMovementAssignment(study, assignment.id, {
    accessId: 'north',
    movement: 'through',
    programId: 'p1',
    phaseId: 'phase-1',
    lanes: 2,
    saturationFlowPerLane: 1800,
    effectiveGreenSeconds: 40,
  });
  study = fillCompleteRows(study);
  return validateStudy(study, true);
}

describe('exportStudyWorkbook calculation integrity', () => {
  it('creates the seven required sheets without invalid numeric values', () => {
    const workbook = exportStudyWorkbook(createDefaultStudy('INT-001'), intersections[0]);
    expect(workbook.SheetNames).toEqual([
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

  it('marks incomplete observed studies as partial and never invents unknown values', () => {
    const study = createDefaultStudy('INT-001');
    const workbook = exportStudyWorkbook(study, intersections[0]);
    const ficha = XLSX.utils.sheet_to_json<Array<string | number>>(workbook.Sheets['01_FICHA_TECNICA'], { header: 1, defval: '' });
    const detailed = XLSX.utils.sheet_to_json<Record<string, string | number>>(workbook.Sheets['03_AFORO_DETALLADO']);

    expect(ficha.some((row) => row.includes('ESTUDIO INCOMPLETO — RESULTADOS PARCIALES — NO UTILIZAR COMO RESULTADO DEFINITIVO'))).toBe(true);
    expect(ficha.some((row) => row.includes('Fuente:') && row.includes('Aforo observado'))).toBe(true);
    expect(detailed[0]).toMatchObject({ Izquierda: 'N/D', Frente: 'N/D', Derecha: 'N/D', Pesados: 'N/D' });
  });

  it('exports formal lane-group capacity and observed cycle statistics from the shared calculation engine', () => {
    const study = createFormalStudy();
    const workbook = exportStudyWorkbook(study, intersections[0]);
    const indicators = XLSX.utils.sheet_to_json<Record<string, string | number>>(workbook.Sheets['06_INDICADORES']);
    const group = indicators.find((row) => row.Tipo === 'Grupo semafórico');
    const cycle = indicators.find((row) => row.Tipo === 'Ciclo observado' && row.Acceso === 'Norte');

    expect(group).toMatchObject({
      Acceso: 'Norte',
      Movimiento: 'Frente',
      Programa: 'p1',
      Fase: 'phase-1',
      VolumenHoraPico: 520,
      Saturacion: 1800,
      Carriles: 2,
      VerdeEfectivo: 40,
      Ciclo: 90,
      Capacidad: 1600,
    });
    expect(Number(group?.['g/C'])).toBeCloseTo(40 / 90);
    expect(Number(group?.['v/c'])).toBeCloseTo(0.325);
    expect(cycle).toMatchObject({
      CicloPromedio: 90,
      CicloMinimo: 88,
      CicloMaximo: 92,
      CicloProgramado: 90,
      DiferenciaPromedio: 0,
    });

    const aggregate = indicators.find((row) => row.Tipo === 'Capacidad agregada');
    expect(aggregate).toBeUndefined();
  });

  it('exports TDPA as a separate estimate without fabricating observed aforo results', () => {
    const [record] = parseRoadTrafficCsv(roadTrafficCsv);
    const { study } = createTrafficStudyForIntersection(record, intersections[0]);
    const workbook = exportStudyWorkbook(study, intersections[0]);
    const dashboard = XLSX.utils.sheet_to_json<Record<string, string | number>>(workbook.Sheets['02_DASHBOARD']);
    const ficha = XLSX.utils.sheet_to_json<Array<string | number>>(workbook.Sheets['01_FICHA_TECNICA'], { header: 1, defval: '' });
    const indicatorMap = new Map(dashboard.map((row) => [row.Indicador, row.Valor]));

    expect(ficha.some((row) => row.includes('ESTIMACIÓN TDPA — NO SUSTITUYE UN AFORO DE INTERSECCIÓN EN CAMPO.'))).toBe(true);
    expect(indicatorMap.get('Fuente')).toBe('Estimación TDPA');
    expect(indicatorMap.get('TDPA')).toBe(24977);
    expect(indicatorMap.get("K'")).toBe(0.076);
    expect(indicatorMap.get('D')).toBe(0.511);
    expect(indicatorMap.get('Volumen hora de diseño estimado')).toBe(1898);
    expect(indicatorMap.get('Volumen total observado')).toBe('N/D');
    expect(indicatorMap.get('FHP observado')).toBe('N/D');
  });
});
