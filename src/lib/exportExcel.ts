import * as XLSX from 'xlsx';
import type { Intersection, Study } from './types';
import { calculateRowMotorizedTotal, calculateStudySummary } from './calculations';

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

function fichaValue(value: string | number | null | undefined): string | number {
  if (typeof value === 'number' && !Number.isFinite(value)) {
    return 'N/D';
  }
  return value ?? 'N/D';
}

function getSpanishWeekday(date: string): string {
  const [year, month, day] = date.split('-').map(Number);
  if (!year || !month || !day) {
    return 'N/D';
  }

  const weekdays = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  return weekdays[new Date(Date.UTC(year, month - 1, day)).getUTCDay()] ?? 'N/D';
}

function buildFichaSheet(study: Study, intersection: Intersection, summary: ReturnType<typeof calculateStudySummary>): XLSX.WorkSheet {
  const rows: Array<Array<string | number>> = [];
  const sectionRows: number[] = [];
  const pushSection = (label: string): void => {
    sectionRows.push(rows.length);
    rows.push([label]);
  };
  const program = study.configurationSnapshot.programs[0];

  rows.push(['FICHA TÉCNICA DE AFORO – INTERSECCIÓN SEMAFORIZADA']);
  rows.push([]);

  pushSection('1. DATOS GENERALES');
  rows.push([
    'Intersección:',
    `${intersection.id} ${intersection.name}`,
    '',
    'Día:',
    getSpanishWeekday(study.metadata.date),
    '',
    'Aforador:',
    study.metadata.surveyor || 'N/D',
  ]);
  rows.push([
    'Municipio:',
    intersection.municipality || 'N/D',
    '',
    'Hora inicio:',
    study.metadata.startTime,
    '',
    'Clima:',
    study.metadata.weather || 'N/D',
  ]);
  rows.push([
    'Fecha:',
    study.metadata.date,
    '',
    'Hora término:',
    study.metadata.endTime,
    '',
    'Observaciones:',
    study.metadata.notes || 'N/D',
  ]);
  rows.push([]);

  pushSection('2. DATOS DEL SEMÁFORO');
  rows.push([
    'Ciclo (s):',
    fichaValue(program?.cycleSeconds),
    'Verde fase principal (s):',
    fichaValue(program?.greenSeconds),
    'Ámbar (s):',
    fichaValue(program?.amberSeconds),
    'Rojo (s):',
    fichaValue(program?.redSeconds),
    'Fases:',
    fichaValue(program?.phases),
  ]);
  rows.push([]);

  pushSection(`3. AFORO VEHICULAR – INTERVALOS DE ${study.metadata.intervalMinutes} MINUTOS`);
  rows.push([
    'Intervalo',
    'Izquierda',
    'Frente',
    'Derecha',
    'Retorno',
    'Total',
    'Pesados',
    'Motos',
    'Bicicletas',
    'Peatones',
    'Observaciones',
  ]);
  for (const interval of summary.byInterval) {
    rows.push([
      interval.label,
      interval.left,
      interval.through,
      interval.right,
      interval.uTurn,
      interval.total,
      interval.heavy,
      interval.motorcycles,
      interval.bicycles,
      interval.pedestrians,
      interval.notes,
    ]);
  }
  rows.push([]);

  pushSection('4. RESUMEN Y HORA DE MÁXIMA DEMANDA');
  rows.push(['Volumen total aforado:', summary.totalMotorized, '', 'RESUMEN POR MOVIMIENTO', 'Volumen', '% del total']);
  rows.push([
    `Máximo intervalo ${study.metadata.intervalMinutes} min:`,
    summary.peakInterval?.volume ?? 'N/D',
    '',
    summary.byMovement[0]?.movement ?? 'Izquierda',
    summary.byMovement[0]?.volume ?? 0,
    summary.byMovement[0]?.percent ?? 0,
  ]);
  rows.push([
    'Hora de máxima demanda:',
    summary.peakHour?.label ?? 'N/D',
    '',
    summary.byMovement[1]?.movement ?? 'Frente',
    summary.byMovement[1]?.volume ?? 0,
    summary.byMovement[1]?.percent ?? 0,
  ]);
  rows.push([
    summary.peakHour?.factorLabel ?? 'FHP',
    summary.peakHour?.factor ?? 'N/D',
    '',
    summary.byMovement[2]?.movement ?? 'Derecha',
    summary.byMovement[2]?.volume ?? 0,
    summary.byMovement[2]?.percent ?? 0,
  ]);
  rows.push([
    `Promedio ${study.metadata.intervalMinutes} min:`,
    summary.averageIntervalVolume,
    '',
    summary.byMovement[3]?.movement ?? 'Retorno',
    summary.byMovement[3]?.volume ?? 0,
    summary.byMovement[3]?.percent ?? 0,
  ]);
  rows.push([]);

  pushSection('5. CONTROL DE COLAS Y OPERACIÓN');
  rows.push(['Acceso', 'Cola máxima (veh)', 'Cola promedio (veh)', 'Longitud máxima (m)', 'Vehículos detenidos/ciclo', 'Observaciones']);
  for (const queue of summary.queueByAccess) {
    rows.push([
      queue.accessName,
      fichaValue(queue.maxQueue),
      fichaValue(queue.averageQueue),
      fichaValue(queue.maxQueueLength),
      fichaValue(queue.stoppedVehiclesPerCycle),
      queue.notes || 'N/D',
    ]);
  }
  rows.push([]);

  pushSection('6. INDICADORES SEMAFÓRICOS');
  rows.push(['Flujo hora pico (veh/h):', fichaValue(summary.signalIndicators.peakHourFlow)]);
  rows.push(['Verde efectivo (s):', fichaValue(summary.signalIndicators.effectiveGreenSeconds)]);
  rows.push(['Proporción de verde g/C:', fichaValue(summary.signalIndicators.greenRatio)]);
  rows.push(['Flujo de saturación observado (veh/h/carril):', fichaValue(summary.signalIndicators.saturationFlowPerLane)]);
  rows.push(['Capacidad estimada (veh/h):', fichaValue(summary.signalIndicators.capacity)]);
  rows.push(['Relación demanda/capacidad (v/c):', fichaValue(summary.signalIndicators.volumeCapacityRatio)]);
  rows.push([
    'Notas técnicas:',
    'La capacidad y v/c solo se calculan cuando existen saturación observada, carriles y tiempos semafóricos suficientes.',
  ]);

  const sheet = XLSX.utils.aoa_to_sheet(rows);
  const lastColumn = 10;
  sheet['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: lastColumn } },
    ...sectionRows.map((row) => ({ s: { r: row, c: 0 }, e: { r: row, c: lastColumn } })),
  ];
  sheet['!cols'] = [
    { wch: 24 },
    { wch: 20 },
    { wch: 22 },
    { wch: 22 },
    { wch: 18 },
    { wch: 20 },
    { wch: 18 },
    { wch: 22 },
    { wch: 18 },
    { wch: 18 },
    { wch: 34 },
  ];
  return sheet;
}

