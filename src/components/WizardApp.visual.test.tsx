import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cwd } from 'node:process';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { WizardApp } from './WizardApp';

const executiveStyles = readFileSync(join(cwd(), 'src/styles.css'), 'utf8');

describe('WizardApp executive shell', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('keeps product navigation and removes the autosave indicator from the presented header', () => {
    render(<WizardApp />);

    expect(screen.getByRole('heading', { name: 'Aforos Intersecciones' })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Progreso' })).toBeInTheDocument();
    expect(executiveStyles).toMatch(/\.topbar\s*>\s*\.status-pill\s*\{[^}]*display:\s*none;/s);
  });
});
