import * as XLSX from 'xlsx';
import type { Intersection, Study, StudySummary } from './types';
import { calculateRowMotorizedTotal, calculateStudySummary } from './calculations';

const INCOMPLETE_WARNING = 'ESTUDIO INCOMPLETO — RESULTADOS PARCIALES — NO UTILIZAR COMO RESULTADO DEFINITIVO';
const TDPA_WARNING = 'ESTIMACIÓN TDPA — NO SUSTITUYE UN AFORO DE INTERSECCIÓN EN CAMPO.';

function rowsToSheet(rows: Array<Record<string, string | number | null>>): XLSX.WorkSheet {
  return XLSX.utils.json_to_sheet(rows.map((row) => sanitizeRow(row)));
}

function sanitizeRow(row: Record<string, string | number | null>): Record<string, string | number> {
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => {
      if (typeof value === 'number' && !Number.isFinite(value)) return [key, 'N/D'];
      return [key, value ?? 'N/D'];
    }),
  );
}

function fichaValue(value: string | number | null | undefined): string | number {
  if (typeof value === 'number' && !Number.isFinite(value)) return 'N/D';
  return value ?? 'N/D';
}

function getSpanishWeekday(date: string): string {
  const [year, month, day] = date.split('-').map(Number);
  if (!year || !month || !day) return 'N/D';
  const weekdays = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  return weekdays[new Date(Date.UTC(year, month - 1, day)).getUTCDay()] ?? 'N/D';
}

function sourceLabel(study: Study): string {
  return (study.source ?? 'observed') === 'estimated_tdpa' ? 'Estimación TDPA' : 'Aforo observado';
}

function statusLabel(study: Study, summary: StudySummary): string {
  if ((study.source ?? 'observed') === 'estimated_tdpa') return 'Estimación';
  if (study.legacyUnverified) return 'Legado pendiente de verificar';
  if (study.status === 'exported') return 'Exportado validado';
  if (study.status === 'validated') return 'Validado';
  if (study.status === 'incomplete' || summary.isPartial) return 'Incompleto';
  return 'Borrador';
}

function shouldShowIncompleteWarning(study: Study, summary: StudySummary): boolean {
  return (study.source ?? 'observed') === 'observed' && (summary.isPartial || study.status === 'incomplete' || study.legacyUnverified === true);
}

