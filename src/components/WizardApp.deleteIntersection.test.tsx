import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { STORAGE_KEY } from '../lib/storage';
import type { StoredState } from '../lib/types';
import { WizardApp } from './WizardApp';

const mapCreateButtonName = 'Crear una intersección en el centro visible del mapa';
const firstMapMarkerName = /1\. Interseccion 001/;
const secondMapMarkerName = /2\. Interseccion 002/;

describe('WizardApp intersection deletion', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function goToIntersectionStep() {
    fireEvent.click(screen.getByRole('button', { name: /^2\s*Interseccion$/ }));
  }

  it('keeps the selected intersection when deletion is cancelled', () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<WizardApp />);
    goToIntersectionStep();
    fireEvent.click(screen.getByRole('button', { name: mapCreateButtonName }));

    const map = screen.getByRole('region', { name: 'Mapa real de intersecciones de Oaxaca' });
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar punto' }));

    expect(confirm).toHaveBeenCalledWith(
      '¿Eliminar INT-001? Se borrarán el marcador y todos los datos capturados para esta intersección. Esta acción no se puede deshacer.',
    );
    expect(screen.getByRole('heading', { name: 'INT-001' })).toBeInTheDocument();
    expect(within(map).getByRole('button', { name: firstMapMarkerName })).toBeInTheDocument();
  });

  it('removes the selected intersection and all persisted references while preserving the rest of the study', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const { unmount } = render(<WizardApp />);
    fireEvent.change(screen.getByLabelText('Aforador'), { target: { value: 'Aforador persistente' } });
    goToIntersectionStep();
    fireEvent.click(screen.getByRole('button', { name: mapCreateButtonName }));
    fireEvent.click(screen.getByRole('button', { name: mapCreateButtonName }));

    const map = screen.getByRole('region', { name: 'Mapa real de intersecciones de Oaxaca' });
    fireEvent.click(within(map).getByRole('button', { name: firstMapMarkerName }));
    const card = screen.getByRole('complementary');
    fireEvent.click(within(card).getByRole('checkbox', { name: /INT-002 Interseccion 002/ }));

    fireEvent.click(within(map).getByRole('button', { name: secondMapMarkerName }));
    fireEvent.click(screen.getByRole('button', { name: /^3\s*Configuracion$/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Guardar configuracion' }));
    fireEvent.click(screen.getByRole('button', { name: /^2\s*Interseccion$/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar punto' }));

    expect(screen.getByRole('heading', { name: 'Nueva interseccion' })).toBeInTheDocument();

    const persisted = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as StoredState;
    expect(persisted.studyTemplate?.surveyor).toBe('Aforador persistente');
    expect(persisted.customIntersections?.map((intersection) => intersection.id)).toEqual(['INT-001']);
    expect(persisted.customIntersections?.[0]?.relatedIntersectionIds).not.toContain('INT-002');
    expect(persisted.studiesByIntersection?.['INT-001']?.relatedIntersectionIds).not.toContain('INT-002');
    expect(persisted.studiesByIntersection?.['INT-002']).toBeUndefined();
    expect(persisted.intersectionConfigs['INT-002']).toBeUndefined();
    expect(persisted.lastConfiguration).toBeNull();
    expect(persisted.activeStudy?.intersectionId).toBe('__UNASSIGNED__');
    expect(persisted.activeStudy?.currentStep).toBe(1);

    unmount();
    render(<WizardApp />);
    const reloadedMap = screen.getByRole('region', { name: 'Mapa real de intersecciones de Oaxaca' });
    await waitFor(() => {
      expect(within(reloadedMap).getByRole('button', { name: firstMapMarkerName })).toBeInTheDocument();
    });
    expect(within(reloadedMap).queryByRole('button', { name: secondMapMarkerName })).not.toBeInTheDocument();
  });
});
