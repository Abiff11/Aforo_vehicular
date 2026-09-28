import { DEFAULT_MOVEMENT_DISTRIBUTION, validateMovementDistribution } from './roadTrafficImport';
import type {
  AccessConfig,
  MovementKey,
  Study,
  TdpaCorridorSettings,
  TdpaMovementDistribution,
} from './types';

const MOVEMENT_KEYS: MovementKey[] = ['left', 'through', 'right', 'uTurn'];
const PERCENT_TOLERANCE = 1e-9;

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

export function resolveTdpaCorridorSettings(study: Study): TdpaCorridorSettings {
  const accesses = study.configurationSnapshot.accesses;
  const stored = study.tdpaCorridorSettings;
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
  };
}

export function updateTdpaMovementPercentage(
  study: Study,
  accessId: string,
  movement: MovementKey,
  value: number,
): TdpaCorridorSettings {
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

export function getTdpaDirectionIssue(settings: TdpaCorridorSettings): string | null {
  return settings.mainDirectionAccessId === settings.oppositeDirectionAccessId
    ? 'Los sentidos principal y opuesto deben usar accesos distintos.'
    : null;
}
