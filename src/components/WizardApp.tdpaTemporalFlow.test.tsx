import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { loadStoredState } from '../lib/storage';
import { WizardApp } from './WizardApp';

const roadTrafficCsv = `CARRETERA,"CLAVE CARRETERA",RUTA,"PUNTO GENERADOR",KM,TIPO,SC,TDPA2024,M,A,B,C2,C3,T3S2,T3S3,T3S2R4,OTROS,AUTOS,AUTOBUSES,CAMIONES,D,K',LAT,LONG
"Huajuapan de León - Oaxaca",20056,MEX-190,"T. Aut. Cuacnopalan - Oaxaca",181.8,3,1,24977,10.6,80.5,2,3.1,1.2,0.9,0.5,0.8,0.4,91.1,2,6.9,0.511,0.076,17.139925,-96.776604
`;

const mapCreateButtonName = 'Crear una intersección en el centro visible del mapa';

describe('WizardApp TDPA temporal estimation flow', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('generates explicit 15-minute estimated intervals, validates them and carries them to Results', async () => {
    render(<WizardApp />);
    fireEvent.click(screen.getByRole('button', { name: /^2\s*Interseccion$/ }));
    fireEvent.click(screen.getByRole('button', { name: mapCreateButtonName }));
    fireEvent.change(screen.getByLabelText('Importar CSV TDPA'), {
      target: { files: [new File([roadTrafficCsv], 'tdpa.csv', { type: 'text/csv' })] },
    });
    await waitFor(() => expect(screen.getByText('tdpa.csv vinculado')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Continuar a Configuracion' }));
    fireEvent.click(screen.getByRole('button', { name: 'Usar uniforme 25/25/25/25' }));
    fireEvent.click(screen.getByRole('button', { name: 'Continuar a Semaforo' }));
    fireEvent.click(screen.getByRole('button', { name: 'Continuar a Aforo' }));

    expect(screen.queryByRole('table', { name: 'Intervalos estimados TDPA' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Generar aforo estimado' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Generar aforo estimado' }));

    expect(screen.getByRole('heading', { name: 'Intervalos estimados TDPA de 15 minutos' })).toBeInTheDocument();
    expect(screen.getByText('ESTIMADO TDPA · PERFIL TEMPORAL ASUMIDO')).toBeInTheDocument();
    const intervalTable = screen.getByRole('table', { name: 'Intervalos estimados TDPA' });
    expect(within(intervalTable).getAllByText('0–15 min').length).toBe(2);
    expect(within(intervalTable).getByText('244')).toBeInTheDocument();
    expect(within(intervalTable).getByText('234')).toBeInTheDocument();
    expect(loadStoredState().activeStudy?.tdpaGeneratedAt).toBeTruthy();
    expect(loadStoredState().activeStudy?.status).toBe('draft');

    fireEvent.click(screen.getByRole('button', { name: 'Continuar a Validar' }));
    expect(screen.getByRole('button', { name: 'Validar estimación TDPA' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Validar estimación TDPA' }));
    expect(loadStoredState().activeStudy?.status).toBe('validated');

    fireEvent.click(screen.getByRole('button', { name: 'Continuar a Resultados' }));

    expect(screen.getByRole('heading', { name: 'Perfil temporal estimado de 15 minutos' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Volumen estimado por intervalo de 15 minutos' })).toBeInTheDocument();
    expect(screen.getByText(/Perfil temporal asumido: 25% · 25% · 25% · 25%/)).toBeInTheDocument();
  });

  it('does not fabricate interval volumes or allow generation when the temporal profile is missing', async () => {
    render(<WizardApp />);
    fireEvent.click(screen.getByRole('button', { name: /^2\s*Interseccion$/ }));
    fireEvent.click(screen.getByRole('button', { name: mapCreateButtonName }));
    fireEvent.change(screen.getByLabelText('Importar CSV TDPA'), {
      target: { files: [new File([roadTrafficCsv], 'tdpa.csv', { type: 'text/csv' })] },
    });
    await waitFor(() => expect(screen.getByText('tdpa.csv vinculado')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Continuar a Configuracion' }));
    fireEvent.click(screen.getByRole('button', { name: 'Continuar a Semaforo' }));
    fireEvent.click(screen.getByRole('button', { name: 'Continuar a Aforo' }));

    expect(screen.getByRole('heading', { name: 'Perfil temporal TDPA pendiente' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Generar aforo estimado' })).not.toBeInTheDocument();
    expect(screen.queryByRole('table', { name: 'Intervalos estimados TDPA' })).not.toBeInTheDocument();
  });
});
