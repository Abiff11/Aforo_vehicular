import { DEFAULT_MOVEMENT_DISTRIBUTION, validateMovementDistribution } from './roadTrafficImport';
import {
  UNIFORM_TDPA_TEMPORAL_DISTRIBUTION,
  validateTdpaTemporalDistribution,
  type TdpaTemporalDistribution,
} from './tdpaTemporalProfile';
import type {
  AccessConfig,
  MovementKey,
  Study,
  TdpaCorridorSettings,
  TdpaMovementDistribution,
} from './types';

const MOVEMENT_KEYS: MovementKey[] = ['left', 'through', 'right', 'uTurn'];
const PERCENT_TOLERANCE = 1e-9;

type TdpaTemporalIndex = 0 | 1 | 2 | 3;

export interface TdpaCorridorSettingsWithTemporal extends TdpaCorridorSettings {
  temporalDistribution?: TdpaTemporalDistribution | null;
}

function createDefaultDistribution(access: AccessConfig): TdpaMovementDistribution {
  const distribution: TdpaMovementDistribution = { ...DEFAULT_MOVEMENT_DISTRIBUTION };
  MOVEMENT_KEYS.forEach((movement) => {
    if (!access.movements[movement]) distribution[movement] = 0;
  });

  const total = MOVEMENT_KEYS.reduce((sum, movement) => sum + distribution[movement], 0);
  const preferredMovement = access.movements.through
    ? 'through'
    : MOVEMENT_KEYS.find((movement) => access.movements[movement]);
  if (preferredMovement && total < 100) distribution[preferredMovement] += 100 - total;

  return distribution;
}

function normalizeStoredDistribution(
  access: AccessConfig,
  stored: TdpaMovementDistribution,
): TdpaMovementDistribution {
  const distribution = { ...stored };
  MOVEMENT_KEYS.forEach((movement) => {
    if (!access.movements[movement]) distribution[movement] = 0;
  });
  return distribution;
}

export function resolveTdpaCorridorSettings(study: Study): TdpaCorridorSettingsWithTemporal {
  const accesses = study.configurationSnapshot.accesses;
  const stored = study.tdpaCorridorSettings as TdpaCorridorSettingsWithTemporal | null | undefined;
  const accessIds = new Set(accesses.map((access) => access.id));
  const mainDirectionAccessId = stored && accessIds.has(stored.mainDirectionAccessId)
    ? stored.mainDirectionAccessId
    : (accesses[0]?.id ?? '');
  const oppositeDirectionAccessId = stored && accessIds.has(stored.oppositeDirectionAccessId)
    ? stored.oppositeDirectionAccessId
    : (accesses.find((access) => access.id !== mainDirectionAccessId)?.id ?? mainDirectionAccessId);

  const movementDistributionByAccess = Object.fromEntries(
    accesses.map((access) => {
      const storedDistribution = stored?.movementDistributionByAccess?.[access.id];
      return [
        access.id,
        storedDistribution
          ? normalizeStoredDistribution(access, storedDistribution)
          : createDefaultDistribution(access),
      ];
    }),
  );

  return {
    mainDirectionAccessId,
    oppositeDirectionAccessId,
    movementDistributionByAccess,
    temporalDistribution: stored?.temporalDistribution ?? null,
  };
}

export function updateTdpaMovementPercentage(
  study: Study,
  accessId: string,
  movement: MovementKey,
  value: number,
): TdpaCorridorSettingsWithTemporal {
  const settings = resolveTdpaCorridorSettings(study);
  return {
    ...settings,
    movementDistributionByAccess: {
      ...settings.movementDistributionByAccess,
      [accessId]: {
        ...settings.movementDistributionByAccess[accessId],
        [movement]: value,
      },
    },
  };
}

export function applyUniformTdpaTemporalDistribution(study: Study): TdpaCorridorSettingsWithTemporal {
  const settings = resolveTdpaCorridorSettings(study);
  return {
    ...settings,
    temporalDistribution: [...UNIFORM_TDPA_TEMPORAL_DISTRIBUTION] as [number, number, number, number],
  };
}

export function updateTdpaTemporalPercentage(
  study: Study,
  index: TdpaTemporalIndex,
  value: number,
): TdpaCorridorSettingsWithTemporal {
  const settings = resolveTdpaCorridorSettings(study);
  const temporalDistribution: [number, number, number, number] = settings.temporalDistribution
    ? [...settings.temporalDistribution]
    : [0, 0, 0, 0];
  temporalDistribution[index] = value;

  return {
    ...settings,
    temporalDistribution,
  };
}

function formatPercentage(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
}

export function getTdpaDistributionStatus(
  distribution: TdpaMovementDistribution,
  access: AccessConfig,
): { valid: boolean; text: string; issues: string[] } {
  const total = MOVEMENT_KEYS.reduce((sum, movement) => sum + distribution[movement], 0);
  const issues = validateMovementDistribution(distribution, access.movements);

  if (total > 100 + PERCENT_TOLERANCE) {
    return {
      valid: false,
      text: `Distribución: ${formatPercentage(total)}% · Excede 100% por ${formatPercentage(total - 100)}%`,
      issues,
    };
  }
  if (total < 100 - PERCENT_TOLERANCE) {
    return {
      valid: false,
      text: `Distribución: ${formatPercentage(total)}% · Falta asignar ${formatPercentage(100 - total)}%`,
      issues,
    };
  }
  if (issues.length > 0) {
    return {
      valid: false,
      text: 'Distribución: 100% · Revisa los movimientos habilitados',
      issues,
    };
  }
  return { valid: true, text: 'Distribución: 100% · Lista para estimar', issues: [] };
}

export function getTdpaTemporalStatus(
  distribution: TdpaTemporalDistribution | null | undefined,
): { valid: boolean; text: string; issues: string[] } {
  if (!distribution) {
    return {
      valid: false,
      text: 'Perfil temporal: pendiente · Selecciona un supuesto o captura porcentajes',
      issues: ['Define explícitamente cómo se reparte la hora de diseño entre cuatro intervalos de 15 minutos.'],
    };
  }

  const total = distribution.reduce((sum, value) => sum + value, 0);
  const issues = validateTdpaTemporalDistribution(distribution);

  if (total > 100 + PERCENT_TOLERANCE) {
    return {
      valid: false,
      text: `Perfil temporal: ${formatPercentage(total)}% · Excede 100% por ${formatPercentage(total - 100)}%`,
      issues,
    };
  }
  if (total < 100 - PERCENT_TOLERANCE) {
    return {
      valid: false,
      text: `Perfil temporal: ${formatPercentage(total)}% · Falta asignar ${formatPercentage(100 - total)}%`,
      issues,
    };
  }
  if (issues.length > 0) {
    return {
      valid: false,
      text: 'Perfil temporal: 100% · Revisa los porcentajes',
      issues,
    };
  }

  return { valid: true, text: 'Perfil temporal: 100% · Listo para generar', issues: [] };
}

export function getTdpaDirectionIssue(settings: TdpaCorridorSettings): string | null {
  return settings.mainDirectionAccessId === settings.oppositeDirectionAccessId
    ? 'Los sentidos principal y opuesto deben usar accesos distintos.'
    : null;
}
