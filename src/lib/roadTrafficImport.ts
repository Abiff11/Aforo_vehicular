import type { Intersection, Study, TdpaEstimate } from './types';
import { createDefaultStudy } from './study';

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
    if (!best || distance < best.distance) return { intersection, distance };
    return best;
  }, null);

  if (!nearest) throw new Error('No hay intersecciones configuradas para asociar el CSV.');
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
  if (lines.length < 2) throw new Error('El CSV no contiene filas de datos.');

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

export function createTdpaEstimate(record: RoadTrafficRecord): TdpaEstimate {
  const profile = calculateRoadTrafficProfile(record);
  return {
    road: record.road,
    route: record.route,
    point: record.point,
    kilometer: record.kilometer,
    dailyTraffic: profile.dailyTraffic,
    designHourFactor: normalizeFraction(record.designHourFactor),
    directionalDistribution: normalizeFraction(record.directionalDistribution),
    designHourTotal: profile.designHourTotal,
    mainDirectionHour: profile.mainDirectionHour,
    oppositeDirectionHour: profile.oppositeDirectionHour,
    hourlyMotorcycles: profile.hourlyMotorcycles,
    hourlyHeavyVehicles: profile.hourlyHeavyVehicles,
    motorcycleShare: profile.motorcycleShare,
    heavyVehicleShare: profile.heavyVehicleShare,
  };
}

export function findCorridorIntersections(intersections: Intersection[], sourceIntersectionId: string): Intersection[] {
  const source = intersections.find((intersection) => intersection.id === sourceIntersectionId);
  if (!source) throw new Error(`Interseccion origen no encontrada: ${sourceIntersectionId}`);

  const corridorSegment = normalizeText(getCorridorSegment(intersections, source));
  return intersections
    .filter((intersection) => getNameSegments(intersection).some((segment) => normalizeText(segment) === corridorSegment))
    .sort((left, right) => left.mapNumber - right.mapNumber);
}

export function getCorridorName(intersections: Intersection[], sourceIntersectionId: string): string {
  const source = intersections.find((intersection) => intersection.id === sourceIntersectionId);
  if (!source) throw new Error(`Interseccion origen no encontrada: ${sourceIntersectionId}`);
  return getCorridorSegment(intersections, source);
}

function applyRoadTrafficEstimate(study: Study, record: RoadTrafficRecord): Study {
  const sourceNote = `Estimación TDPA ${record.route} km ${record.kilometer}. Punto generador: ${record.point}. No sustituye un aforo de intersección en campo.`;
  return {
    ...study,
    currentStep: 6,
    source: 'estimated_tdpa',
    tdpaEstimate: createTdpaEstimate(record),
    status: 'draft',
    metadata: {
      ...study.metadata,
      notes: study.metadata.notes ? `${study.metadata.notes} | ${sourceNote}` : sourceNote,
    },
    updatedAt: new Date().toISOString(),
  };
}

export function createTrafficStudyForIntersection(
  record: RoadTrafficRecord,
  intersection: Intersection,
  baseStudy?: Study,
): CorridorTrafficStudy {
  const base = baseStudy ?? createDefaultStudy(intersection.id);
  const aligned = {
    ...base,
    intersectionId: intersection.id,
    configurationSnapshot: { ...base.configurationSnapshot, intersectionId: intersection.id },
  };
  return { intersection, study: applyRoadTrafficEstimate(aligned, record) };
}

export function createCorridorTrafficStudies(
  record: RoadTrafficRecord,
  intersections: Intersection[],
  sourceIntersectionId?: string,
): CorridorTrafficStudy[] {
  const sourceIntersection = sourceIntersectionId
    ? intersections.find((intersection) => intersection.id === sourceIntersectionId)
    : findNearestIntersection(intersections, record);
  if (!sourceIntersection) throw new Error(`Interseccion origen no encontrada: ${sourceIntersectionId}`);

  return findCorridorIntersections(intersections, sourceIntersection.id).map((intersection) =>
    createTrafficStudyForIntersection(record, intersection),
  );
}
