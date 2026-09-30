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

    expect(screen.getByRole('combobox', { name: 'Sentido principal' })).toHaveValue('north');
    expect(screen.getByRole('combobox', { name: 'Sentido opuesto' })).toHaveValue('south');
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

    fireEvent.change(screen.getByRole('combobox', { name: 'Sentido opuesto' }), { target: { value: 'north' } });
    expect(screen.getByRole('alert', { name: 'Error de sentidos TDPA' })).toHaveTextContent(
      'Los sentidos principal y opuesto deben usar accesos distintos.',
    );
  });

  it('guides the user with visible purpose text and contextual explanations for TDPA fields', () => {
    render(<WizardApp />);
    openTdpaConfiguration();

    expect(screen.getByLabelText('Guía de configuración TDPA')).toHaveTextContent('Qué vas a hacer:');
    expect(screen.getByLabelText('Guía de configuración TDPA')).toHaveTextContent('Por qué es necesario:');
    expect(screen.getByLabelText('Guía de configuración TDPA')).toHaveTextContent('Para continuar:');

    const principalHelp = screen.getByRole('button', { name: 'Ayuda: Sentido principal' });
    fireEvent.mouseEnter(principalHelp);
    expect(screen.getByRole('tooltip')).toHaveTextContent('factor direccional D');
    fireEvent.mouseLeave(principalHelp);

    const throughHelp = screen.getByRole('button', { name: 'Ayuda: Frente Norte' });
    fireEvent.click(throughHelp);
    expect(screen.getByRole('tooltip')).toHaveTextContent('continúa de frente');
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('requires an explicit TDPA temporal assumption and persists the selected profile', () => {
    render(<WizardApp />);
    openTdpaConfiguration();

    expect(screen.getByRole('region', { name: 'Perfil temporal TDPA' })).toHaveTextContent(
      'El CSV TDPA no contiene una distribución cada 15 minutos',
    );
    expect(screen.getByText('Perfil temporal: pendiente · Selecciona un supuesto o captura porcentajes')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Usar uniforme 25/25/25/25' }));

    expect(screen.getByLabelText('Porcentaje intervalo TDPA 1')).toHaveValue(25);
    expect(screen.getByLabelText('Porcentaje intervalo TDPA 2')).toHaveValue(25);
    expect(screen.getByLabelText('Porcentaje intervalo TDPA 3')).toHaveValue(25);
    expect(screen.getByLabelText('Porcentaje intervalo TDPA 4')).toHaveValue(25);
    expect(screen.getByText('Perfil temporal: 100% · Listo para generar')).toBeInTheDocument();

    let saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
    expect(saved.activeStudy.tdpaCorridorSettings.temporalDistribution).toEqual([25, 25, 25, 25]);

    fireEvent.change(screen.getByLabelText('Porcentaje intervalo TDPA 2'), { target: { value: '30' } });
    expect(screen.getByText('Perfil temporal: 105% · Excede 100% por 5%')).toBeInTheDocument();

    saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
    expect(saved.activeStudy.tdpaCorridorSettings.temporalDistribution).toEqual([25, 30, 25, 25]);
  });
});