export function exportStudyWorkbook(study: Study, intersection: Intersection): XLSX.WorkBook {
  const summary = calculateStudySummary(
    study.rows,
    study.configurationSnapshot.accesses,
    study.metadata.intervalMinutes,
    {
      programs: study.configurationSnapshot.programs,
      observedSaturationFlowPerLane: study.metadata.observedSaturationFlowPerLane,
    },
  );
  const workbook = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(workbook, buildFichaSheet(study, intersection, summary), '01_FICHA_TECNICA');

  XLSX.utils.book_append_sheet(
    workbook,
    rowsToSheet([
      { Indicador: 'Volumen total', Valor: summary.totalMotorized },
      { Indicador: 'Hora pico', Valor: summary.peakHour?.label ?? 'N/D' },
      { Indicador: 'Volumen hora pico', Valor: summary.peakHour?.volume ?? 'N/D' },
      { Indicador: 'Intervalo máximo', Valor: summary.peakInterval?.label ?? 'N/D' },
      { Indicador: 'Volumen intervalo máximo', Valor: summary.peakInterval?.volume ?? 'N/D' },
      { Indicador: `Promedio ${study.metadata.intervalMinutes} min`, Valor: summary.averageIntervalVolume },
      { Indicador: 'Pesados', Valor: summary.totalHeavy },
      { Indicador: 'Motos', Valor: summary.totalMotorcycles },
      { Indicador: 'Bicicletas', Valor: summary.totalBicycles },
      { Indicador: 'Peatones', Valor: summary.totalPedestrians },
      { Indicador: 'v/c', Valor: summary.signalIndicators.volumeCapacityRatio ?? 'N/D' },
    ]),
    '02_DASHBOARD',
  );

  const accessById = new Map(study.configurationSnapshot.accesses.map((access) => [access.id, access]));
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
        Total: calculateRowMotorizedTotal(row, accessById.get(row.accessId) ?? study.configurationSnapshot.accesses[0]),
        Pesados: row.heavy,
        Motos: row.motorcycles,
        Bicicletas: row.bicycles,
        Peatones: row.pedestrians,
        ColaMaxima: row.maxQueue,
        ColaPromedio: row.averageQueue,
        LongitudCola: row.queueLength,
        DetenidosPorCiclo: row.stoppedVehiclesPerCycle,
        CicloObservado: row.observedCycle,
        ProgramaObservado: row.observedProgram || 'N/D',
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
            Observaciones: 'Configuración por fase',
          })),
        ),
      ],
    ),
    '04_PROGRAMACION',
  );

  XLSX.utils.book_append_sheet(
    workbook,
    rowsToSheet(
      summary.queueByAccess.map((queue) => ({
        Acceso: queue.accessName,
        Carriles: study.configurationSnapshot.accesses.find((access) => access.id === queue.accessId)?.lanes ?? 'N/D',
        ColaMaxima: queue.maxQueue,
        ColaPromedio: queue.averageQueue,
        LongitudMaxima: queue.maxQueueLength,
        DetenidosPorCiclo: queue.stoppedVehiclesPerCycle,
        Observaciones: queue.notes || 'N/D',
      })),
    ),
    '05_COLAS_OPERACION',
  );

  XLSX.utils.book_append_sheet(
    workbook,
    rowsToSheet([
      { Indicador: 'FHP / Factor', Valor: summary.peakHour?.factor ?? 'N/D' },
      { Indicador: 'Flujo hora pico (veh/h)', Valor: summary.signalIndicators.peakHourFlow ?? 'N/D' },
      { Indicador: 'Verde efectivo (s)', Valor: summary.signalIndicators.effectiveGreenSeconds ?? 'N/D' },
      { Indicador: 'Proporción de verde g/C', Valor: summary.signalIndicators.greenRatio ?? 'N/D' },
      {
        Indicador: 'Flujo de saturación observado (veh/h/carril)',
        Valor: summary.signalIndicators.saturationFlowPerLane ?? 'N/D',
      },
      { Indicador: 'Capacidad estimada (veh/h)', Valor: summary.signalIndicators.capacity ?? 'N/D' },
      { Indicador: 'Relación demanda/capacidad (v/c)', Valor: summary.signalIndicators.volumeCapacityRatio ?? 'N/D' },
      {
        Indicador: 'Criterio',
        Valor:
          summary.signalIndicators.volumeCapacityRatio === null
            ? 'Se requieren saturación observada, carriles y tiempos semafóricos para calcular capacidad y v/c.'
            : 'Estimación basada en saturación observada × carriles × g/C.',
      },
    ]),
    '06_INDICADORES',
  );

  XLSX.utils.book_append_sheet(
    workbook,
    rowsToSheet([
      { Tema: 'Captura', Descripcion: 'Registrar movimientos por intervalo y acceso.' },
      { Tema: 'Cero', Descripcion: '0 significa dato observado sin volumen; N/D significa faltante o no aplicable.' },
      { Tema: 'Validación', Descripcion: 'Pesados + motos no debe superar el total motorizado.' },
      { Tema: 'Hora pico', Descripcion: 'Se obtiene con una ventana móvil real de 60 minutos cuando el intervalo divide 60.' },
      { Tema: 'FHP', Descripcion: 'Para intervalos de 15 minutos: volumen de hora pico / (4 × máximo intervalo dentro de esa hora).' },
      { Tema: 'Capacidad', Descripcion: 'Solo se calcula con saturación observada, carriles y proporción de verde disponible.' },
    ]),
    '07_INSTRUCTIVO',
  );

  return workbook;
}

export function downloadStudyWorkbook(study: Study, intersection: Intersection): void {
  const workbook = exportStudyWorkbook(study, intersection);
  XLSX.writeFile(workbook, `${study.id}.xlsx`, { compression: true });
}
