import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { WizardApp } from './WizardApp';

describe('WizardApp capture error navigation TDD', () => {
  beforeEach(() => localStorage.clear());

  function renderWithIntersection() {
    render(<WizardApp />);
    fireEvent.click(screen.getByRole('button', { name: /^2\s*Interseccion$/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Crear marcador en el centro del mapa' }));
  }

  it('marks a missing required capture field invalid with a stable id and description', () => {
    renderWithIntersection();
    fireEvent.click(screen.getByRole('button', { name: /^5\s*Aforo$/ }));

    const input = screen.getByLabelText('Frente · 07:00-07:15 · Norte');
    expect(input).toHaveAttribute('id');
    expect(input.id).toMatch(/^capture-.+-through$/);
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAttribute('aria-describedby');
  });

  it('exposes every validation problem and focuses the exact field selected for correction', async () => {
    renderWithIntersection();
    fireEvent.click(screen.getByRole('button', { name: /^6\s*Validar$/ }));

    const correctionButtons = screen.getAllByRole('button', { name: /^Corregir / });
    expect(correctionButtons.length).toBeGreaterThan(20);
    fireEvent.click(correctionButtons.find((button) => button.getAttribute('aria-label')?.includes('Falta frente'))!);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Tabla unica de aforo' })).toBeInTheDocument();
      expect(screen.getByLabelText('Frente · 07:00-07:15 · Norte')).toHaveFocus();
    });
  });
});
