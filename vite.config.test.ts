// @vitest-environment node

import { describe, expect, it } from 'vitest';
import config from './vite.config';

describe('vite production config', () => {
  it('uses relative asset paths so Electron can load the packaged app from file protocol', () => {
    expect(config.base).toBe('./');
  });
});