function buildFichaSheet(study: Study, intersection: Intersection, summary: StudySummary): XLSX.WorkSheet {
  const rows: Array<Array<string | number>> = [];
  const sectionRows: number[] = [];
  const pushSection = (label: string): void => {
    sectionRows.push(rows.length);
    rows.push([label]);
  };
  const program = study.configurationSnapshot.programs[0];
  const isObserved = (study.source ?? 'observed') === 'observed';

  rows.push(['FICHA TÉCNICA DE AFORO – INTERSECCIÓN SEMAFORIZADA']);
  if (!isObserved) rows.push([TDPA_WARNING]);
  if (shouldShowIncompleteWarning(study, summary)) rows.push([INCOMPLETE_WARNING]);
  rows.push([]);

  pushSection('1. DATOS GENERALES');
  rows.push(['Fuente:', sourceLabel(study), '', 'Estado:', statusLabel(study, summary), '', 'Completitud:', `${summary.completionPercent.toFixed(1)}%`]);
  rows.push([
    'Intersección:', `${intersection.id} ${intersection.name}`, '', 'Día:', getSpanishWeekday(study.metadata.date), '', 'Aforador:', study.metadata.surveyor || 'N/D',
  ]);
  rows.push([
    'Municipio:', intersection.municipality || 'N/D', '', 'Hora inicio:', study.metadata.startTime, '', 'Clima:', study.metadata.weather || 'N/D',
  ]);
  rows.push([
    'Fecha:', study.metadata.date, '', 'Hora término:', study.metadata.endTime, '', 'Observaciones:', study.metadata.notes || 'N/D',
  ]);
  rows.push([]);

  pushSection('2. DATOS DEL SEMÁFORO');
  rows.push([
    'Ciclo programado (s):', fichaValue(program?.cycleSeconds),
    'Verde programado (s):', fichaValue(program?.greenSeconds),
    'Ámbar (s):', fichaValue(program?.amberSeconds),
    'Rojo (s):', fichaValue(program?.redSeconds),
    'Fases:', fichaValue(program?.phases),
  ]);
  rows.push(['Nota:', 'El verde programado no se considera verde efectivo. El verde efectivo se captura por grupo movimiento–fase.']);
  rows.push([]);

  pushSection(`3. AFORO VEHICULAR – INTERVALOS DE ${study.metadata.intervalMinutes} MINUTOS`);
  rows.push(['Intervalo', 'Izquierda', 'Frente', 'Derecha', 'Retorno', 'Total', 'Pesados', 'Motos', 'Bicicletas', 'Peatones', 'Observaciones']);
  for (const interval of summary.byInterval) {
    const captured = interval.complete === true;
    rows.push([
      interval.label,
      captured ? interval.left : 'N/D',
      captured ? interval.through : 'N/D',
      captured ? interval.right : 'N/D',
      captured ? interval.uTurn : 'N/D',
      captured ? interval.total : 'N/D',
      captured ? interval.heavy : 'N/D',
      captured ? interval.motorcycles : 'N/D',
      captured ? interval.bicycles : 'N/D',
      captured ? interval.pedestrians : 'N/D',
      interval.notes || (captured ? '' : 'Intervalo incompleto'),
    ]);
  }
  rows.push([]);

  pushSection('4. RESUMEN Y HORA DE MÁXIMA DEMANDA');
  rows.push([
    isObserved ? (summary.isComplete ? 'Volumen total observado:' : 'Volumen registrado parcial:') : 'Volumen observado:',
    isObserved ? summary.totalMotorized : 'N/D',
    '',
    'RESUMEN POR MOVIMIENTO',
    'Volumen capturado',
    '% sobre volumen capturado',
  ]);
  rows.push([
    `Máximo intervalo ${study.metadata.intervalMinutes} min:`, isObserved ? (summary.peakInterval?.volume ?? 'N/D') : 'N/D', '',
    summary.byMovement[0]?.movement ?? 'Izquierda', isObserved ? (summary.byMovement[0]?.volume ?? 0) : 'N/D', isObserved ? (summary.byMovement[0]?.percent ?? 0) : 'N/D',
  ]);
  rows.push([
    'Hora de máxima demanda:', isObserved ? (summary.peakHour?.label ?? 'N/D') : 'N/D', '',
    summary.byMovement[1]?.movement ?? 'Frente', isObserved ? (summary.byMovement[1]?.volume ?? 0) : 'N/D', isObserved ? (summary.byMovement[1]?.percent ?? 0) : 'N/D',
  ]);
  rows.push([
    summary.peakHour?.factorLabel ?? 'FHP', isObserved ? (summary.peakHour?.factor ?? 'N/D') : 'N/D', '',
    summary.byMovement[2]?.movement ?? 'Derecha', isObserved ? (summary.byMovement[2]?.volume ?? 0) : 'N/D', isObserved ? (summary.byMovement[2]?.percent ?? 0) : 'N/D',
  ]);
  rows.push([
    `Promedio ${study.metadata.intervalMinutes} min:`, isObserved ? summary.averageIntervalVolume : 'N/D', '',
    summary.byMovement[3]?.movement ?? 'Retorno', isObserved ? (summary.byMovement[3]?.volume ?? 0) : 'N/D', isObserved ? (summary.byMovement[3]?.percent ?? 0) : 'N/D',
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
  rows.push(['Acceso', 'Movimiento', 'Programa', 'Fase', 'Volumen hora pico', 'Saturación', 'Carriles', 'Verde efectivo', 'Ciclo', 'g/C', 'Capacidad', 'v/c']);
  if ((summary.signalGroupIndicators?.length ?? 0) === 0) {
    rows.push(['N/D', 'N/D', 'N/D', 'N/D', 'N/D', 'N/D', 'N/D', 'N/D', 'N/D', 'N/D', 'N/D', 'N/D']);
  } else {
    for (const group of summary.signalGroupIndicators ?? []) {
      rows.push([
        group.accessName,
        group.movementLabel,
        group.programId,
        group.phaseId,
        fichaValue(group.peakHourVolume),
        fichaValue(group.saturationFlowPerLane),
        fichaValue(group.lanes),
        fichaValue(group.effectiveGreenSeconds),
        fichaValue(group.cycleSeconds),
        fichaValue(group.greenRatio),
        fichaValue(group.capacity),
        fichaValue(group.volumeCapacityRatio),
      ]);
    }
  }
  rows.push(['Nota técnica:', 'Capacidad y v/c se calculan únicamente por grupo movimiento–fase con todos los insumos formales.']);

  if (study.tdpaEstimate) {
    rows.push([]);
    pushSection('ESTIMACIONES TDPA');
    rows.push(['TDPA', study.tdpaEstimate.dailyTraffic, "K'", study.tdpaEstimate.designHourFactor, 'D', study.tdpaEstimate.directionalDistribution]);
    rows.push(['Volumen hora de diseño estimado', study.tdpaEstimate.designHourTotal, 'Dirección principal', study.tdpaEstimate.mainDirectionHour, 'Dirección opuesta', study.tdpaEstimate.oppositeDirectionHour]);
  }

  const sheet = XLSX.utils.aoa_to_sheet(rows);
  const lastColumn = 11;
  sheet['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: lastColumn } },
    ...sectionRows.map((row) => ({ s: { r: row, c: 0 }, e: { r: row, c: lastColumn } })),
  ];
  sheet['!cols'] = Array.from({ length: lastColumn + 1 }, (_, index) => ({ wch: index === 0 ? 28 : index === 11 ? 18 : 20 }));
  return sheet;
}

function buildDashboardRows(study: Study, summary: StudySummary): Array<Record<string, string | number | null>> {
  const source = study.source ?? 'observed';
  const rows: Array<Record<string, string | number | null>> = [
    { Indicador: 'Fuente', Valor: sourceLabel(study) },
    { Indicador: 'Estado', Valor: statusLabel(study, summary) },
    { Indicador: 'Completitud (%)', Valor: summary.completionPercent },
    { Indicador: 'Filas completas', Valor: summary.completeRows },
    { Indicador: 'Filas incompletas', Valor: summary.incompleteRows },
    { Indicador: 'Filas con error', Valor: summary.errorRows },
    { Indicador: 'Volumen total observado', Valor: source === 'observed' && summary.isComplete ? summary.totalMotorized : 'N/D' },
    { Indicador: 'Volumen registrado parcial', Valor: source === 'observed' && !summary.isComplete ? summary.totalMotorized : 'N/D' },
    { Indicador: 'Hora pico observada', Valor: source === 'observed' ? (summary.peakHour?.label ?? 'N/D') : 'N/D' },
    { Indicador: 'Volumen hora pico observado', Valor: source === 'observed' ? (summary.peakHour?.volume ?? 'N/D') : 'N/D' },
    { Indicador: 'FHP observado', Valor: source === 'observed' ? (summary.peakHour?.factor ?? 'N/D') : 'N/D' },
    { Indicador: 'Intervalo máximo válido', Valor: source === 'observed' ? (summary.peakInterval?.label ?? 'N/D') : 'N/D' },
    { Indicador: 'Pesados capturados', Valor: source === 'observed' ? summary.totalHeavy : 'N/D' },
    { Indicador: 'Motos capturadas', Valor: source === 'observed' ? summary.totalMotorcycles : 'N/D' },
    { Indicador: 'Bicicletas capturadas', Valor: source === 'observed' ? summary.totalBicycles : 'N/D' },
    { Indicador: 'Peatones capturados', Valor: source === 'observed' ? summary.totalPedestrians : 'N/D' },
  ];

  if (study.tdpaEstimate) {
    rows.push(
      { Indicador: 'TDPA', Valor: study.tdpaEstimate.dailyTraffic },
      { Indicador: "K'", Valor: study.tdpaEstimate.designHourFactor },
      { Indicador: 'D', Valor: study.tdpaEstimate.directionalDistribution },
      { Indicador: 'Volumen hora de diseño estimado', Valor: study.tdpaEstimate.designHourTotal },
      { Indicador: 'Dirección principal estimada', Valor: study.tdpaEstimate.mainDirectionHour },
      { Indicador: 'Dirección opuesta estimada', Valor: study.tdpaEstimate.oppositeDirectionHour },
      { Indicador: 'Motos hora estimadas', Valor: study.tdpaEstimate.hourlyMotorcycles },
      { Indicador: 'Pesados hora estimados', Valor: study.tdpaEstimate.hourlyHeavyVehicles },
    );
  }
  return rows;
}

function buildIndicatorsRows(summary: StudySummary): Array<Record<string, string | number | null>> {
  const cycleRows = (summary.cycleSummaries ?? []).map((cycle) => ({
    Tipo: 'Ciclo observado',
    Acceso: cycle.accessName,
    Movimiento: null,
    Programa: null,
    Fase: null,
    VolumenHoraPico: null,
    Saturacion: null,
    Carriles: null,
    VerdeEfectivo: null,
    Ciclo: null,
    'g/C': null,
    Capacidad: null,
    'v/c': null,
    CicloPromedio: cycle.averageObservedCycle,
    CicloMinimo: cycle.minObservedCycle,
    CicloMaximo: cycle.maxObservedCycle,
    CicloProgramado: cycle.programmedCycleSeconds,
    DiferenciaPromedio: cycle.averageDifferenceSeconds,
  }));

  const groupRows = (summary.signalGroupIndicators ?? []).map((group) => ({
    Tipo: 'Grupo semafórico',
    Acceso: group.accessName,
    Movimiento: group.movementLabel,
    Programa: group.programId,
    Fase: group.phaseId,
    VolumenHoraPico: group.peakHourVolume,
    Saturacion: group.saturationFlowPerLane,
    Carriles: group.lanes,
    VerdeEfectivo: group.effectiveGreenSeconds,
    Ciclo: group.cycleSeconds,
    'g/C': group.greenRatio,
    Capacidad: group.capacity,
    'v/c': group.volumeCapacityRatio,
    CicloPromedio: null,
    CicloMinimo: null,
    CicloMaximo: null,
    CicloProgramado: null,
    DiferenciaPromedio: null,
  }));

  return [...groupRows, ...cycleRows];
}

export function exportStudyWorkbook(study: Study, intersection: Intersection): XLSX.WorkBook {
  const summary = calculateStudySummary(
    study.rows,
    study.configurationSnapshot.accesses,
    study.metadata.intervalMinutes,
    {
      programs: study.configurationSnapshot.programs,
      assignments: study.configurationSnapshot.signalMovementAssignments ?? [],
      observedSaturationFlowPerLane: study.metadata.observedSaturationFlowPerLane,
    },
  );
  const workbook = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(workbook, buildFichaSheet(study, intersection, summary), '01_FICHA_TECNICA');
  XLSX.utils.book_append_sheet(workbook, rowsToSheet(buildDashboardRows(study, summary)), '02_DASHBOARD');

  const accessById = new Map(study.configurationSnapshot.accesses.map((access) => [access.id, access]));
  const rowStateById = new Map(summary.rowValidation?.map((result) => [result.rowId, result.state]) ?? []);
  XLSX.utils.book_append_sheet(
    workbook,
    rowsToSheet(
      study.rows.map((row) => {
        const access = accessById.get(row.accessId) ?? study.configurationSnapshot.accesses[0];
        const complete = rowStateById.get(row.id) === 'complete';
        return {
          Intervalo: row.intervalLabel,
          Acceso: row.accessName,
          Izquierda: row.left,
          Frente: row.through,
          Derecha: row.right,
          Retorno: row.uTurn,
          Total: complete && access ? calculateRowMotorizedTotal(row, access) : null,
          Pesados: row.heavy,
          Motos: row.motorcycles,
          Bicicletas: row.bicycles,
          Peatones: row.pedestrians,
          ColaMaxima: row.maxQueue,
          ColaPromedio: row.averageQueue,
          LongitudCola: row.queueLength,
          DetenidosPorCiclo: row.stoppedVehiclesPerCycle,
          CicloObservado: row.observedCycle,
          ProgramaObservado: row.observedProgram || null,
          Observaciones: row.notes || null,
          EstadoFila: rowStateById.get(row.id) ?? 'incomplete',
        };
      }),
    ),
    '03_AFORO_DETALLADO',
  );

  const programmingRows: Array<Record<string, string | number | null>> = [
    ...study.configurationSnapshot.programs.map((program) => ({
      Tipo: 'Programa',
      Programa: program.name,
      Inicio: program.startTime,
      Termino: program.endTime,
      Ciclo: program.cycleSeconds,
      Fases: program.phases,
      VerdeProgramado: program.greenSeconds,
      Ambar: program.amberSeconds,
      Rojo: program.redSeconds,
      Despeje: program.clearanceSeconds,
      Acceso: null,
      Movimiento: null,
      Fase: null,
      CarrilesGrupo: null,
      SaturacionGrupo: null,
      VerdeEfectivoGrupo: null,
      Observaciones: program.notes || null,
    })),
    ...study.configurationSnapshot.programs.flatMap((program) =>
      program.phaseTimings.map((phase) => ({
        Tipo: 'Fase',
        Programa: program.name,
        Inicio: program.startTime,
        Termino: program.endTime,
        Ciclo: phase.cycleSeconds,
        Fases: program.phases,
        VerdeProgramado: phase.greenSeconds,
        Ambar: phase.amberSeconds,
        Rojo: phase.redSeconds,
        Despeje: null,
        Acceso: null,
        Movimiento: null,
        Fase: phase.name,
        CarrilesGrupo: null,
        SaturacionGrupo: null,
        VerdeEfectivoGrupo: null,
        Observaciones: 'Configuración por fase',
      })),
    ),
    ...(study.configurationSnapshot.signalMovementAssignments ?? []).map((assignment) => ({
      Tipo: 'Grupo movimiento-fase',
      Programa: assignment.programId,
      Inicio: null,
      Termino: null,
      Ciclo: null,
      Fases: null,
      VerdeProgramado: null,
      Ambar: null,
      Rojo: null,
      Despeje: null,
      Acceso: study.configurationSnapshot.accesses.find((access) => access.id === assignment.accessId)?.name ?? assignment.accessId,
      Movimiento: assignment.movement,
      Fase: assignment.phaseId,
      CarrilesGrupo: assignment.lanes,
      SaturacionGrupo: assignment.saturationFlowPerLane,
      VerdeEfectivoGrupo: assignment.effectiveGreenSeconds,
      Observaciones: null,
    })),
  ];
  XLSX.utils.book_append_sheet(workbook, rowsToSheet(programmingRows), '04_PROGRAMACION');

  XLSX.utils.book_append_sheet(
    workbook,
    rowsToSheet(
      summary.queueByAccess.map((queue) => ({
        Acceso: queue.accessName,
        Carriles: study.configurationSnapshot.accesses.find((access) => access.id === queue.accessId)?.lanes ?? null,
        ColaMaxima: queue.maxQueue,
        ColaPromedio: queue.averageQueue,
        LongitudMaxima: queue.maxQueueLength,
        DetenidosPorCiclo: queue.stoppedVehiclesPerCycle,
        Observaciones: queue.notes || null,
      })),
    ),
    '05_COLAS_OPERACION',
  );

  XLSX.utils.book_append_sheet(workbook, rowsToSheet(buildIndicatorsRows(summary)), '06_INDICADORES');

  XLSX.utils.book_append_sheet(
    workbook,
    rowsToSheet([
      { Tema: 'Captura', Descripcion: '0 significa observado sin unidades; N/D significa faltante o no aplicable.' },
      { Tema: 'Resultados parciales', Descripcion: 'Los intervalos incompletos no alimentan hora pico ni FHP definitivos.' },
      { Tema: 'Hora pico', Descripcion: 'Ventana móvil de 60 minutos formada sólo por intervalos completos y consecutivos.' },
      { Tema: 'FHP', Descripcion: 'Para 15 min: volumen de hora pico / (4 × máximo intervalo dentro de esa hora).' },
      { Tema: 'Verde efectivo', Descripcion: 'No se infiere del verde programado; se captura por grupo movimiento–fase.' },
      { Tema: 'Capacidad', Descripcion: 'c = s × N × g/C por grupo movimiento–fase; no se calcula capacidad agregada de toda la intersección.' },
      { Tema: 'TDPA', Descripcion: 'TDPA × K\' y D producen estimaciones de hora de diseño; no sustituyen un aforo de intersección.' },
    ]),
    '07_INSTRUCTIVO',
  );

  return workbook;
}

export function downloadStudyWorkbook(study: Study, intersection: Intersection): void {
  const workbook = exportStudyWorkbook(study, intersection);
  XLSX.writeFile(workbook, `${study.id}.xlsx`, { compression: true });
}
