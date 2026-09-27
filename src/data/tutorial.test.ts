import { describe, expect, it } from 'vitest';
import { wizardSteps } from './tutorial';

describe('wizard tutorial content', () => {
  it('provides detailed help for every wizard step', () => {
    expect(wizardSteps).toHaveLength(8);

    for (const step of wizardSteps) {
      expect(step.helpTitle.length).toBeGreaterThan(10);
      expect(step.helpBody.length).toBeGreaterThan(80);
      expect(step.helpChecklist.length).toBeGreaterThanOrEqual(3);
    }
  });
});
