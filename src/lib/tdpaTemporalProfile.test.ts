import { describe, expect, it } from 'vitest';
import {
  allocateTdpaTemporalVolume,
  UNIFORM_TDPA_TEMPORAL_DISTRIBUTION,
  validateTdpaTemporalDistribution,
} from './tdpaTemporalProfile';

describe('TDPA temporal profile', () => {
  it('exposes the uniform 25/25/25/25 distribution only as an explicit preset', () => {
    expect(UNIFORM_TDPA_TEMPORAL_DISTRIBUTION).toEqual([25, 25, 25, 25]);
  });

  it('requires exactly four 15-minute percentages that sum to 100 percent', () => {
    expect(validateTdpaTemporalDistribution([20, 30, 25, 25])).toEqual([]);
    expect(validateTdpaTemporalDistribution([20, 30, 20, 20])).toContain(
      'La distribución temporal TDPA debe sumar exactamente 100%.',
    );
    expect(validateTdpaTemporalDistribution([30, 30, 30, 20])).toContain(
      'La distribución temporal TDPA excede 100%.',
    );
    expect(validateTdpaTemporalDistribution([50, 50, 0])).toContain(
      'El perfil temporal TDPA debe contener exactamente cuatro intervalos de 15 minutos.',
    );
  });

  it('rejects invalid percentages in a temporal interval', () => {
    expect(validateTdpaTemporalDistribution([25, -1, 26, 50])).toContain(
      'El porcentaje del intervalo 2 debe estar entre 0% y 100%.',
    );
    expect(validateTdpaTemporalDistribution([25, 25, 25, 125])).toContain(
      'El porcentaje del intervalo 4 debe estar entre 0% y 100%.',
    );
  });

  it('allocates a uniform profile without losing the hourly total to rounding', () => {
    const intervals = allocateTdpaTemporalVolume(1898, UNIFORM_TDPA_TEMPORAL_DISTRIBUTION);

    expect(intervals).toEqual([475, 475, 474, 474]);
    expect(intervals.reduce((sum, value) => sum + value, 0)).toBe(1898);
  });

  it('allocates a custom profile by largest remainder and preserves the total', () => {
    const intervals = allocateTdpaTemporalVolume(1898, [20, 30, 25, 25]);

    expect(intervals).toEqual([380, 569, 475, 474]);
    expect(intervals.reduce((sum, value) => sum + value, 0)).toBe(1898);
  });
});
