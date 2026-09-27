import type { Intersection, Study } from './types';
import { createDefaultStudy, rebuildStudyRows } from './study';

const DEFAULT_START_TIME = '07:00';
const DEFAULT_END_TIME = '08:00';
const DEFAULT_INTERVAL_MINUTES = 15;
const EARTH_RADIUS_METERS = 6_371_000;

export interface RoadTrafficRecord {
  road: string;
  roadKey: string;
  route: string;
  point: string;
  kilometer: number;
  annualDailyTraffic: number;
  motorcyclePercent: number;
  autosPercent: number;
  busesPercent: number;
  trucksPercent: number;
  directionalDistribution: number;
  designHourFactor: number;
  latitude: number;
  longitude: number;
}

export interface RoadTrafficProfile {
  dailyTraffic: number;
  designHourTotal: number;
  mainDirectionHour: number;
  oppositeDirectionHour: number;
  hourlyMotorcycles: number;
  hourlyHeavyVehicles: number;
  motorcycleShare: number;
  heavyVehicleShare: number;
}

export interface CorridorTrafficStudy {
  intersection: Intersection;
  study: Study;
}

function normalizeFraction(value: number): number {
  return value > 1 ? value / 100 : value;
}

function parseNumber(value: string | undefined, field: string): number {
  const normalized = Number(value?.trim());
  if (!Number.isFinite(normalized)) {
    throw new Error(`Campo numerico invalido: ${field}`);
  }

  return normalized;
}

function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = '';
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === '"' && quoted && next === '"') {
      current += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      quoted = !quoted;
      continue;
    }

    if (char === ',' && !quoted) {
      cells.push(current);
      current = '';
      continue;
    }

    current += char;
  }

  cells.push(current);
  return cells;
}

function splitIntegerTotal(total: number, parts: number): number[] {
  const base = Math.floor(total / parts);
  const remainder = total - base * parts;
  return Array.from({ length: parts }, (_, index) => base + (index < remainder ? 1 : 0));
}

function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();
}

function getNameSegments(intersection: Intersection): string[] {
  return intersection.name
    .split('/')
    .map((segment) => segment.trim())
    .filter(Boolean);
}

function calculateDistanceMeters(
  first: Pick<Intersection, 'latitude' | 'longitude'>,
  second: Pick<Intersection, 'latitude' | 'longitude'>,
): number {
  const firstLatitude = (first.latitude * Math.PI) / 180;
  const secondLatitude = (second.latitude * Math.PI) / 180;
  const latitudeDelta = ((second.latitude - first.latitude) * Math.PI) / 180;
  const longitudeDelta = ((second.longitude - first.longitude) * Math.PI) / 180;
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(firstLatitude) * Math.cos(secondLatitude) * Math.sin(longitudeDelta / 2) ** 2;

  return 2 * EARTH_RADIUS_METERS * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

function findNearestIntersection(intersections: Intersection[], record: RoadTrafficRecord): Intersection {
  const nearest = intersections.reduce<{ intersection: Intersection; distance: number } | null>((best, intersection) => {
    const distance = calculateDistanceMeters(intersection, { latitude: record.latitude, longitude: record.longitude });
    if (!best || distance < best.distance) {
      return { intersection, distance };
    }

    return best;
  }, null);

  if (!nearest) {
    throw new Error('No hay intersecciones configuradas para asociar el CSV.');
  }

  return nearest.intersection;
}

function getCorridorSegment(intersections: Intersection[], source: Intersection): string {
  const sourceSegments = getNameSegments(source);
  const segmentCounts = sourceSegments.map((segment) => {
    const normalized = normalizeText(segment);
    const count = intersections.filter((intersection) =>
      getNameSegments(intersection).some((item) => normalizeText(item) === normalized),
    ).length;

    return { segment, count };
  });

  return segmentCounts.sort((left, right) => right.count - left.count)[0]?.segment ?? source.name;
}

export function parseRoadTrafficCsv(csv: string): RoadTrafficRecord[] {
  const lines = csv
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length < 2) {
    throw new Error('El CSV no contiene filas de datos.');
  }

  const headers = splitCsvLine(lines[0]);

  return lines.slice(1).map((line) => {
    const cells = splitCsvLine(line);
    const row = new Map(headers.map((header, index) => [header, cells[index] ?? '']));
    const busesPercent = parseNumber(row.get('AUTOBUSES'), 'AUTOBUSES');
    const trucksPercent = parseNumber(row.get('CAMIONES'), 'CAMIONES');

    return {
      road: row.get('CARRETERA')?.trim() ?? '',
      roadKey: row.get('CLAVE CARRETERA')?.trim() ?? '',
      route: row.get('RUTA')?.trim() ?? '',
      point: row.get('PUNTO GENERADOR')?.trim() ?? '',
      kilometer: parseNumber(row.get('KM'), 'KM'),
      annualDailyTraffic: parseNumber(row.get('TDPA2024'), 'TDPA2024'),
      motorcyclePercent: parseNumber(row.get('M'), 'M'),
      autosPercent: parseNumber(row.get('AUTOS'), 'AUTOS'),
      busesPercent,
      trucksPercent,
      directionalDistribution: parseNumber(row.get('D'), 'D'),
      designHourFactor: parseNumber(row.get("K'"), "K'"),
      latitude: parseNumber(row.get('LAT'), 'LAT'),
      longitude: parseNumber(row.get('LONG'), 'LONG'),
    };
  });
}

