import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { WizardApp } from './WizardApp';

const roadTrafficCsv = `CARRETERA,"CLAVE CARRETERA",RUTA,"PUNTO GENERADOR",KM,TIPO,SC,TDPA2024,M,A,B,C2,C3,T3S2,T3S3,T3S2R4,OTROS,AUTOS,AUTOBUSES,CAMIONES,D,K',LAT,LONG
"Huajuapan de León - Oaxaca",20056,MEX-190,"T. Aut. Cuacnopalan - Oaxaca",181.8,3,1,24977,10.6,80.5,2,3.1,1.2,0.9,0.5,0.8,0.4,91.1,2,6.9,0.511,0.076,17.139925,-96.776604
`;

describe('WizardApp ficha aforo capture flow', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  function renderWithIntersection() {
    render(<WizardApp />);
    fireEvent.click(screen.getByRole('button', { name: 'Crear marcador en el centro del mapa' }));
  }

  it('exposes the additional study and operation fields required by the ficha', () => {
    renderWithIntersection();

    fireEvent.click(screen.getByRole('button', { name: /^4\s*Estudio$/ }));
    expect(screen.getByLabelText('Flujo de saturación observado (veh/h/carril)')).toBeInTheDocument();
    expect(screen.getByLabelText('Observaciones generales')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /^5\s*Aforo$/ }));
    expect(screen.getByRole('columnheader', { name: 'Cola prom' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Longitud cola (m)' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Det./ciclo' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Ciclo obs.' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Programa' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Observaciones' })).toBeInTheDocument();
  });

  it('shows ficha indicators in results using the same calculated summary', () => {
    renderWithIntersection();

    fireEvent.click(screen.getByRole('button', { name: /^7\s*Resultados$/ }));

    expect(screen.getByText('Intervalo máximo')).toBeInTheDocument();
    expect(screen.getByText('Promedio 15 min')).toBeInTheDocument();
    expect(screen.getByText('g/C')).toBeInTheDocument();
    expect(screen.getByText('v/c')).toBeInTheDocument();
  });

  it('starts without default intersections and creates a work intersection from the map', () => {
    render(<WizardApp />);

    const map = screen.getByRole('region', { name: 'Mapa real de intersecciones de Oaxaca' });

    expect(within(map).queryByRole('button', { name: /INT-047/ })).not.toBeInTheDocument();
    expect(screen.getByText('Crea un marcador en el mapa para comenzar.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Crear marcador en el centro del mapa' }));

    expect(screen.getByRole('heading', { name: 'INT-001' })).toBeInTheDocument();
    expect(within(map).getByRole('button', { name: /INT-001 Interseccion 001/ })).toBeInTheDocument();
    expect(within(map).queryByRole('button', { name: /INT-047/ })).not.toBeInTheDocument();
  });

  it('links a road traffic CSV to the created intersection', async () => {
    renderWithIntersection();

    fireEvent.change(screen.getByLabelText('Importar CSV TDPA'), {
      target: {
        files: [new File([roadTrafficCsv], 'tdpa.csv', { type: 'text/csv' })],
      },
    });

    await waitFor(() => expect(screen.getByText('tdpa.csv vinculado')).toBeInTheDocument());

    expect(screen.getByText('Volumen total')).toBeInTheDocument();
    expect(screen.getByText('1,898')).toBeInTheDocument();
    expect(screen.getByText('T. Aut. Cuacnopalan - Oaxaca')).toBeInTheDocument();
  });

  it('selects an Oaxaca intersection from the map and keeps the configuration flow ready', () => {
    renderWithIntersection();

    const map = screen.getByRole('region', { name: 'Mapa real de intersecciones de Oaxaca' });

    expect(within(map).getByRole('button', { name: /INT-001 Interseccion 001/ })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'INT-001' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /^2\s*Configuracion$/ }));

    expect(screen.getByDisplayValue('Norte')).toBeInTheDocument();
  });

  it('links one or more nearby intersections from the selected intersection card', () => {
    renderWithIntersection();
    fireEvent.click(screen.getByRole('button', { name: 'Crear marcador en el centro del mapa' }));

    const map = screen.getByRole('region', { name: 'Mapa real de intersecciones de Oaxaca' });
    expect(within(map).getByText('Leaflet')).toBeInTheDocument();

    fireEvent.click(
      within(map).getByRole('button', {
        name: /INT-001 Interseccion 001/,
      }),
    );

    const card = screen.getByRole('complementary');
    fireEvent.click(within(card).getByRole('checkbox', { name: /INT-002 Interseccion 002/ }));

    expect(within(card).getByText('1 vinculadas')).toBeInTheDocument();
  });
});
