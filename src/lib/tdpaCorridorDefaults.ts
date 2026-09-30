import { resolveTdpaCorridorSettings, type TdpaCorridorSettingsWithTemporal } from './tdpaCorridorSettings';
import type { Intersection, Study, TdpaMovementDistribution, TdpaTemporalDistribution } from './types';

function cloneMovementDistribution(distribution: TdpaMovementDistribution): TdpaMovementDistribution {
  return { ...distribution };
}

function cloneSettings(settings: TdpaCorridorSettingsWithTemporal): TdpaCorridorSettingsWithTemporal {
  return {
    mainDirectionAccessId: settings.mainDirectionAccessId,
    oppositeDirectionAccessId: settings.oppositeDirectionAccessId,
    movementDistributionByAccess: Object.fromEntries(
      Object.entries(settings.movementDistributionByAccess).map(([accessId, distribution]) => [
        accessId,
        cloneMovementDistribution(distribution),
      ]),
    ),
    temporalDistribution: settings.temporalDistribution
      ? ([...settings.temporalDistribution] as TdpaTemporalDistribution)
      : null,
  };
}

export function getLinkedCorridorIntersectionIds(
  intersections: Intersection[],
  sourceIntersectionId: string,
): string[] {
  const byId = new Map(intersections.map((intersection) => [intersection.id, intersection]));
  if (!byId.has(sourceIntersectionId)) return [];

  const visited = new Set<string>();
  const pending = [sourceIntersectionId];

  while (pending.length > 0) {
    const currentId = pending.shift();
    if (!currentId || visited.has(currentId)) continue;
    const current = byId.get(currentId);
    if (!current) continue;

    visited.add(currentId);
    const outgoing = current.relatedIntersectionIds ?? [];
    const incoming = intersections
      .filter((candidate) => (candidate.relatedIntersectionIds ?? []).includes(currentId))
      .map((candidate) => candidate.id);

    [...outgoing, ...incoming].forEach((relatedId) => {
      if (byId.has(relatedId) && !visited.has(relatedId)) pending.push(relatedId);
    });
  }

  return intersections
    .filter((intersection) => visited.has(intersection.id))
    .sort((left, right) => left.mapNumber - right.mapNumber)
    .map((intersection) => intersection.id);
}

export function applyTdpaSettingsToCorridorStudies(
  studiesByIntersection: Record<string, Study>,
  intersections: Intersection[],
  sourceIntersectionId: string,
  settings: TdpaCorridorSettingsWithTemporal,
): Record<string, Study> {
  const targetIds = new Set(getLinkedCorridorIntersectionIds(intersections, sourceIntersectionId));
  const updatedAt = new Date().toISOString();

  return Object.fromEntries(
    Object.entries(studiesByIntersection).map(([intersectionId, study]) => {
      if (!targetIds.has(intersectionId) || !study.tdpaEstimate) return [intersectionId, study];

      const copiedSettings = cloneSettings(settings);
      const normalizedSettings = resolveTdpaCorridorSettings({
        ...study,
        tdpaCorridorSettings: copiedSettings,
      });

      return [
        intersectionId,
        {
          ...study,
          tdpaCorridorSettings: normalizedSettings,
          tdpaGeneratedAt: null,
          status: study.status === 'validated' || study.status === 'exported' ? 'draft' : study.status,
          updatedAt,
        },
      ];
    }),
  );
}
