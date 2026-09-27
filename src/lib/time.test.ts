import { describe, expect, it } from 'vitest';
import { generateIntervals } from './time';

describe('generateIntervals', () => {
  it('creates contiguous 15 minute labels for a valid study window', () => {
    expect(generateIntervals('07:00', '08:00', 15)).toEqual([
      { id: '07:00-07:15', start: '07:00', end: '07:15', label: '07:00-07:15' },
      { id: '07:15-07:30', start: '07:15', end: '07:30', label: '07:15-07:30' },
      { id: '07:30-07:45', start: '07:30', end: '07:45', label: '07:30-07:45' },
      { id: '07:45-08:00', start: '07:45', end: '08:00', label: '07:45-08:00' },
    ]);
  });

  it('rejects windows that cannot be divided exactly by the interval', () => {
    expect(() => generateIntervals('07:00', '08:00', 17)).toThrow(
      'La duracion del estudio no puede dividirse exactamente en intervalos de 17 minutos.',
    );
  });

  it('rejects an end time that is not after the start time', () => {
    expect(() => generateIntervals('08:00', '07:00', 15)).toThrow(
      'La hora de termino debe ser posterior a la hora de inicio.',
    );
  });
});
