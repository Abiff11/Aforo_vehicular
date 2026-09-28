import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { STORAGE_KEY } from '../lib/storage';
import { WizardApp } from './WizardApp';

const roadTrafficCsv = `CARRETERA,"CLAVE CARRETERA",RUTA,"PUNTO GENERADOR",KM,TIPO,SC,TDPA2024,M,A,B,C2,C3,T3S2,T3S3,T3S2R4,OTROS,AUTOS,AUTOBUSES,CAMIONES,D,K',LAT,LONG
"Huajuapan de León - Oaxaca",20056,MEX-190,"T. Aut. Cuacnopalan - Oaxaca",181.8,3,1,24977,10.6,80.5,2,3.1,1.2,0.9,0.5,0.8,0.4,91.1,2,6.9,0.511,0.076,17.139925,-96.776604
`;

describe('WizardApp ficha aforo capture flow', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function goToIntersectionStep() {
    fireEvent.click(screen.getByRole('button', { name: /^2\s*Interseccion$/ }));
  }

  function renderWithIntersection() {
    render(<WizardApp />);
    goToIntersectionStep();
    fireEvent.click(screen.getByRole('button', { name: 'Crear marcador en el centro del mapa' }));
  }

  it('starts with only general study metadata before the intersection step', () => {
    render(<WizardApp />);

    expect(screen.getByRole('button', { name: /^1\s*Estudio$/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^2\s*Interseccion$/ })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Datos del estudio' })).toBeInTheDocument();
    expect(screen.getByLabelText('Aforador')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Limpiar estudio' })).toBeInTheDocument();
    expect(screen.queryByLabelText(/Flujo de saturación general/)).not.toBeInTheDocument();
  });

  it('shows the verified intersection catalog before any custom marker is created', () => {
    render(<WizardApp />);
    goToIntersectionStep();

    const map = screen.getByRole('region', { name: 'Mapa real de intersecciones de Oaxaca' });
    expect(within(map).getByRole('button', { name: /INT-001 Calzada Ninos Heroes/ })).toBeInTheDocument();
    expect(within(map).getByRole('button', { name: /INT-047 Avenida Ferrocarril/ })).toBeInTheDocument();
  });

  it('reuses shared study metadata and restores each intersection study when switching markers', () => {
    render(<WizardApp />);
    fireEvent.change(screen.getByLabelText('Aforador'), { target: { value: 'Hiram' } });
    goToIntersectionStep();
    fireEvent.click(screen.getByRole('button', { name: 'Crear marcador en el centro del mapa' }));
    fireEvent.click(screen.getByRole('button', { name: /^3\s*Configuracion$/ }));
    fireEvent.change(screen.getByDisplayValue('Norte'), { target: { value: 'Acceso A personalizado' } });

    fireEvent.click(screen.getByRole('button', { name: /^2\s*Interseccion$/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Crear marcador en el centro del mapa' }));
    const map = screen.getByRole('region', { name: 'Mapa real de intersecciones de Oaxaca' });
    fireEvent.click(within(map).getByRole('button', { name: /INT-048 Interseccion 048/ }));
    fireEvent.click(screen.getByRole('button', { name: /^3\s*Configuracion$/ }));
    expect(screen.getByDisplayValue('Acceso A personalizado')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /^1\s*Estudio$/ }));
    expect(screen.getByLabelText('Aforador')).toHaveValue('Hiram');
  });

  it('shows the catalog and creates a custom work intersection after it', () => {
    render(<WizardApp />);
    goToIntersectionStep();
    const map = screen.getByRole('region', { name: 'Mapa real de intersecciones de Oaxaca' });
    expect(within(map).getByRole('button', { name: /INT-047 Avenida Ferrocarril/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Crear marcador en el centro del mapa' }));
    expect(screen.getByRole('heading', { name: 'INT-048' })).toBeInTheDocument();
    expect(within(map).getByRole('button', { name: /INT-048 Interseccion 048/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Limpiar campos' })).toBeInTheDocument();
  });

  it('clears only the active intersection and preserves shared study metadata', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<WizardApp />);
    fireEvent.change(screen.getByLabelText('Aforador'), { target: { value: 'Aforador persistente' } });
    goToIntersectionStep();
    fireEvent.click(screen.getByRole('button', { name: 'Crear marcador en el centro del mapa' }));
    fireEvent.click(screen.getByRole('button', { name: 'Crear marcador en el centro del mapa' }));
    const map = screen.getByRole('region', { name: 'Mapa real de intersecciones de Oaxaca' });
    fireEvent.click(within(map).getByRole('button', { name: /INT-048 Interseccion 048/ }));
    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Cruce temporal' } });
    fireEvent.click(screen.getByRole('button', { name: 'Limpiar campos' }));
    expect(within(map).getByRole('button', { name: /INT-049 Interseccion 049/ })).toBeInTheDocument();
    expect(screen.getByLabelText('Nombre')).toHaveValue('');
    fireEvent.click(screen.getByRole('button', { name: /^1\s*Estudio$/ }));
    expect(screen.getByLabelText('Aforador')).toHaveValue('Aforador persistente');
  });

  it('clears the whole persisted application when Limpiar estudio is confirmed', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<WizardApp />);
    fireEvent.change(screen.getByLabelText('Aforador'), { target: { value: 'Se borrará' } });
    goToIntersectionStep();
    fireEvent.click(screen.getByRole('button', { name: 'Crear marcador en el centro del mapa' }));
    fireEvent.click(screen.getByRole('button', { name: /^1\s*Estudio$/ }));
    expect(localStorage.getItem(STORAGE_KEY)).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Limpiar estudio' }));
    expect(screen.getByLabelText('Aforador')).toHaveValue('');
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('does not silently regenerate captured rows when the study period changes', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    renderWithIntersection();
    fireEvent.click(screen.getByRole('button', { name: /^5\s*Aforo$/ }));
    const throughInputs = screen.getAllByLabelText(/Frente ·/);
    fireEvent.change(throughInputs[0], { target: { value: '25' } });
    fireEvent.click(screen.getByRole('button', { name: /^1\s*Estudio$/ }));
    const endTime = screen.getByLabelText('Hora termino');
    expect(endTime).toHaveValue('09:00');
    fireEvent.change(endTime, { target: { value: '10:00' } });
    expect(window.confirm).toHaveBeenCalled();
    expect(endTime).toHaveValue('09:00');
  });

  it('keeps the prior study period and explains when the selected interval is invalid', () => {
    render(<WizardApp />);

    const endTime = screen.getByLabelText('Hora termino');
    fireEvent.change(endTime, { target: { value: '07:07' } });

    expect(endTime).toHaveValue('09:00');
    expect(screen.getByText('La duracion del estudio no puede dividirse exactamente en intervalos de 15 minutos.')).toBeInTheDocument();
  });

  it('configures physical lane-group saturation in Configuracion and signal timing in Semaforo', () => {
    renderWithIntersection();
    fireEvent.click(screen.getByRole('button', { name: /^3\s*Configuracion$/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Agregar grupo de carriles' }));

    expect(screen.getByRole('heading', { name: 'Grupos de carriles y movimientos' })).toBeInTheDocument();
    expect(screen.getByLabelText('Acceso grupo signal-group-1')).toHaveValue('north');
    expect(screen.getByLabelText('Movimiento grupo signal-group-1')).toHaveValue('through');
    fireEvent.change(screen.getByLabelText('Carriles grupo signal-group-1'), { target: { value: '2' } });
    fireEvent.change(screen.getByLabelText('Saturación grupo signal-group-1'), { target: { value: '1800' } });
    fireEvent.change(screen.getByLabelText('Origen saturación grupo signal-group-1'), { target: { value: 'measured' } });
    expect(screen.getByLabelText('Carriles grupo signal-group-1')).toHaveValue(2);
    expect(screen.getByLabelText('Saturación grupo signal-group-1')).toHaveValue(1800);
    expect(screen.getByLabelText('Origen saturación grupo signal-group-1')).toHaveValue('measured');
    expect(screen.queryByLabelText('Verde efectivo grupo signal-group-1')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /^4\s*Semaforo$/ }));
    fireEvent.change(screen.getByLabelText('Fases'), { target: { value: '1' } });
    expect(screen.getByRole('heading', { name: 'Asignación semafórica de grupos' })).toBeInTheDocument();
    expect(screen.getByLabelText('Programa grupo signal-group-1')).toHaveValue('p1');
    fireEvent.change(screen.getByLabelText('Fase grupo signal-group-1'), { target: { value: 'phase-1' } });
    fireEvent.change(screen.getByLabelText('Verde efectivo grupo signal-group-1'), { target: { value: '40' } });
    expect(screen.getByLabelText('Fase grupo signal-group-1')).toHaveValue('phase-1');
    expect(screen.getByLabelText('Verde efectivo grupo signal-group-1')).toHaveValue(40);
    expect(screen.queryByLabelText('Carriles grupo signal-group-1')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Saturación grupo signal-group-1')).not.toBeInTheDocument();
  });

  it('shows incomplete validation state until observed capture is complete', () => {
    renderWithIntersection();
    fireEvent.click(screen.getByRole('button', { name: /^6\s*Validar$/ }));
    expect(screen.getByText(/filas incompletas/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Validar estudio' }));
    expect(screen.getByText('Estado del estudio: Incompleto')).toBeInTheDocument();
  });

  it('links TDPA as an estimate rather than an observed aforo', async () => {
    renderWithIntersection();
    fireEvent.change(screen.getByLabelText('Importar CSV TDPA'), {
      target: { files: [new File([roadTrafficCsv], 'tdpa.csv', { type: 'text/csv' })] },
    });
    await waitFor(() => expect(screen.getByText('tdpa.csv vinculado')).toBeInTheDocument());

    expect(screen.getByText('ESTIMACIÓN TDPA — NO SUSTITUYE UN AFORO DE INTERSECCIÓN EN CAMPO.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Estimación TDPA' })).toBeInTheDocument();
    expect(screen.getByText('Volumen hora de diseño estimado')).toBeInTheDocument();
    expect(screen.getByText('1,898')).toBeInTheDocument();
    expect(screen.getByText('T. Aut. Cuacnopalan - Oaxaca')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Volumen por intervalo' })).not.toBeInTheDocument();
  });

  it('shows Excel-aligned observed dashboard sections without aggregate capacity', () => {
    renderWithIntersection();
    fireEvent.click(screen.getByRole('button', { name: /^7\s*Resultados$/ }));
    expect(screen.getByText('Volumen registrado parcial')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Calidad de captura' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Volumen por intervalo' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Volumen por acceso' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Distribución por movimiento' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Aforo consolidado por intervalo' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Colas y operación' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Ciclos observados' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Indicadores semafóricos por grupo' })).toBeInTheDocument();
    expect(screen.queryByText('Capacidad estimada (veh/h)')).not.toBeInTheDocument();
  });

  it('links one or more nearby intersections from the selected intersection card', () => {
    renderWithIntersection();
    fireEvent.click(screen.getByRole('button', { name: /^2\s*Interseccion$/ }));
    const map = screen.getByRole('region', { name: 'Mapa real de intersecciones de Oaxaca' });
    fireEvent.click(within(map).getByRole('button', { name: /INT-001 Calzada Ninos Heroes/ }));
    const card = screen.getByRole('complementary');
    fireEvent.click(within(card).getByRole('checkbox', { name: /INT-002 Calzada Ninos Heroes/ }));
    expect(within(card).getByText('1 vinculadas')).toBeInTheDocument();
  });
});
