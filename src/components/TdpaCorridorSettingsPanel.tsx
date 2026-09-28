import type { Dispatch } from 'react';
import type { MovementKey, Study, TdpaCorridorSettings } from '../lib/types';
import {
  getTdpaDirectionIssue,
  getTdpaDistributionStatus,
  resolveTdpaCorridorSettings,
  updateTdpaMovementPercentage,
} from '../lib/tdpaCorridorSettings';
import { InfoHint } from './InfoHint';

const movementLabels: Record<MovementKey, string> = {
  left: 'Izquierda',
  through: 'Frente',
  right: 'Derecha',
  uTurn: 'Retorno',
};

const movementHelp: Record<MovementKey, string> = {
  left: 'Porcentaje del flujo de este acceso que gira a la izquierda. El sistema lo aplicará al volumen horario estimado del acceso.',
  through: 'Porcentaje del flujo de este acceso que continúa de frente. El sistema lo aplicará al volumen horario estimado del acceso.',
  right: 'Porcentaje del flujo de este acceso que gira a la derecha. El sistema lo aplicará al volumen horario estimado del acceso.',
  uTurn: 'Porcentaje del flujo de este acceso que realiza retorno. Manténgalo en 0% cuando ese movimiento no exista o no deba estimarse.',
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
        <h4 style={{ alignItems: 'center', display: 'flex', gap: 4 }}>
          {directionLabel}: {access.name}
          <InfoHint label={`Distribución ${access.name}`}>
            La distribución indica cómo se reparte el volumen estimado que entra por este acceso entre los movimientos habilitados. Debe sumar exactamente 100%.
          </InfoHint>
        </h4>
        <div className="form-grid">
          {(Object.keys(movementLabels) as MovementKey[]).map((movement) => (
            <label key={movement}>
              <span style={{ alignItems: 'center', display: 'inline-flex', gap: 4 }}>
                {movementLabels[movement]} (%)
                <InfoHint label={`${movementLabels[movement]} ${access.name}`}>
                  {movementHelp[movement]}
                </InfoHint>
              </span>
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
          <h3 style={{ alignItems: 'center', display: 'flex', gap: 4 }}>
            Estimación TDPA del corredor
            <InfoHint label="Estimación TDPA del corredor">
              Esta configuración convierte el volumen TDPA del tramo en volúmenes estimados por acceso y movimiento. No representa un conteo físico observado en campo.
            </InfoHint>
          </h3>
          <p className="section-description">
            Seleccione los dos accesos que representan la carretera y ajuste la distribución de giros. Cada acceso debe sumar exactamente 100% antes de generar el aforo estimado.
          </p>
        </div>
      </div>

      <div aria-label="Guía de configuración TDPA" style={{ borderLeft: '3px solid var(--navy-600)', marginBottom: 18, padding: '2px 0 2px 12px' }}>
        <p style={{ marginBottom: 6 }}><strong>Qué vas a hacer:</strong> identificar por qué accesos entra el flujo del corredor y cómo se reparte entre izquierda, frente, derecha y retorno.</p>
        <p style={{ marginBottom: 6 }}><strong>Por qué es necesario:</strong> el TDPA aporta volumen del tramo, pero no indica directamente qué movimiento realiza cada vehículo en esta intersección.</p>
        <p style={{ marginBottom: 0 }}><strong>Para continuar:</strong> usa accesos diferentes para ambos sentidos y completa 100% de distribución en cada uno. Estos datos serán la base del aforo estimado.</p>
      </div>

      <div className="form-grid">
        <label>
          <span style={{ alignItems: 'center', display: 'inline-flex', gap: 4 }}>
            Sentido principal
            <InfoHint label="Sentido principal">
              Acceso que recibirá el volumen correspondiente al factor direccional D del archivo TDPA. Debe representar uno de los sentidos reales de circulación del corredor.
            </InfoHint>
          </span>
          <select
            aria-label="Sentido principal"
            value={settings.mainDirectionAccessId}
            onChange={(event) => updateDirection('mainDirectionAccessId', event.target.value)}
          >
            {accesses.map((access) => <option key={access.id} value={access.id}>{access.name} (acceso)</option>)}
          </select>
        </label>
        <label>
          <span style={{ alignItems: 'center', display: 'inline-flex', gap: 4 }}>
            Sentido opuesto
            <InfoHint label="Sentido opuesto">
              Acceso de la misma carretera que recibe el volumen restante después de aplicar la distribución direccional. Debe ser distinto del sentido principal.
            </InfoHint>
          </span>
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
      <small><strong>Modelo inicial:</strong> 10% izquierda, 80% frente, 10% derecha y 0% retorno. Los movimientos deshabilitados físicamente se mantienen en 0%. <strong>Obligatorio para TDPA:</strong> cada acceso seleccionado debe sumar exactamente 100%.</small>
    </section>
  );
}
