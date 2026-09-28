import type { Intersection, Study } from './types';
import {
  analyzeRoadTrafficCorridor,
  createTrafficStudyForIntersection,
  type CorridorTrafficStudy,
  type RoadTrafficCorridorAnalysis,
  type RoadTrafficRecord,
} from './roadTrafficImport';

export interface RoadTrafficCorridorGeneration {
  analysis: RoadTrafficCorridorAnalysis;
  studies: CorridorTrafficStudy[];
}

export function createRoadTrafficCorridorStudies(
  records: RoadTrafficRecord[],
  intersections: Intersection[],
  sourceIntersectionId: string,
  existingStudiesByIntersection: Record<string, Study> = {},
): RoadTrafficCorridorGeneration {
  const analysis = analyzeRoadTrafficCorridor(records, intersections, sourceIntersectionId);
  const studies = analysis.assignments.map(({ intersection, record }) =>
    createTrafficStudyForIntersection(
      record,
      intersection,
      existingStudiesByIntersection[intersection.id],
    ),
  );

  return { analysis, studies };
}
