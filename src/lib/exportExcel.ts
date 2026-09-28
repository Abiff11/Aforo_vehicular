import * as XLSX from 'xlsx-js-style';
import type { Intersection, Study, StudySummary } from './types';
import { calculateRowMotorizedTotal, calculateStudySummary } from './calculations';

const INCOMPLETE_WARNING = 'ESTUDIO INCOMPLETO — RESULTADOS PARCIALES — NO UTILIZAR COMO RESULTADO DEFINITIVO';
const TDPA_WARNING = 'ESTIMACIÓN TDPA — NO SUSTITUYE UN AFORO DE INTERSECCIÓN EN CAMPO.';
const TABLE_HEADER_ROW = 3;
const EXECUTIVE_SUBTITLE = 'Aforo vehicular · reporte técnico ejecutivo';
const TITLE_BLUE = '1F4E78';
const HEADER_BLUE = '5B9BD5';
const SECTION_GREEN = '70AD47';
const SUBTITLE_BLUE = 'D9EAF7';
const LIGHT_BLUE = 'EAF3F8';
const BORDER_GRAY = 'BFBFBF';
const WHITE = 'FFFFFF';
const TEXT_DARK = '1F1F1F';

type CellStyle = NonNullable<XLSX.CellObject['s']>;

const EXECUTIVE_MARGINS: XLSX.MarginInfo = {
  left: 0.3,
  right: 0.3,
  top: 0.5,
  bottom: 0.5,
  header: 0.2,
  footer: 0.2,
};

const baseBorder: NonNullable<CellStyle['border']> = {
  top: { style: 'thin', color: { rgb: BORDER_GRAY } },
  bottom: { style: 'thin', color: { rgb: BORDER_GRAY } },
  left: { style: 'thin', color: { rgb: BORDER_GRAY } },
  right: { style: 'thin', color: { rgb: BORDER_GRAY } },
};

const titleStyle: CellStyle = {
  font: { name: 'Aptos', sz: 14, bold: true, color: { rgb: WHITE } },
  fill: { patternType: 'solid', fgColor: { rgb: TITLE_BLUE } },
  alignment: { horizontal: 'left', vertical: 'center' },
};

const subtitleStyle: CellStyle = {
  font: { name: 'Aptos', sz: 10, italic: true, color: { rgb: TEXT_DARK } },
  fill: { patternType: 'solid', fgColor: { rgb: SUBTITLE_BLUE } },
  alignment: { horizontal: 'left', vertical: 'center' },
};

const tableHeaderStyle: CellStyle = {
  font: { name: 'Aptos', sz: 10, bold: true, color: { rgb: WHITE } },
  fill: { patternType: 'solid', fgColor: { rgb: HEADER_BLUE } },
  alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
  border: baseBorder,
};

const sectionStyle: CellStyle = {
  font: { name: 'Aptos', sz: 11, bold: true, color: { rgb: WHITE } },
  fill: { patternType: 'solid', fgColor: { rgb: SECTION_GREEN } },
  alignment: { horizontal: 'left', vertical: 'center' },
};

const labelStyle: CellStyle = {
  font: { name: 'Aptos', sz: 10, bold: true, color: { rgb: TEXT_DARK } },
  fill: { patternType: 'solid', fgColor: { rgb: LIGHT_BLUE } },
  alignment: { horizontal: 'left', vertical: 'center' },
  border: baseBorder,
};

const valueStyle: CellStyle = {
  font: { name: 'Aptos', sz: 10, color: { rgb: TEXT_DARK } },
  alignment: { horizontal: 'left', vertical: 'center' },
  border: baseBorder,
};

const numericStyle: CellStyle = {
  ...valueStyle,
  alignment: { horizontal: 'right', vertical: 'center' },
  numFmt: '#,##0',
};

const decimalStyle: CellStyle = {
  ...numericStyle,
  numFmt: '#,##0.000',
};

function mergeStyle(base: CellStyle | undefined, next: CellStyle): CellStyle {
  const style: CellStyle = {
    ...(base ?? {}),
    ...next,
    border: next.border ?? base?.border,
  };
  if (base?.font || next.font) style.font = { ...(base?.font ?? {}), ...(next.font ?? {}) };
  if (base?.fill || next.fill) style.fill = { ...(base?.fill ?? {}), ...(next.fill ?? {}) };
  if (base?.alignment || next.alignment) style.alignment = { ...(base?.alignment ?? {}), ...(next.alignment ?? {}) };
  return style;
}

