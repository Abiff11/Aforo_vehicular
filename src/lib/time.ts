import type { IntervalBlock } from './types';

const MINUTES_PER_DAY = 24 * 60;

function parseTime(value: string): number {
  const match = value.match(/^(\d{2}):(\d{2})$/);
  if (!match) {
    throw new Error('La hora debe tener formato HH:mm.');
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) {
    throw new Error('La hora debe estar dentro de un dia valido.');
  }

  return hours * 60 + minutes;
}

function formatTime(totalMinutes: number): string {
  const normalized = ((totalMinutes % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  const hours = Math.floor(normalized / 60);
  const minutes = normalized % 60;

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

export function minutesFromClock(value: string): number {
  return parseTime(value);
}

export function validateStudyPeriod(startTime: string, endTime: string, intervalMinutes: number): string | null {
  let start: number;
  let end: number;

  try {
    start = parseTime(startTime);
    end = parseTime(endTime);
  } catch (error) {
    return error instanceof Error ? error.message : 'El horario del estudio es invalido.';
  }

  if (!Number.isInteger(intervalMinutes) || intervalMinutes <= 0) {
    return 'El intervalo debe ser un numero entero mayor a cero.';
  }

  if (end <= start) {
    end += MINUTES_PER_DAY;
  }

  const duration = end - start;
  if (duration > MINUTES_PER_DAY) {
    return 'La duracion del estudio no puede exceder 24 horas.';
  }

  if (duration % intervalMinutes !== 0) {
    return `La duracion del estudio no puede dividirse exactamente en intervalos de ${intervalMinutes} minutos.`;
  }

  return null;
}

export function generateIntervals(startTime: string, endTime: string, intervalMinutes: number): IntervalBlock[] {
  const validationError = validateStudyPeriod(startTime, endTime, intervalMinutes);
  if (validationError) throw new Error(validationError);

  const start = parseTime(startTime);
  let end = parseTime(endTime);
  if (end <= start) end += MINUTES_PER_DAY;

  const intervals: IntervalBlock[] = [];
  for (let minute = start; minute < end; minute += intervalMinutes) {
    const blockStart = formatTime(minute);
    const blockEnd = formatTime(minute + intervalMinutes);
    const label = `${blockStart}-${blockEnd}`;
    intervals.push({ id: label, start: blockStart, end: blockEnd, label });
  }

  return intervals;
}

export function isOneHourCompatible(intervalMinutes: number): boolean {
  return Number.isInteger(intervalMinutes) && intervalMinutes > 0 && 60 % intervalMinutes === 0;
}

export function intervalsAreConsecutive(intervals: Array<Pick<IntervalBlock, 'start' | 'end'>>): boolean {
  if (intervals.length <= 1) return true;
  return intervals.every((interval, index) => index === 0 || intervals[index - 1].end === interval.start);
}
