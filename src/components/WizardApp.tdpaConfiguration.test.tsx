import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { STORAGE_KEY } from '../lib/storage';
import { WizardApp } from './WizardApp';

const mapCreateButtonName = 'Crear una intersección en el centro visible del mapa';

function openTdpaConfiguration() {
  fireEvent.click(screen.getByRole('button', { name: /^2\s*Interseccion$/ }));
  fireEvent.click(screen.getByRole('button', { name: mapCreateButtonName }));
  fireEvent.click(screen.getByRole('button', { name: /^3\s*Configuracion$/ }));
}

describe('WizardApp TDPA corridor configuration', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('starts with the 10/80/10/0 model and validates every selected access at exactly 100 percent', () => {
    render(<WizardApp />);
    openTdpaConfiguration();

    expect(screen.getByLabelText('Sentido principal')).toHaveValue('north');
    expect(screen.getByLabelText('Sentido opuesto')).toHaveValue('south');
    expect(screen.getByLabelText('Porcentaje Izquierda Norte')).toHaveValue(10);
    expect(screen.getByLabelText('Porcentaje Frente Norte')).toHaveValue(80);
    expect(screen.getByLabelText('Porcentaje Derecha Norte')).toHaveValue(10);
    expect(screen.getByLabelText('Porcentaje Retorno Norte')).toHaveValue(0);
    expect(screen.getAllByText('Distribución: 100% · Lista para estimar')).toHaveLength(2);

    fireEvent.change(screen.getByLabelText('Porcentaje Frente Norte'), { target: { value: '90' } });

    expect(screen.getByText('Distribución: 110% · Excede 100% por 10%')).toBeInTheDocument();
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
    expect(saved.activeStudy.tdpaCorridorSettings.movementDistributionByAccess.north.through).toBe(90);
  });

  it('forces a disabled movement to zero and rejects using the same access for both directions', () => {
    render(<WizardApp />);
    openTdpaConfiguration();

    const northCard = screen.getByRole('heading', { name: 'Norte' }).closest('article');
    if (!northCard) throw new Error('Tarjeta Norte no encontrada');
    fireEvent.click(within(northCard).getByRole('button', { name: 'Der' }));

    expect(screen.getByLabelText('Porcentaje Derecha Norte')).toBeDisabled();
    expect(screen.getByLabelText('Porcentaje Derecha Norte')).toHaveValue(0);
    expect(screen.getByText('Distribución: 90% · Falta asignar 10%')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Sentido opuesto'), { target: { value: 'north' } });
    expect(screen.getByRole('alert', { name: 'Error de sentidos TDPA' })).toHaveTextContent(
      'Los sentidos principal y opuesto deben usar accesos distintos.',
    );
  });
});