export function calculateRoadTrafficProfile(record: RoadTrafficRecord): RoadTrafficProfile {
  const designHourTotal = Math.round(record.annualDailyTraffic * normalizeFraction(record.designHourFactor));
  const directionalShare = normalizeFraction(record.directionalDistribution);
  const mainDirectionHour = Math.round(designHourTotal * directionalShare);
  const oppositeDirectionHour = designHourTotal - mainDirectionHour;
  const motorcycleShare = normalizeFraction(record.motorcyclePercent);
  const heavyVehicleShare = normalizeFraction(record.busesPercent + record.trucksPercent);

  return {
    dailyTraffic: record.annualDailyTraffic,
    designHourTotal,
    mainDirectionHour,
    oppositeDirectionHour,
    hourlyMotorcycles: Math.round(designHourTotal * motorcycleShare),
    hourlyHeavyVehicles: Math.round(designHourTotal * heavyVehicleShare),
    motorcycleShare,
    heavyVehicleShare,
  };
}

export function findCorridorIntersections(intersections: Intersection[], sourceIntersectionId: string): Intersection[] {
  const source = intersections.find((intersection) => intersection.id === sourceIntersectionId);
  if (!source) {
    throw new Error(`Interseccion origen no encontrada: ${sourceIntersectionId}`);
  }

  const corridorSegment = normalizeText(getCorridorSegment(intersections, source));
  return intersections
    .filter((intersection) => getNameSegments(intersection).some((segment) => normalizeText(segment) === corridorSegment))
    .sort((left, right) => left.mapNumber - right.mapNumber);
}

export function getCorridorName(intersections: Intersection[], sourceIntersectionId: string): string {
  const source = intersections.find((intersection) => intersection.id === sourceIntersectionId);
  if (!source) {
    throw new Error(`Interseccion origen no encontrada: ${sourceIntersectionId}`);
  }

  return getCorridorSegment(intersections, source);
}

function applyRoadTrafficToStudy(study: Study, record: RoadTrafficRecord): Study {
  const profile = calculateRoadTrafficProfile(record);
  const intervalCount = Math.max(1, study.intervals.length);
  const mainDirectionIntervals = splitIntegerTotal(profile.mainDirectionHour, intervalCount);
  const oppositeDirectionIntervals = splitIntegerTotal(profile.oppositeDirectionHour, intervalCount);
  const sourceNote = `Estimacion TDPA ${record.route} km ${record.kilometer}; Giros no disponibles en CSV.`;

  return {
    ...study,
    currentStep: 6,
    metadata: {
      ...study.metadata,
      notes: `${sourceNote} Punto generador: ${record.point}.`,
    },
    rows: study.rows.map((row) => {
      const intervalIndex = study.intervals.findIndex((interval) => interval.id === row.intervalId);
      const through =
        row.accessId === 'north'
          ? mainDirectionIntervals[intervalIndex] ?? 0
          : row.accessId === 'south'
            ? oppositeDirectionIntervals[intervalIndex] ?? 0
            : 0;

      return {
        ...row,
        left: row.left === null ? null : 0,
        through: row.through === null ? null : through,
        right: row.right === null ? null : 0,
        uTurn: null,
        heavy: Math.round(through * profile.heavyVehicleShare),
        motorcycles: Math.round(through * profile.motorcycleShare),
        bicycles: 0,
        pedestrians: 0,
        observedProgram: 'TDPA',
        notes: through > 0 ? sourceNote : 'Acceso sin flujo estimado por el CSV de entrada.',
      };
    }),
  };
}

function createOneHourStudy(intersectionId: string, baseStudy?: Study): Study {
  const study = baseStudy ?? createDefaultStudy(intersectionId);
  return rebuildStudyRows({
    ...study,
    intersectionId,
    metadata: {
      ...study.metadata,
      startTime: DEFAULT_START_TIME,
      endTime: DEFAULT_END_TIME,
      intervalMinutes: DEFAULT_INTERVAL_MINUTES,
    },
  });
}

export function createTrafficStudyForIntersection(
  record: RoadTrafficRecord,
  intersection: Intersection,
  baseStudy?: Study,
): CorridorTrafficStudy {
  return {
    intersection,
    study: applyRoadTrafficToStudy(createOneHourStudy(intersection.id, baseStudy), record),
  };
}

export function createCorridorTrafficStudies(
  record: RoadTrafficRecord,
  intersections: Intersection[],
  sourceIntersectionId?: string,
): CorridorTrafficStudy[] {
  const sourceIntersection = sourceIntersectionId
    ? intersections.find((intersection) => intersection.id === sourceIntersectionId)
    : findNearestIntersection(intersections, record);
  if (!sourceIntersection) {
    throw new Error(`Interseccion origen no encontrada: ${sourceIntersectionId}`);
  }

  return findCorridorIntersections(intersections, sourceIntersection.id).map((intersection) =>
    createTrafficStudyForIntersection(record, intersection),
  );
}
