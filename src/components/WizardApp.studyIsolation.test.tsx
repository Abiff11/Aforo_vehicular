import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { createInitialState, STORAGE_KEY } from '../lib/storage';
import { createDefaultStudy } from '../lib/study';
import { WizardApp } from './WizardApp';

const mapCreateButtonName = 'Crear una intersección en el centro visible del mapa';
const firstMapMarkerName = /1\. Interseccion 001/;

function goToIntersectionStep() {
  fireEvent.click(screen.getByRole('button', { name: /^2\s*Interseccion$/ }));
}

function createIntersection() {
  fireEvent.click(screen.getByRole('button', { name: mapCreateButtonName }));
}

describe('WizardApp study configuration isolation', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('starts a second study from defaults and restores the first study own configuration', () => {
    render(<WizardApp />);
    goToIntersectionStep();
    createIntersection();

    fireEvent.click(screen.getByRole('button', { name: /^3\s*Configuracion$/ }));
    fireEvent.change(screen.getByDisplayValue('Norte'), { target: { value: 'Acceso exclusivo INT-001' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar configuracion' }));

    goToIntersectionStep();
    createIntersection();
    fireEvent.click(screen.getByRole('button', { name: /^3\s*Configuracion$/ }));

    expect(screen.queryByDisplayValue('Acceso exclusivo INT-001')).not.toBeInTheDocument();
    expect(screen.getByDisplayValue('Norte')).toBeInTheDocument();
    expect(screen.queryByText(/Configuracion heredada/)).not.toBeInTheDocument();

    goToIntersectionStep();
    const map = screen.getByRole('region', { name: 'Mapa real de intersecciones de Oaxaca' });
    fireEvent.click(within(map).getByRole('button', { name: firstMapMarkerName }));
    fireEvent.click(screen.getByRole('button', { name: /^3\s*Configuracion$/ }));

    expect(screen.getByDisplayValue('Acceso exclusivo INT-001')).toBeInTheDocument();
  });

  it('ignores a legacy lastConfiguration when creating a brand-new study', () => {
    const state = createInitialState();
    const legacyConfig = createDefaultStudy('INT-LEGACY').configurationSnapshot;
    legacyConfig.accesses[0] = { ...legacyConfig.accesses[0], name: 'Acceso heredado legado' };

    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      schemaVersion: 3,
      ...state,
      lastConfiguration: legacyConfig,
    }));

    render(<WizardApp />);
    goToIntersectionStep();
    createIntersection();
    fireEvent.click(screen.getByRole('button', { name: /^3\s*Configuracion$/ }));

    expect(screen.queryByDisplayValue('Acceso heredado legado')).not.toBeInTheDocument();
    expect(screen.getByDisplayValue('Norte')).toBeInTheDocument();
    expect(screen.queryByText(/Configuracion heredada/)).not.toBeInTheDocument();
  });
});
