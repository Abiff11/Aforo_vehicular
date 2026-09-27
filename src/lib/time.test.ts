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

  it('supports a study that crosses midnight', () => {
    expect(generateIntervals('23:30', '01:00', 15)).toEqual([
      { id: '23:30-23:45', start: '23:30', end: '23:45', label: '23:30-23:45' },
      { id: '23:45-00:00', start: '23:45', end: '00:00', label: '23:45-00:00' },
      { id: '00:00-00:15', start: '00:00', end: '00:15', label: '00:00-00:15' },
      { id: '00:15-00:30', start: '00:15', end: '00:30', label: '00:15-00:30' },
      { id: '00:30-00:45', start: '00:30', end: '00:45', label: '00:30-00:45' },
      { id: '00:45-01:00', start: '00:45', end: '01:00', label: '00:45-01:00' },
    ]);
  });
});
