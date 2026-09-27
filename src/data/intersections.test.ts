import { describe, expect, it } from 'vitest';
import { intersections } from './intersections';

describe('intersections catalog', () => {
  it('loads 47 stable intersection ids from INT-001 to INT-047', () => {
    expect(intersections).toHaveLength(47);
    expect(intersections[0].id).toBe('INT-001');
    expect(intersections[46].id).toBe('INT-047');
    expect(new Set(intersections.map((item) => item.id)).size).toBe(47);
  });

  it('preserves KML coordinates for sampled intersections', () => {
    expect(intersections.find((item) => item.id === 'INT-001')).toMatchObject({
      mapNumber: 1,
      latitude: 17.0733247,
      longitude: -96.7278974,
    });

    expect(intersections.find((item) => item.id === 'INT-047')).toMatchObject({
      mapNumber: 47,
      latitude: 17.0592094,
      longitude: -96.7081777,
    });
  });

  it('uses named crossings instead of generic intersection labels', () => {
    expect(intersections.every((item) => !/^Interseccion \d+$/i.test(item.name))).toBe(true);
    expect(intersections.find((item) => item.id === 'INT-028')?.name).toBe('Calle Juan Escutia / Calle Ninos Heroes');
  });
});
