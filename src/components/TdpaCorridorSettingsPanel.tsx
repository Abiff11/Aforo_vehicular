import type { Dispatch } from 'react';
import type { MovementKey, Study, TdpaCorridorSettings } from '../lib/types';
import {
  getTdpaDirectionIssue,
  getTdpaDistributionStatus,
  resolveTdpaCorridorSettings,
  updateTdpaMovementPercentage,
} from '../lib/tdpaCorridorSettings';

const movementLabels: Record<MovementKey, string> = {
  left: 'Izquierda',
  through: 'Frente',
  right: 'Derecha',
  uTurn: 'Retorno',
};

interface TdpaCorridorSettingsPanelProps {
  study: Study;
  onChange: Dispatch<TdpaCorridorSettings>;
}

export function TdpaCorridorSettingsPanel({ study, onChange }: TdpaCorridorSettingsPanelProps) {
  const settings = resolveTdpaCorridorSettings(study);
  const accesses = study.configurationSnapshot.accesses;
  const directionIssue = getTdpaDirectionIssue(settings);

  const updateDirection = (
    field: 'mainDirectionAccessId' | 'oppositeDirectionAccessId',
    accessId: string,
  ) => {
    onChange({ ...settings, [field]: accessId });
  };

  const renderDistribution = (accessId: string, directionLabel: string) => {
    const access = accesses.find((candidate) => candidate.id === accessId);
    if (!access) return null;
    const distribution = settings.movementDistributionByAccess[access.id];
    const status = getTdpaDistributionStatus(distribution, access);

    return (
      <article className="access-card" key={`${directionLabel}-${access.id}`}>
        <h4>{directionLabel}: {access.name}</h4>
        <div className="form-grid">
          {(Object.keys(movementLabels) as MovementKey[]).map((movement) => (
            <label key={movement}>
              {movementLabels[movement]} (%)
              <input
                aria-label={`Porcentaje ${movementLabels[movement]} ${access.name}`}
                disabled={!access.movements[movement]}
                max={100}
                min={0}
                step="0.1"
                type="number"
                value={distribution[movement]}
                onChange={(event) => onChange(updateTdpaMovementPercentage(
                  study,
                  access.id,
                  movement,
                  event.target.value === '' ? 0 : Number(event.target.value),
                ))}
              />
            </label>
          ))}
        </div>
        <p className={status.valid ? 'result' : 'warning'}>{status.text}</p>
        {status.issues.length > 0 && (
          <ul>
            {status.issues.map((issue) => <li key={issue}>{issue}</li>)}
          </ul>
        )}
      </article>
    );
  };

  return (
    <section className="panel" aria-label="Configuración TDPA del corredor">
      <div className="section-heading">
        <div>
          <h3>Estimación TDPA del corredor</h3>
          <p className="section-description">
            Seleccione los dos accesos que representan la carretera y ajuste la distribución de giros. Cada acceso debe sumar exactamente 100% antes de generar el aforo estimado.
          </p>
        </div>
      </div>
      <div className="form-grid">
        <label>
          Sentido principal
          <select
            aria-label="Sentido principal"
            value={settings.mainDirectionAccessId}
            onChange={(event) => updateDirection('mainDirectionAccessId', event.target.value)}
          >
            {accesses.map((access) => <option key={access.id} value={access.id}>{access.name} (acceso)</option>)}
          </select>
        </label>
        <label>
          Sentido opuesto
          <select
            aria-label="Sentido opuesto"
            value={settings.oppositeDirectionAccessId}
            onChange={(event) => updateDirection('oppositeDirectionAccessId', event.target.value)}
          >
            {accesses.map((access) => <option key={access.id} value={access.id}>{access.name} (acceso)</option>)}
          </select>
        </label>
      </div>
      {directionIssue && (
        <p aria-label="Error de sentidos TDPA" className="warning" role="alert">{directionIssue}</p>
      )}
      <div className="access-grid">
        {renderDistribution(settings.mainDirectionAccessId, 'Sentido principal')}
        {renderDistribution(settings.oppositeDirectionAccessId, 'Sentido opuesto')}
      </div>
      <small>Modelo inicial: 10% izquierda, 80% frente, 10% derecha y 0% retorno. Los movimientos deshabilitados físicamente se mantienen en 0%.</small>
    </section>
  );
}
