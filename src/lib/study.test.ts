import { describe, expect, it } from 'vitest';
import {
  createDefaultStudy,
  updateAccessConfig,
  updateAccessMovement,
  updateProgram,
  updateProgramPhase,
  updateProgramPhaseCount,
} from './study';

describe('study configuration editing', () => {
  it('updates access name, lanes, and movement availability', () => {
    const study = createDefaultStudy('INT-002');
    const renamed = updateAccessConfig(study, 'north', { name: 'Acceso principal', lanes: 3 });
    const updated = updateAccessMovement(renamed, 'north', 'uTurn', true);
    const access = updated.configurationSnapshot.accesses.find((item) => item.id === 'north');

    expect(access).toMatchObject({
      name: 'Acceso principal',
      lanes: 3,
      movements: { uTurn: true },
    });
    expect(updated.rows.some((row) => row.accessName === 'Acceso principal' && row.uTurn === 0)).toBe(true);
  });

  it('configures signal green, amber, red, and individual phase cycles', () => {
    const study = createDefaultStudy('INT-002');
    const withProgram = updateProgram(study, 'p1', {
      cycleSeconds: 120,
      greenSeconds: 45,
      amberSeconds: 4,
      redSeconds: 71,
    });
    const withThreePhases = updateProgramPhaseCount(withProgram, 'p1', 3);
    const updated = updateProgramPhase(withThreePhases, 'p1', 'phase-2', {
      name: 'Fase 2 - Oriente/Poniente',
      greenSeconds: 35,
      amberSeconds: 4,
      redSeconds: 81,
      cycleSeconds: 120,
    });
    const program = updated.configurationSnapshot.programs[0];

    expect(program).toMatchObject({
      cycleSeconds: 120,
      greenSeconds: 45,
      amberSeconds: 4,
      redSeconds: 71,
      phases: 3,
    });
    expect(program.phaseTimings).toHaveLength(3);
    expect(program.phaseTimings[1]).toMatchObject({
      name: 'Fase 2 - Oriente/Poniente',
      greenSeconds: 35,
      amberSeconds: 4,
      redSeconds: 81,
      cycleSeconds: 120,
    });
  });
});
