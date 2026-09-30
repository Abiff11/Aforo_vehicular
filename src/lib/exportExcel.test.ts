import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { calculateStudySummary } from './calculations';
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
import { applyUniformTdpaTemporalDistribution } from './tdpaCorridorSettings';
import type { Study } from './types';

const roadTrafficCsv = `CARRETERA,"CLAVE CARRETERA",RUTA,"PUNTO GENERADOR",KM,TIPO,SC,TDPA2024,M,A,B,C2,C3,T3S2,T3S3,T3S2R4,OTROS,AUTOS,AUTOBUSES,CAMIONES,D,K',LAT,LONG
"Huajuapan de León - Oaxaca",20056,MEX-190,"T. Aut. Cuacnopalan - Oaxaca",181.8,3,1,24977,10.6,80.5,2,3.1,1.2,0.9,0.5,0.8,0.4,91.1,2,6.9,0.511,0.076,17.139925,-96.776604
`;

function tableRows<T>(sheet: XLSX.WorkSheet): T[] {
  return XLSX.utils.sheet_to_json<T>(sheet, { range: 3 });
}

function cellStyle(sheet: XLSX.WorkSheet, address: string): Record<string, unknown> | undefined {
  return (sheet[address] as XLSX.CellObject & { s?: Record<string, unknown> } | undefined)?.s;
}

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
    const detailed = tableRows<Record<string, string | number>>(workbook.Sheets['03_AFORO_DETALLADO']);

    expect(ficha.some((row) => row.includes('ESTUDIO INCOMPLETO — RESULTADOS PARCIALES — NO UTILIZAR COMO RESULTADO DEFINITIVO'))).toBe(true);
    expect(ficha.some((row) => row.includes('Fuente:') && row.includes('Aforo observado'))).toBe(true);
    expect(detailed[0]).toMatchObject({ Izquierda: 'N/D', Frente: 'N/D', Derecha: 'N/D', Pesados: 'N/D' });
  });

  it('labels dashboard values by origin and preserves every study status explicitly', () => {
    const incomplete = createDefaultStudy('INT-001');
    const legacy = { ...incomplete, legacyUnverified: true };
    const validated = createFormalStudy();
    const exported: Study = { ...validated, status: 'exported' };

    const getDashboardMap = (study: Study) => {
      const workbook = exportStudyWorkbook(study, intersections[0]);
      const rows = tableRows<Record<string, string | number>>(workbook.Sheets['02_DASHBOARD']);
      return new Map(rows.map((row) => [row.Indicador, row]));
    };

    const incompleteMap = getDashboardMap(incomplete);
    const legacyMap = getDashboardMap(legacy);
    const validatedMap = getDashboardMap(validated);
    const exportedMap = getDashboardMap(exported);

    expect(incompleteMap.get('Estado')).toMatchObject({ Valor: 'Incompleto', Origen: 'Estado del estudio' });
    expect(incompleteMap.get('Volumen registrado parcial')).toMatchObject({ Origen: 'Capturado' });
    expect(incompleteMap.get('Hora pico observada')).toMatchObject({ Origen: 'Calculado' });
    expect(legacyMap.get('Estado')?.Valor).toBe('Legado pendiente de verificar');
    expect(validatedMap.get('Estado')?.Valor).toBe('Validado');
    expect(exportedMap.get('Estado')?.Valor).toBe('Exportado validado');
  });

  it('preserves observed zero separately from unknown values after workbook serialization', () => {
    const base = createDefaultStudy('INT-001');
    const firstRow = base.rows[0];
    const study: Study = {
      ...base,
      rows: base.rows.map((row) => row.id === firstRow.id
        ? {
            ...row,
            left: 0,
            through: 0,
            right: 0,
            uTurn: null,
            heavy: 0,
            motorcycles: 0,
            bicycles: 0,
            pedestrians: 0,
          }
        : row),
    };

    const workbook = exportStudyWorkbook(study, intersections[0]);
    const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' });
    const parsed = XLSX.read(buffer, { type: 'buffer' });
    const detailed = tableRows<Record<string, string | number>>(parsed.Sheets['03_AFORO_DETALLADO']);
    const completeRow = detailed.find((row) => row.EstadoDato === 'Completo');
    const incompleteRow = detailed.find((row) => row.EstadoDato === 'Incompleto');

    expect(completeRow).toMatchObject({ Frente: 0, Total: 0, OrigenDato: 'Captura de campo', TipoTotal: 'Calculado' });
    expect(incompleteRow).toMatchObject({ Frente: 'N/D', Total: 'N/D', OrigenDato: 'Captura incompleta', TipoTotal: 'N/D' });
  });

  it('exports formal lane-group capacity and observed cycle statistics directly from the shared calculation engine', () => {
    const study = createFormalStudy();
    const summary = calculateStudySummary(
      study.rows,
      study.configurationSnapshot.accesses,
      study.metadata.intervalMinutes,
      {
        programs: study.configurationSnapshot.programs,
        assignments: study.configurationSnapshot.signalMovementAssignments ?? [],
      },
    );
    const expectedGroup = summary.signalGroupIndicators?.[0];
    const expectedCycle = summary.cycleSummaries?.find((item) => item.accessId === 'north');
    const workbook = exportStudyWorkbook(study, intersections[0]);
    const indicators = tableRows<Record<string, string | number>>(workbook.Sheets['06_INDICADORES']);
    const group = indicators.find((row) => row.Tipo === 'Grupo semafórico');
    const cycle = indicators.find((row) => row.Tipo === 'Ciclo observado' && row.Acceso === 'Norte');

    expect(expectedGroup).toBeDefined();
    expect(group).toMatchObject({
      Acceso: 'Norte',
      Movimiento: 'Frente',
      Programa: 'p1',
      Fase: 'phase-1',
      VolumenHoraPico: expectedGroup?.peakHourVolume ?? 'N/D',
      Saturacion: expectedGroup?.saturationFlowPerLane ?? 'N/D',
      Carriles: expectedGroup?.lanes ?? 'N/D',
      VerdeEfectivo: expectedGroup?.effectiveGreenSeconds ?? 'N/D',
      Ciclo: expectedGroup?.cycleSeconds ?? 'N/D',
      Capacidad: expectedGroup?.capacity ?? 'N/D',
    });
    expect(Number(group?.['g/C'])).toBeCloseTo(expectedGroup?.greenRatio ?? 0);
    expect(Number(group?.['v/c'])).toBeCloseTo(expectedGroup?.volumeCapacityRatio ?? 0);
    expect(cycle).toMatchObject({
      CicloPromedio: expectedCycle?.averageObservedCycle ?? 'N/D',
      CicloMinimo: expectedCycle?.minObservedCycle ?? 'N/D',
      CicloMaximo: expectedCycle?.maxObservedCycle ?? 'N/D',
      CicloProgramado: expectedCycle?.programmedCycleSeconds ?? 'N/D',
      DiferenciaPromedio: expectedCycle?.averageDifferenceSeconds ?? 'N/D',
    });

    const aggregate = indicators.find((row) => row.Tipo === 'Capacidad agregada');
    expect(aggregate).toBeUndefined();
  });

  it('exports TDPA as a separate estimate without fabricating observed aforo results', () => {
    const [record] = parseRoadTrafficCsv(roadTrafficCsv);
    const { study } = createTrafficStudyForIntersection(record, intersections[0]);
    const workbook = exportStudyWorkbook(study, intersections[0]);
    const dashboard = tableRows<Record<string, string | number>>(workbook.Sheets['02_DASHBOARD']);
    const ficha = XLSX.utils.sheet_to_json<Array<string | number>>(workbook.Sheets['01_FICHA_TECNICA'], { header: 1, defval: '' });
    const indicatorMap = new Map(dashboard.map((row) => [row.Indicador, row.Valor]));
    const originMap = new Map(dashboard.map((row) => [row.Indicador, row.Origen]));
    const observedSummary = ficha.find((row) =>
      row[0] === 'Volumen registrado parcial:' || row[0] === 'Volumen total observado:' || row[0] === 'Volumen observado:',
    );
    const leftMovementSummary = ficha.find((row) => row[3] === 'Izquierda');

    expect(ficha.some((row) => row.includes('ESTIMACIÓN TDPA — NO SUSTITUYE UN AFORO DE INTERSECCIÓN EN CAMPO.'))).toBe(true);
    expect(observedSummary?.[1]).toBe('N/D');
    expect(leftMovementSummary?.[4]).toBe('N/D');
    expect(leftMovementSummary?.[5]).toBe('N/D');
    expect(indicatorMap.get('Fuente')).toBe('Estimación TDPA');
    expect(indicatorMap.get('TDPA')).toBe(24977);
    expect(indicatorMap.get("K'")).toBe(0.076);
    expect(indicatorMap.get('D')).toBe(0.511);
    expect(indicatorMap.get('Volumen hora de diseño estimado')).toBe(1898);
    expect(originMap.get('Volumen hora de diseño estimado')).toBe('Estimado');
    expect(indicatorMap.get('Volumen total observado')).toBe('N/D');
    expect(indicatorMap.get('FHP observado')).toBe('N/D');
  });

  it('exports complete TDPA traceability and conserves the design-hour volume in estimated intervals', () => {
    const [record] = parseRoadTrafficCsv(roadTrafficCsv);
    const { study: importedStudy } = createTrafficStudyForIntersection(record, intersections[0]);
    const study: Study = {
      ...importedStudy,
      tdpaCorridorSettings: applyUniformTdpaTemporalDistribution(importedStudy),
    };
    const workbook = exportStudyWorkbook(study, intersections[0]);

    expect(workbook.SheetNames).toEqual([
      '01_FICHA_TECNICA',
      '02_DASHBOARD',
      '03_AFORO_DETALLADO',
      '04_PROGRAMACION',
      '05_COLAS_OPERACION',
      '06_INDICADORES',
      '07_INSTRUCTIVO',
      '08_TDPA_ESTIMACION',
    ]);

    const tdpaRows = tableRows<Record<string, string | number>>(workbook.Sheets['08_TDPA_ESTIMACION']);
    const metadata = new Map(
      tdpaRows
        .filter((row) => row.Tipo === 'Metadato')
        .map((row) => [row.Concepto, row.Valor]),
    );
    const movementRows = tdpaRows.filter((row) => row.Tipo === 'Configuración movimiento');
    const intervalRows = tdpaRows.filter((row) => row.Tipo === 'Intervalo estimado');

    expect(metadata.get('Carretera')).toBe('Huajuapan de León - Oaxaca');
    expect(metadata.get('Ruta')).toBe('MEX-190');
    expect(metadata.get('Punto')).toBe('T. Aut. Cuacnopalan - Oaxaca');
    expect(metadata.get('Año de referencia')).toBe(2024);
    expect(metadata.get('TDPA')).toBe(24977);
    expect(metadata.get("K'")).toBe(0.076);
    expect(metadata.get('D')).toBe(0.511);
    expect(metadata.get('Perfil temporal')).toBe('25% · 25% · 25% · 25%');
    expect(movementRows).toHaveLength(2);
    expect(movementRows[0]).toMatchObject({ IzquierdaPct: 10, FrentePct: 80, DerechaPct: 10, RetornoPct: 0 });
    expect(new Set(intervalRows.map((row) => row.Intervalo)).size).toBe(4);
    expect(intervalRows).toHaveLength(8);
    expect(intervalRows.reduce((sum, row) => sum + Number(row.TotalVeh), 0)).toBe(1898);
    expect(intervalRows.every((row) => row.Origen === 'Estimado TDPA')).toBe(true);
  });

  it('adds deliberate executive presentation metadata to all report sheets', () => {
    const workbook = exportStudyWorkbook(createFormalStudy(), intersections[0]);
    const ficha = workbook.Sheets['01_FICHA_TECNICA'];
    const dashboard = workbook.Sheets['02_DASHBOARD'];
    const detailed = workbook.Sheets['03_AFORO_DETALLADO'];
    const programming = workbook.Sheets['04_PROGRAMACION'];
    const queues = workbook.Sheets['05_COLAS_OPERACION'];
    const indicators = workbook.Sheets['06_INDICADORES'];
    const guide = workbook.Sheets['07_INSTRUCTIVO'];

    expect(ficha['A1']?.v).toBe('FICHA TÉCNICA DE AFORO – INTERSECCIÓN SEMAFORIZADA');
    expect(ficha['!rows']?.[0]?.hpt).toBeGreaterThanOrEqual(24);
    expect(ficha['!margins']).toBeDefined();

    expect(dashboard['A1']?.v).toBe('RESUMEN EJECUTIVO DEL ESTUDIO');
    expect(dashboard['!merges']).toContainEqual({ s: { r: 0, c: 0 }, e: { r: 0, c: 2 } });
    expect(dashboard['!cols']?.[0]?.wch).toBeGreaterThanOrEqual(30);
    expect(dashboard['!autofilter']?.ref).toMatch(/^A4:/);

    expect(detailed['A1']?.v).toBe('AFORO DETALLADO');
    expect(detailed['!autofilter']?.ref).toMatch(/^A4:/);
    expect(programming['A1']?.v).toBe('PROGRAMACIÓN SEMAFÓRICA');
    expect(queues['A1']?.v).toBe('COLAS Y OPERACIÓN');
    expect(indicators['A1']?.v).toBe('INDICADORES SEMAFÓRICOS');
    expect(guide['A1']?.v).toBe('INSTRUCTIVO TÉCNICO');
    for (const sheet of [ficha, dashboard, detailed, programming, queues, indicators, guide]) {
      expect(cellStyle(sheet, 'A1')).toMatchObject({
        font: expect.objectContaining({ bold: true, color: { rgb: 'FFFFFF' } }),
        fill: expect.objectContaining({ fgColor: { rgb: '1F4E78' } }),
      });
    }
    for (const sheet of [dashboard, detailed, programming, queues, indicators, guide]) {
      expect(cellStyle(sheet, 'A4')).toMatchObject({
        font: expect.objectContaining({ bold: true, color: { rgb: 'FFFFFF' } }),
        fill: expect.objectContaining({ fgColor: { rgb: '5B9BD5' } }),
      });
    }
    expect(cellStyle(ficha, 'A3')).toMatchObject({
      font: expect.objectContaining({ bold: true, color: { rgb: 'FFFFFF' } }),
      fill: expect.objectContaining({ fgColor: { rgb: '70AD47' } }),
    });
    expect(cellStyle(ficha, 'A14')).toMatchObject({
      font: expect.objectContaining({ bold: true, color: { rgb: 'FFFFFF' } }),
      fill: expect.objectContaining({ fgColor: { rgb: '5B9BD5' } }),
    });
    expect(cellStyle(ficha, 'B15')).toMatchObject({
      font: expect.objectContaining({ color: { rgb: '1F1F1F' } }),
    });
    expect(cellStyle(ficha, 'B15')?.fill).toBeUndefined();
    expect(cellStyle(dashboard, 'B5')).toMatchObject({
      font: expect.objectContaining({ color: { rgb: '1F1F1F' } }),
    });
    expect(cellStyle(dashboard, 'B5')?.fill).toBeUndefined();

    const dashboardRows = XLSX.utils.sheet_to_json<Array<string | number>>(dashboard, { header: 1, defval: '' });
    const completionRow = dashboardRows.findIndex((row) => row[0] === 'Completitud (%)');
    expect(completionRow).toBeGreaterThan(3);
    expect(dashboard[XLSX.utils.encode_cell({ r: completionRow, c: 1 })]?.z).toBe('0.0');
  });

  it('preserves executive titles and data semantics after XLSX round trip', () => {
    const workbook = exportStudyWorkbook(createFormalStudy(), intersections[0]);
    const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' });
    const parsed = XLSX.read(buffer, { type: 'buffer' });
    const dashboard = parsed.Sheets['02_DASHBOARD'];
    const detailed = tableRows<Record<string, string | number>>(parsed.Sheets['03_AFORO_DETALLADO']);

    expect(dashboard['A1']?.v).toBe('RESUMEN EJECUTIVO DEL ESTUDIO');
    expect(detailed.some((row) => row.OrigenDato === 'Captura de campo' && row.TipoTotal === 'Calculado')).toBe(true);
    expect(detailed.some((row) => row.Frente === 0)).toBe(true);
  });
});