function cellAddress(row: number, col: number): string {
  return XLSX.utils.encode_cell({ r: row, c: col });
}

function applyCellStyle(sheet: XLSX.WorkSheet, row: number, col: number, style: CellStyle): void {
  const address = cellAddress(row, col);
  const cell = sheet[address];
  if (!cell) return;
  cell.s = mergeStyle(cell.s, style);
}

function applyRowStyle(sheet: XLSX.WorkSheet, row: number, startCol: number, endCol: number, style: CellStyle): void {
  for (let col = startCol; col <= endCol; col += 1) applyCellStyle(sheet, row, col, style);
}

function applyRangeStyle(sheet: XLSX.WorkSheet, startRow: number, endRow: number, startCol: number, endCol: number): void {
  for (let row = startRow; row <= endRow; row += 1) {
    for (let col = startCol; col <= endCol; col += 1) {
      const cell = sheet[cellAddress(row, col)];
      if (!cell) continue;
      const value = cell.v;
      const isNumber = typeof value === 'number';
      const isDecimal = isNumber && !Number.isInteger(value);
      applyCellStyle(sheet, row, col, isDecimal ? decimalStyle : isNumber ? numericStyle : valueStyle);
    }
  }
}

function applyExecutiveSheetStyle(
  sheet: XLSX.WorkSheet,
  options: {
    headerRow?: number;
    lastColumn: number;
    sectionRows?: number[];
  },
): void {
  const range = XLSX.utils.decode_range(sheet['!ref'] ?? 'A1:A1');
  const lastColumn = Math.max(options.lastColumn, range.e.c);
  if (range.e.r >= 0) applyRangeStyle(sheet, 0, range.e.r, 0, range.e.c);
  applyRowStyle(sheet, 0, 0, lastColumn, titleStyle);
  if (range.e.r >= 1) applyRowStyle(sheet, 1, 0, lastColumn, subtitleStyle);
  for (const sectionRow of options.sectionRows ?? []) applyRowStyle(sheet, sectionRow, 0, lastColumn, sectionStyle);
  if (options.headerRow !== undefined) applyRowStyle(sheet, options.headerRow, 0, range.e.c, tableHeaderStyle);
  sheet['!margins'] = EXECUTIVE_MARGINS;
  sheet['!outline'] = { summaryBelow: false, summaryRight: false };
}

