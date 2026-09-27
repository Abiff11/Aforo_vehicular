import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { WizardApp } from './WizardApp';

describe('WizardApp ficha aforo capture flow', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('exposes the additional study and operation fields required by the ficha', () => {
    render(<WizardApp />);

    fireEvent.click(screen.getByRole('button', { name: /^4\s+Estudio$/ }));
    expect(screen.getByLabelText('Flujo de saturación observado (veh/h/carril)')).toBeInTheDocument();
    expect(screen.getByLabelText('Observaciones generales')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /^5\s+Aforo$/ }));
    expect(screen.getByRole('columnheader', { name: 'Cola prom' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Longitud cola (m)' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Det./ciclo' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Ciclo obs.' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Programa' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Observaciones' })).toBeInTheDocument();
  });

  it('shows ficha indicators in results using the same calculated summary', () => {
    render(<WizardApp />);

    fireEvent.click(screen.getByRole('button', { name: /^7\s+Resultados$/ }));

    expect(screen.getByText('Intervalo máximo')).toBeInTheDocument();
    expect(screen.getByText('Promedio 15 min')).toBeInTheDocument();
    expect(screen.getByText('g/C')).toBeInTheDocument();
    expect(screen.getByText('v/c')).toBeInTheDocument();
  });
});
