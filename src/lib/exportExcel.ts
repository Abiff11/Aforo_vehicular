import * as XLSX from 'xlsx';
import type { Intersection, Study } from './types';
import { calculateStudySummary } from './calculations';

function rowsToSheet(rows: Array<Record<string, string | number | null>>): XLSX.WorkSheet {
  return XLSX.utils.json_to_sheet(rows.map((row) => sanitizeRow(row)));
}

function sanitizeRow(row: Record<string, string | number | null>): Record<string, string | number> {
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => {
      if (typeof value === 'number' && !Number.isFinite(value)) {
        return [key, 'N/D'];
      }
      return [key, value ?? 'N/D'];
    }),
  );
}

export function exportStudyWorkbook(study: Study, intersection: Intersection): XLSX.WorkBook {
  const summary = calculateStudySummary(
    study.rows,
    study.configurationSnapshot.accesses,
    study.metadata.intervalMinutes,
  );
  const workbook = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(
    workbook,
    rowsToSheet([
      { Campo: 'FICHA TECNICA DE AFORO - INTERSECCION SEMAFORIZADA', Valor: '' },
      { Campo: 'Interseccion', Valor: `${intersection.id} ${intersection.name}` },
      { Campo: 'Municipio', Valor: intersection.municipality },
      { Campo: 'Fecha', Valor: study.metadata.date },
      { Campo: 'Horario', Valor: `${study.metadata.startTime}-${study.metadata.endTime}` },
      { Campo: 'Intervalo', Valor: `${study.metadata.intervalMinutes} min` },
      { Campo: 'Aforador', Valor: study.metadata.surveyor || 'N/D' },
      { Campo: 'Clima', Valor: study.metadata.weather || 'N/D' },
      { Campo: 'Volumen total', Valor: summary.totalMotorized },
      { Campo: 'Hora maxima demanda', Valor: summary.peakHour?.label ?? 'N/D' },
      { Campo: summary.peakHour?.factorLabel ?? 'FHP', Valor: summary.peakHour?.factor ?? 'N/D' },
    ]),
    '01_FICHA_TECNICA',
  );

  XLSX.utils.book_append_sheet(
    workbook,
    rowsToSheet([
      { Indicador: 'Volumen total', Valor: summary.totalMotorized },
      { Indicador: 'Hora pico', Valor: summary.peakHour?.label ?? 'N/D' },
      { Indicador: 'Volumen hora pico', Valor: summary.peakHour?.volume ?? 'N/D' },
      { Indicador: 'Intervalo maximo', Valor: summary.peakInterval?.label ?? 'N/D' },
      { Indicador: 'Pesados', Valor: summary.totalHeavy },
      { Indicador: 'Motos', Valor: summary.totalMotorcycles },
      { Indicador: 'Bicicletas', Valor: summary.totalBicycles },
      { Indicador: 'Peatones', Valor: summary.totalPedestrians },
    ]),
    '02_DASHBOARD',
  );

  XLSX.utils.book_append_sheet(
    workbook,
    rowsToSheet(
      study.rows.map((row) => ({
        Intervalo: row.intervalLabel,
        Acceso: row.accessName,
        Izquierda: row.left,
        Frente: row.through,
        Derecha: row.right,
        Retorno: row.uTurn,
        Total: summary.byAccess.find((item) => item.accessId === row.accessId)?.volume ?? 0,
        Pesados: row.heavy,
        Motos: row.motorcycles,
        Bicicletas: row.bicycles,
        Peatones: row.pedestrians,
        ColaMaxima: row.maxQueue,
        ColaPromedio: row.averageQueue,
        Observaciones: row.notes,
      })),
    ),
    '03_AFORO_DETALLADO',
  );

  XLSX.utils.book_append_sheet(
    workbook,
    rowsToSheet(
      [
        ...study.configurationSnapshot.programs.map((program) => ({
          Programa: program.name,
          Inicio: program.startTime,
          Termino: program.endTime,
          Ciclo: program.cycleSeconds,
          Fases: program.phases,
          Verde: program.greenSeconds,
          Ambar: program.amberSeconds,
          Rojo: program.redSeconds,
          Despeje: program.clearanceSeconds,
          Observaciones: program.notes,
        })),
        ...study.configurationSnapshot.programs.flatMap((program) =>
          program.phaseTimings.map((phase) => ({
            Programa: `${program.name} - ${phase.name}`,
            Inicio: program.startTime,
            Termino: program.endTime,
            Ciclo: phase.cycleSeconds,
            Fases: program.phases,
            Verde: phase.greenSeconds,
            Ambar: phase.amberSeconds,
            Rojo: phase.redSeconds,
            Despeje: 'N/D',
            Observaciones: 'Configuracion por fase',
          })),
        ),
      ],
    ),
    '04_PROGRAMACION',
  );

  XLSX.utils.book_append_sheet(
    workbook,
    rowsToSheet(
      study.configurationSnapshot.accesses.map((access) => ({
        Acceso: access.name,
        Carriles: access.lanes,
        ColaMaxima: Math.max(0, ...study.rows.filter((row) => row.accessId === access.id).map((row) => row.maxQueue ?? 0)),
        ColaPromedio: 'N/D',
        LongitudMaxima: Math.max(0, ...study.rows.filter((row) => row.accessId === access.id).map((row) => row.queueLength ?? 0)),
      })),
    ),
    '05_COLAS_OPERACION',
  );

  XLSX.utils.book_append_sheet(
    workbook,
    rowsToSheet([
      { Indicador: 'FHP / Factor', Valor: summary.peakHour?.factor ?? 'N/D' },
      { Indicador: 'Capacidad', Valor: 'N/D' },
      { Indicador: 'v/c', Valor: 'N/D' },
      { Indicador: 'Criterio', Valor: 'Se requieren datos de saturacion y operacion semaforica para capacidad y v/c.' },
    ]),
    '06_INDICADORES',
  );

  XLSX.utils.book_append_sheet(
    workbook,
    rowsToSheet([
      { Tema: 'Captura', Descripcion: 'Registrar movimientos por intervalo y acceso.' },
      { Tema: 'Cero', Descripcion: '0 significa dato observado sin volumen; N/D significa faltante o no aplicable.' },
      { Tema: 'Validacion', Descripcion: 'Pesados + motos no debe superar el total motorizado.' },
    ]),
    '07_INSTRUCTIVO',
  );

  return workbook;
}

export function downloadStudyWorkbook(study: Study, intersection: Intersection): void {
  const workbook = exportStudyWorkbook(study, intersection);
  XLSX.writeFile(workbook, `${study.id}.xlsx`, { compression: true });
}