function rowsToSheet(
  rows: Array<Record<string, string | number | null>>,
  widths: number[] | undefined,
  title: string,
  subtitle = EXECUTIVE_SUBTITLE,
): XLSX.WorkSheet {
  const sanitizedRows = rows.map((row) => sanitizeRow(row));
  const headerCount = sanitizedRows[0] ? Object.keys(sanitizedRows[0]).length : 0;
  const lastColumn = Math.max((widths?.length ?? headerCount) - 1, 0);
  const sheet = XLSX.utils.aoa_to_sheet([[title], [subtitle], []]);

  if (sanitizedRows.length > 0) {
    XLSX.utils.sheet_add_json(sheet, sanitizedRows, { origin: 'A4' });
    const lastDataRow = TABLE_HEADER_ROW + sanitizedRows.length + 1;
    sheet['!autofilter'] = { ref: `A4:${XLSX.utils.encode_col(Math.max(headerCount - 1, 0))}${lastDataRow}` };
  }

  sheet['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: lastColumn } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: lastColumn } },
  ];
  if (widths) sheet['!cols'] = widths.map((wch) => ({ wch }));
  sheet['!rows'] = [{ hpt: 28 }, { hpt: 18 }, { hpt: 8 }, { hpt: 22 }];
  applyExecutiveSheetStyle(sheet, { headerRow: TABLE_HEADER_ROW, lastColumn });
  return sheet;
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

function rowStateLabel(state: 'complete' | 'incomplete' | 'error' | undefined): string {
  if (state === 'complete') return 'Completo';
  if (state === 'error') return 'Error';
  return 'Incompleto';
}

function rowOriginLabel(state: 'complete' | 'incomplete' | 'error' | undefined): string {
  if (state === 'complete') return 'Captura de campo';
  if (state === 'error') return 'Captura con error';
  return 'Captura incompleta';
}

function shouldShowIncompleteWarning(study: Study, summary: StudySummary): boolean {
  return (study.source ?? 'observed') === 'observed' && (summary.isPartial || study.status === 'incomplete' || study.legacyUnverified === true);
}

function buildFichaSheet(study: Study, intersection: Intersection, summary: StudySummary): XLSX.WorkSheet {
  const rows: Array<Array<string | number>> = [];
  const sectionRows: number[] = [];
  const headerRows: number[] = [];
  const pushSection = (label: string): void => {
    sectionRows.push(rows.length);
    rows.push([label]);
  };
  const pushHeader = (header: Array<string | number>): void => {
    headerRows.push(rows.length);
    rows.push(header);
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
  pushHeader(['Intervalo', 'Izquierda', 'Frente', 'Derecha', 'Retorno', 'Total calculado', 'Pesados', 'Motos', 'Bicicletas', 'Peatones', 'Observaciones']);
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
    'Volumen completo',
    '% sobre volumen completo',
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
  pushHeader(['Acceso', 'Cola máxima (veh)', 'Cola promedio (veh)', 'Longitud máxima (m)', 'Vehículos detenidos/ciclo', 'Observaciones']);
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
  pushHeader(['Acceso', 'Movimiento', 'Programa', 'Fase', 'Volumen hora pico', 'Saturación', 'Carriles', 'Verde efectivo', 'Ciclo', 'g/C', 'Capacidad', 'v/c']);
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
  sheet['!cols'] = [
    { wch: 30 }, { wch: 22 }, { wch: 4 }, { wch: 24 }, { wch: 20 }, { wch: 20 },
    { wch: 20 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 34 }, { wch: 16 },
  ];
  sheet['!rows'] = Array.from({ length: rows.length }, (_, row) => {
    if (row === 0) return { hpt: 30 };
    if (sectionRows.includes(row)) return { hpt: 22 };
    if (rows[row]?.length === 0) return { hpt: 8 };
    return { hpt: 18 };
  });
  applyExecutiveSheetStyle(sheet, { lastColumn, sectionRows });
  for (const rowIndex of headerRows) {
    if (rows[rowIndex]) applyRowStyle(sheet, rowIndex, 0, Math.max((rows[rowIndex]?.length ?? 1) - 1, 0), tableHeaderStyle);
  }
  for (let row = 3; row < rows.length; row += 1) {
    const currentRow = rows[row];
    if (!currentRow || sectionRows.includes(row) || currentRow.length === 0) continue;
    if (typeof currentRow[0] === 'string' && currentRow[0].endsWith(':')) applyCellStyle(sheet, row, 0, labelStyle);
    if (typeof currentRow[3] === 'string' && currentRow[3].endsWith(':')) applyCellStyle(sheet, row, 3, labelStyle);
    if (typeof currentRow[6] === 'string' && currentRow[6].endsWith(':')) applyCellStyle(sheet, row, 6, labelStyle);
  }
  return sheet;
}

function buildDashboardRows(study: Study, summary: StudySummary): Array<Record<string, string | number | null>> {
  const source = study.source ?? 'observed';
  const rows: Array<Record<string, string | number | null>> = [
    { Indicador: 'Fuente', Valor: sourceLabel(study), Origen: 'Metadato' },
    { Indicador: 'Estado', Valor: statusLabel(study, summary), Origen: 'Estado del estudio' },
    { Indicador: 'Completitud (%)', Valor: summary.completionPercent, Origen: 'Calculado' },
    { Indicador: 'Filas completas', Valor: summary.completeRows, Origen: 'Calculado' },
    { Indicador: 'Filas incompletas', Valor: summary.incompleteRows, Origen: 'Calculado' },
    { Indicador: 'Filas con error', Valor: summary.errorRows, Origen: 'Calculado' },
    { Indicador: 'Volumen total observado', Valor: source === 'observed' && summary.isComplete ? summary.totalMotorized : 'N/D', Origen: 'Calculado' },
    { Indicador: 'Volumen registrado parcial', Valor: source === 'observed' && !summary.isComplete ? summary.totalMotorized : 'N/D', Origen: 'Capturado' },
    { Indicador: 'Hora pico observada', Valor: source === 'observed' ? (summary.peakHour?.label ?? 'N/D') : 'N/D', Origen: 'Calculado' },
    { Indicador: 'Volumen hora pico observado', Valor: source === 'observed' ? (summary.peakHour?.volume ?? 'N/D') : 'N/D', Origen: 'Calculado' },
    { Indicador: 'FHP observado', Valor: source === 'observed' ? (summary.peakHour?.factor ?? 'N/D') : 'N/D', Origen: 'Calculado' },
    { Indicador: 'Intervalo máximo válido', Valor: source === 'observed' ? (summary.peakInterval?.label ?? 'N/D') : 'N/D', Origen: 'Calculado' },
    { Indicador: 'Pesados capturados', Valor: source === 'observed' ? summary.totalHeavy : 'N/D', Origen: 'Capturado' },
    { Indicador: 'Motos capturadas', Valor: source === 'observed' ? summary.totalMotorcycles : 'N/D', Origen: 'Capturado' },
    { Indicador: 'Bicicletas capturadas', Valor: source === 'observed' ? summary.totalBicycles : 'N/D', Origen: 'Capturado' },
    { Indicador: 'Peatones capturados', Valor: source === 'observed' ? summary.totalPedestrians : 'N/D', Origen: 'Capturado' },
  ];

  if (study.tdpaEstimate) {
    rows.push(
      { Indicador: 'TDPA', Valor: study.tdpaEstimate.dailyTraffic, Origen: 'Estimado' },
      { Indicador: "K'", Valor: study.tdpaEstimate.designHourFactor, Origen: 'Estimado' },
      { Indicador: 'D', Valor: study.tdpaEstimate.directionalDistribution, Origen: 'Estimado' },
      { Indicador: 'Volumen hora de diseño estimado', Valor: study.tdpaEstimate.designHourTotal, Origen: 'Estimado' },
      { Indicador: 'Dirección principal estimada', Valor: study.tdpaEstimate.mainDirectionHour, Origen: 'Estimado' },
      { Indicador: 'Dirección opuesta estimada', Valor: study.tdpaEstimate.oppositeDirectionHour, Origen: 'Estimado' },
      { Indicador: 'Motos hora estimadas', Valor: study.tdpaEstimate.hourlyMotorcycles, Origen: 'Estimado' },
      { Indicador: 'Pesados hora estimados', Valor: study.tdpaEstimate.hourlyHeavyVehicles, Origen: 'Estimado' },
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

function applyDashboardFormats(sheet: XLSX.WorkSheet): void {
  const range = XLSX.utils.decode_range(sheet['!ref'] ?? 'A1:A1');
  for (let row = TABLE_HEADER_ROW + 1; row <= range.e.r; row += 1) {
    const indicatorCell = sheet[XLSX.utils.encode_cell({ r: row, c: 0 })];
    const valueCell = sheet[XLSX.utils.encode_cell({ r: row, c: 1 })];
    if (indicatorCell?.v === 'Completitud (%)' && valueCell?.t === 'n') valueCell.z = '0.0';
    if ((indicatorCell?.v === 'FHP observado' || indicatorCell?.v === "K'" || indicatorCell?.v === 'D') && valueCell?.t === 'n') valueCell.z = '0.000';
  }
}

function applyIndicatorFormats(sheet: XLSX.WorkSheet): void {
  const range = XLSX.utils.decode_range(sheet['!ref'] ?? 'A1:A1');
  const headers = new Map<string, number>();
  for (let col = range.s.c; col <= range.e.c; col += 1) {
    const cell = sheet[XLSX.utils.encode_cell({ r: TABLE_HEADER_ROW, c: col })];
    if (typeof cell?.v === 'string') headers.set(cell.v, col);
  }
  for (const label of ['g/C', 'v/c']) {
    const col = headers.get(label);
    if (col === undefined) continue;
    for (let row = TABLE_HEADER_ROW + 1; row <= range.e.r; row += 1) {
      const cell = sheet[XLSX.utils.encode_cell({ r: row, c: col })];
      if (cell?.t === 'n') cell.z = '0.000';
    }
  }
}

export function exportStudyWorkbook(study: Study, intersection: Intersection): XLSX.WorkBook {
  const summary = calculateStudySummary(
    study.rows,
    study.configurationSnapshot.accesses,
    study.metadata.intervalMinutes,
    {
      programs: study.configurationSnapshot.programs,
      assignments: study.configurationSnapshot.signalMovementAssignments ?? [],
    },
  );
  const workbook = XLSX.utils.book_new();
  const subtitle = `${intersection.name} · ${study.metadata.date} · ${sourceLabel(study)} · ${statusLabel(study, summary)}`;
  workbook.Props = {
    Title: `Aforo vehicular - ${intersection.name}`,
    Subject: 'Estudio de aforo vehicular en intersección semaforizada',
    Author: 'Aforos Intersecciones',
    Comments: 'Libro generado desde un único StudySummary; Capturado, Calculado y Estimado conservan semánticas separadas.',
  };

  XLSX.utils.book_append_sheet(workbook, buildFichaSheet(study, intersection, summary), '01_FICHA_TECNICA');

  const dashboardSheet = rowsToSheet(
    buildDashboardRows(study, summary),
    [36, 24, 24],
    'RESUMEN EJECUTIVO DEL ESTUDIO',
    subtitle,
  );
  applyDashboardFormats(dashboardSheet);
  XLSX.utils.book_append_sheet(workbook, dashboardSheet, '02_DASHBOARD');

  const accessById = new Map(study.configurationSnapshot.accesses.map((access) => [access.id, access]));
  const rowStateById = new Map(summary.rowValidation?.map((result) => [result.rowId, result.state]) ?? []);
  const detailedSheet = rowsToSheet(
    study.rows.map((row) => {
      const access = accessById.get(row.accessId) ?? study.configurationSnapshot.accesses[0];
      const state = rowStateById.get(row.id) ?? 'incomplete';
      const complete = state === 'complete';
      return {
        Intervalo: row.intervalLabel,
        Acceso: row.accessName,
        OrigenDato: rowOriginLabel(state),
        EstadoDato: rowStateLabel(state),
        Izquierda: row.left,
        Frente: row.through,
        Derecha: row.right,
        Retorno: row.uTurn,
        Total: complete && access ? calculateRowMotorizedTotal(row, access) : null,
        TipoTotal: complete && access ? 'Calculado' : null,
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
        EstadoFila: state,
      };
    }),
    [16, 20, 20, 14, 12, 12, 12, 12, 12, 14, 12, 12, 12, 12, 14, 14, 14, 18, 16, 20, 32, 14],
    'AFORO DETALLADO',
    subtitle,
  );
  XLSX.utils.book_append_sheet(workbook, detailedSheet, '03_AFORO_DETALLADO');

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
  XLSX.utils.book_append_sheet(
    workbook,
    rowsToSheet(
      programmingRows,
      [24, 18, 12, 12, 12, 10, 18, 12, 12, 12, 20, 18, 18, 16, 18, 20, 30],
      'PROGRAMACIÓN SEMAFÓRICA',
      subtitle,
    ),
    '04_PROGRAMACION',
  );

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
      [22, 12, 16, 16, 18, 20, 34],
      'COLAS Y OPERACIÓN',
      subtitle,
    ),
    '05_COLAS_OPERACION',
  );

  const indicatorsSheet = rowsToSheet(
    buildIndicatorsRows(summary),
    Array.from({ length: 18 }, (_, index) => (index < 5 ? 20 : 16)),
    'INDICADORES SEMAFÓRICOS',
    subtitle,
  );
  applyIndicatorFormats(indicatorsSheet);
  XLSX.utils.book_append_sheet(workbook, indicatorsSheet, '06_INDICADORES');

  XLSX.utils.book_append_sheet(
    workbook,
    rowsToSheet([
      { Tema: 'Captura', Descripcion: '0 significa observado sin unidades; N/D significa faltante o no aplicable.' },
      { Tema: 'Origen del dato', Descripcion: 'Capturado identifica valores ingresados en campo; Calculado identifica resultados derivados; Estimado identifica TDPA y sus derivados.' },
      { Tema: 'Estado', Descripcion: 'Completo, Incompleto y Error describen la validación de cada fila; el estado general se exporta por separado.' },
      { Tema: 'Resultados parciales', Descripcion: 'Los intervalos incompletos no alimentan hora pico ni FHP definitivos.' },
      { Tema: 'Hora pico', Descripcion: 'Ventana móvil de 60 minutos formada sólo por intervalos completos y consecutivos.' },
      { Tema: 'FHP', Descripcion: 'Para 15 min: volumen de hora pico / (4 × máximo intervalo dentro de esa hora).' },
      { Tema: 'Verde efectivo', Descripcion: 'No se infiere del verde programado; se captura por grupo movimiento–fase.' },
      { Tema: 'Capacidad', Descripcion: 'c = s × N × g/C por grupo movimiento–fase; no se calcula capacidad agregada de toda la intersección.' },
      { Tema: 'TDPA', Descripcion: 'TDPA × K\' y D producen estimaciones de hora de diseño; no sustituyen un aforo de intersección.' },
    ], [26, 100], 'INSTRUCTIVO TÉCNICO', 'Criterios de lectura, trazabilidad y alcance del libro'),
    '07_INSTRUCTIVO',
  );

  return workbook;
}

export function downloadStudyWorkbook(study: Study, intersection: Intersection): void {
  const workbook = exportStudyWorkbook(study, intersection);
  XLSX.writeFile(workbook, `${study.id}.xlsx`, { compression: true });
}
