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

  it('starts the intersection map without preloaded work intersections', () => {
    render(<WizardApp />);
    goToIntersectionStep();

    const map = screen.getByRole('region', { name: 'Mapa real de intersecciones de Oaxaca' });
    expect(within(map).queryByRole('button', { name: /INT-\d{3}/ })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Nueva interseccion' })).toBeInTheDocument();
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
    fireEvent.click(within(map).getByRole('button', { name: /INT-001 Interseccion 001/ }));
    fireEvent.click(screen.getByRole('button', { name: /^3\s*Configuracion$/ }));
    expect(screen.getByDisplayValue('Acceso A personalizado')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /^1\s*Estudio$/ }));
    expect(screen.getByLabelText('Aforador')).toHaveValue('Hiram');
  });

  it('creates the first work intersection only after selecting a point on the map', () => {
    render(<WizardApp />);
    goToIntersectionStep();
    const map = screen.getByRole('region', { name: 'Mapa real de intersecciones de Oaxaca' });
    expect(within(map).queryByRole('button', { name: /INT-\d{3}/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Crear marcador en el centro del mapa' }));
    expect(screen.getByRole('heading', { name: 'INT-001' })).toBeInTheDocument();
    expect(within(map).getByRole('button', { name: /INT-001 Interseccion 001/ })).toBeInTheDocument();
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
    fireEvent.click(within(map).getByRole('button', { name: /INT-001 Interseccion 001/ }));
    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Cruce temporal' } });
    fireEvent.click(screen.getByRole('button', { name: 'Limpiar campos' }));
    expect(within(map).getByRole('button', { name: /INT-002 Interseccion 002/ })).toBeInTheDocument();
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

  it('manages signal programs and exposes overlap validation in Semaforo', () => {
    renderWithIntersection();
    fireEvent.click(screen.getByRole('button', { name: /^4\s*Semaforo$/ }));

    fireEvent.click(screen.getByRole('button', { name: 'Agregar programa' }));
    expect(screen.getByLabelText('Nombre programa P2')).toHaveValue('P2');
    expect(screen.getByLabelText('Hora inicio programa P2')).toHaveValue('09:00');
    expect(screen.getByLabelText('Hora termino programa P2')).toHaveValue('10:00');

    fireEvent.change(screen.getByLabelText('Hora inicio programa P2'), { target: { value: '08:30' } });
    expect(screen.getByText('Los programas P1 y P2 se traslapan.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Eliminar programa P2' }));
    expect(screen.queryByLabelText('Nombre programa P2')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Eliminar programa P1' })).not.toBeInTheDocument();
  });

  it('labels observed program as an optional operational note', () => {
    renderWithIntersection();
    fireEvent.click(screen.getByRole('button', { name: /^5\s*Aforo$/ }));

    expect(screen.getByRole('columnheader', { name: 'Programa observado (opcional)' })).toBeInTheDocument();
    expect(screen.getAllByLabelText(/Programa observado opcional ·/).length).toBeGreaterThan(0);
  });

  it('shows capture progress and navigates from validation to Aforo', () => {
    renderWithIntersection();
    fireEvent.click(screen.getByRole('button', { name: /^5\s*Aforo$/ }));

    const captureStatus = screen.getByRole('status', { name: 'Estado de captura' });
    expect(within(captureStatus).getByText(/0\/\d+ filas completas/)).toBeInTheDocument();
    expect(within(captureStatus).getByText(/filas incompletas/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /^6\s*Validar$/ }));
    expect(screen.getByRole('heading', { name: 'Captura por revisar' })).toBeInTheDocument();
    expect(screen.getByText(/07:00-07:15 · Norte/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Ir a Aforo' }));
    expect(screen.getByRole('heading', { name: 'Tabla unica de aforo' })).toBeInTheDocument();
  });

  it('marks missing capture fields with stable accessible error metadata', () => {
    renderWithIntersection();
    fireEvent.click(screen.getByRole('button', { name: /^5\s*Aforo$/ }));

    const input = screen.getByLabelText('Frente · 07:00-07:15 · Norte');
    expect(input).toHaveAttribute('id');
    expect(input.id).toMatch(/^capture-.+-through$/);
    expect(input).toHaveAttribute('aria-invalid', 'true');
    const describedBy = input.getAttribute('aria-describedby');
    expect(describedBy).toBeTruthy();
    expect(document.getElementById(describedBy!)).toHaveTextContent('Falta frente.');
  });

  it('reflects incomplete, error and complete capture row states from shared validation', () => {
    renderWithIntersection();
    fireEvent.click(screen.getByRole('button', { name: /^5\s*Aforo$/ }));

    const rowFor = () => screen.getByLabelText('Frente · 07:00-07:15 · Norte').closest('tr') as HTMLTableRowElement;
    expect(rowFor()).toHaveClass('capture-row-incomplete');

    fireEvent.change(screen.getByLabelText('Frente · 07:00-07:15 · Norte'), { target: { value: '-1' } });
    expect(rowFor()).toHaveClass('capture-row-error');

    within(rowFor()).getAllByRole('spinbutton').forEach((input) => {
      fireEvent.change(input, { target: { value: '0' } });
    });
    expect(rowFor()).toHaveClass('capture-row-complete');
  });

  it('shows every capture issue and focuses the exact field selected from validation', async () => {
    renderWithIntersection();
    fireEvent.click(screen.getByRole('button', { name: /^6\s*Validar$/ }));

    const correctionButtons = screen.getAllByRole('button', { name: /^Corregir / });
    expect(correctionButtons.length).toBeGreaterThan(20);
    const target = correctionButtons.find((button) => {
      const label = button.getAttribute('aria-label') ?? '';
      return label.includes('Falta frente.') && label.includes('07:00-07:15 · Norte');
    });
    expect(target).toBeDefined();
    fireEvent.click(target!);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Tabla unica de aforo' })).toBeInTheDocument();
      expect(screen.getByLabelText('Frente · 07:00-07:15 · Norte')).toHaveFocus();
    });
  });

  it('keeps signal warnings separate and navigates back to Semaforo', () => {
    renderWithIntersection();
    fireEvent.click(screen.getByRole('button', { name: /^4\s*Semaforo$/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Agregar programa' }));
    fireEvent.change(screen.getByLabelText('Hora inicio programa P2'), { target: { value: '08:30' } });

    fireEvent.click(screen.getByRole('button', { name: /^6\s*Validar$/ }));
    expect(screen.getByRole('heading', { name: 'Configuración semafórica por revisar' })).toBeInTheDocument();
    expect(screen.getByText('Los programas P1 y P2 se traslapan.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Captura por revisar' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Ir a Semáforo' }));
    expect(screen.getByRole('heading', { name: 'Programacion semaforica' })).toBeInTheDocument();
  });

  it('shows incomplete validation state until observed capture is complete', () => {
    renderWithIntersection();
    fireEvent.click(screen.getByRole('button', { name: /^6\s*Validar$/ }));
    expect(screen.getByRole('heading', { name: 'Captura por revisar' })).toBeInTheDocument();
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

  it('withholds definitive observed charts while the capture is incomplete', () => {
    renderWithIntersection();
    fireEvent.click(screen.getByRole('button', { name: /^7\s*Resultados$/ }));
    expect(screen.getByText('Volumen registrado parcial')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Calidad de captura' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Resultados observados no disponibles' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Volumen por intervalo' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Volumen por acceso' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Distribución por movimiento' })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Aforo consolidado por intervalo' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Colas y operación' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Ciclos observados' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Indicadores semafóricos por grupo' })).toBeInTheDocument();
    expect(screen.queryByText('Capacidad estimada (veh/h)')).not.toBeInTheDocument();
  });

  it('links one or more intersections created from the map', () => {
    renderWithIntersection();
    fireEvent.click(screen.getByRole('button', { name: /^2\s*Interseccion$/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Crear marcador en el centro del mapa' }));
    const map = screen.getByRole('region', { name: 'Mapa real de intersecciones de Oaxaca' });
    fireEvent.click(within(map).getByRole('button', { name: /INT-001 Interseccion 001/ }));
    const card = screen.getByRole('complementary');
    fireEvent.click(within(card).getByRole('checkbox', { name: /INT-002 Interseccion 002/ }));
    expect(within(card).getByText('1 vinculadas')).toBeInTheDocument();
  });
});
