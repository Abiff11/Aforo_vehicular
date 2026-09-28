import type { AccessConfig, Intersection, MovementKey, Study, TdpaEstimate } from './types';
import { createDefaultStudy, hasCapturedData } from './study';

const EARTH_RADIUS_METERS = 6_371_000;
const MOVEMENT_KEYS: MovementKey[] = ['left', 'through', 'right', 'uTurn'];
const MOVEMENT_LABELS: Record<MovementKey, string> = {
  left: 'Izquierda',
  through: 'Frente',
  right: 'Derecha',
  uTurn: 'Retorno',
};
const PERCENT_TOLERANCE = 1e-9;

export type MovementDistribution = Record<MovementKey, number>;

export const DEFAULT_MOVEMENT_DISTRIBUTION: MovementDistribution = {
  left: 10,
  through: 80,
  right: 10,
  uTurn: 0,
};

export interface CorridorEstimationSettings {
  mainDirectionAccessId: string;
  oppositeDirectionAccessId: string;
  movementDistributionByAccess?: Record<string, MovementDistribution>;
}

export interface EstimatedAccessFlow {
  accessId: string;
  accessName: string;
  direction: 'main' | 'opposite';
  hourlyVolume: number;
  distribution: MovementDistribution;
  movements: Record<MovementKey, number>;
}

export interface IntersectionTrafficEstimate {
  referenceYear: number;
  designHourTotal: number;
  mainDirectionHour: number;
  oppositeDirectionHour: number;
  accesses: EstimatedAccessFlow[];
}

export interface RoadTrafficRecord {
  road: string;
  roadKey: string;
  route: string;
  point: string;
  kilometer: number;
  referenceYear: number;
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

export interface CorridorTrafficAssignment {
  intersection: Intersection;
  record: RoadTrafficRecord;
  distanceMeters: number;
}

export interface RoadTrafficCorridorAnalysis {
  sourceIntersection: Intersection;
  corridorName: string;
  records: RoadTrafficRecord[];
  intersections: Intersection[];
  assignments: CorridorTrafficAssignment[];
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

function findNearestRoadTrafficRecord(
  records: RoadTrafficRecord[],
  intersection: Pick<Intersection, 'latitude' | 'longitude'>,
): { record: RoadTrafficRecord; distanceMeters: number } {
  const nearest = records.reduce<{ record: RoadTrafficRecord; distanceMeters: number } | null>((best, record) => {
    const distanceMeters = calculateDistanceMeters(intersection, {
      latitude: record.latitude,
      longitude: record.longitude,
    });
    if (!best || distanceMeters < best.distanceMeters) return { record, distanceMeters };
    return best;
  }, null);

  if (!nearest) throw new Error('El CSV no contiene registros TDPA para analizar.');
  return nearest;
}

function getRoadRecordIdentity(record: RoadTrafficRecord): string {
  const roadKey = normalizeText(record.roadKey);
  if (roadKey) return `road-key:${roadKey}`;

  const route = normalizeText(record.route);
  if (route) return `route:${route}`;

  const road = normalizeText(record.road);
  if (road) return `road:${road}`;

  throw new Error('El registro TDPA no contiene carretera, clave ni ruta para identificar el tramo.');
}

function findLinkedCorridorIntersections(intersections: Intersection[], sourceIntersectionId: string): Intersection[] {
  const byId = new Map(intersections.map((intersection) => [intersection.id, intersection]));
  const source = byId.get(sourceIntersectionId);
  if (!source) throw new Error(`Interseccion origen no encontrada: ${sourceIntersectionId}`);

  const visited = new Set<string>();
  const pending = [source.id];

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
    .sort((left, right) => left.mapNumber - right.mapNumber);
}

export function analyzeRoadTrafficCorridor(
  records: RoadTrafficRecord[],
  intersections: Intersection[],
  sourceIntersectionId: string,
): RoadTrafficCorridorAnalysis {
  const sourceIntersection = intersections.find((intersection) => intersection.id === sourceIntersectionId);
  if (!sourceIntersection) throw new Error(`Interseccion origen no encontrada: ${sourceIntersectionId}`);
  if (records.length === 0) throw new Error('El CSV no contiene registros TDPA para analizar.');

  const anchor = findNearestRoadTrafficRecord(records, sourceIntersection).record;
  const corridorIdentity = getRoadRecordIdentity(anchor);
  const corridorRecords = records
    .filter((record) => getRoadRecordIdentity(record) === corridorIdentity)
    .sort((left, right) => left.kilometer - right.kilometer);
  const corridorIntersections = findLinkedCorridorIntersections(intersections, sourceIntersectionId);
  const assignments = corridorIntersections.map((intersection) => {
    const nearest = findNearestRoadTrafficRecord(corridorRecords, intersection);
    return {
      intersection,
      record: nearest.record,
      distanceMeters: nearest.distanceMeters,
    };
  });

  return {
    sourceIntersection,
    corridorName: anchor.road.trim() || anchor.route.trim() || anchor.roadKey.trim(),
    records: corridorRecords,
    intersections: corridorIntersections,
    assignments,
  };
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

function findLatestTdpaColumn(headers: string[]): { header: string; year: number } {
  const candidates = headers
    .map((header) => {
      const match = header.match(/^TDPA(\d{4})$/i);
      return match ? { header, year: Number(match[1]) } : null;
    })
    .filter((item): item is { header: string; year: number } => item !== null)
    .sort((left, right) => right.year - left.year);

  const latest = candidates[0];
  if (!latest) {
    throw new Error('El CSV no contiene una columna TDPA con año, por ejemplo TDPA2024.');
  }
  return latest;
}

export function validateMovementDistribution(
  distribution: MovementDistribution,
  enabledMovements?: Record<MovementKey, boolean>,
): string[] {
  const issues: string[] = [];

  MOVEMENT_KEYS.forEach((movement) => {
    const value = distribution[movement];
    if (!Number.isFinite(value) || value < 0 || value > 100) {
      issues.push(`El porcentaje de ${MOVEMENT_LABELS[movement]} debe estar entre 0% y 100%.`);
    }
    if (enabledMovements && !enabledMovements[movement] && Math.abs(value) > PERCENT_TOLERANCE) {
      issues.push(`El movimiento ${MOVEMENT_LABELS[movement]} está deshabilitado y debe tener 0%.`);
    }
  });

  const total = MOVEMENT_KEYS.reduce((sum, movement) => sum + distribution[movement], 0);
  if (Number.isFinite(total)) {
    if (total > 100 + PERCENT_TOLERANCE) {
      issues.push('La distribución de movimientos excede 100%.');
    } else if (Math.abs(total - 100) > PERCENT_TOLERANCE) {
      issues.push('La distribución de movimientos debe sumar exactamente 100%.');
    }
  }

  return issues;
}

function allocateIntegerVolume(total: number, distribution: MovementDistribution): Record<MovementKey, number> {
  const exact = MOVEMENT_KEYS.map((movement, index) => ({
    movement,
    index,
    exact: total * distribution[movement] / 100,
  }));
  const allocated = Object.fromEntries(
    exact.map(({ movement, exact: value }) => [movement, Math.floor(value)]),
  ) as Record<MovementKey, number>;
  let remainder = total - MOVEMENT_KEYS.reduce((sum, movement) => sum + allocated[movement], 0);

  exact
    .map((item) => ({ ...item, fraction: item.exact - Math.floor(item.exact) }))
    .sort((left, right) => right.fraction - left.fraction || left.index - right.index)
    .forEach(({ movement }) => {
      if (remainder <= 0) return;
      allocated[movement] += 1;
      remainder -= 1;
    });

  return allocated;
}

function createEstimatedAccessFlow(
  access: AccessConfig,
  direction: 'main' | 'opposite',
  hourlyVolume: number,
  distribution: MovementDistribution,
): EstimatedAccessFlow {
  const issues = validateMovementDistribution(distribution, access.movements);
  if (issues.length > 0) {
    throw new Error(`Distribución inválida para ${access.name}: ${issues.join(' ')}`);
  }

  return {
    accessId: access.id,
    accessName: access.name,
    direction,
    hourlyVolume,
    distribution: { ...distribution },
    movements: allocateIntegerVolume(hourlyVolume, distribution),
  };
}

export function createIntersectionTrafficEstimate(
  record: RoadTrafficRecord,
  accesses: AccessConfig[],
  settings: CorridorEstimationSettings,
): IntersectionTrafficEstimate {
  if (settings.mainDirectionAccessId === settings.oppositeDirectionAccessId) {
    throw new Error('Los sentidos principal y opuesto deben usar accesos distintos.');
  }

  const mainAccess = accesses.find((access) => access.id === settings.mainDirectionAccessId);
  const oppositeAccess = accesses.find((access) => access.id === settings.oppositeDirectionAccessId);
  if (!mainAccess) throw new Error(`Acceso principal no encontrado: ${settings.mainDirectionAccessId}`);
  if (!oppositeAccess) throw new Error(`Acceso opuesto no encontrado: ${settings.oppositeDirectionAccessId}`);

  const profile = calculateRoadTrafficProfile(record);
  const mainDistribution = settings.movementDistributionByAccess?.[mainAccess.id] ?? DEFAULT_MOVEMENT_DISTRIBUTION;
  const oppositeDistribution = settings.movementDistributionByAccess?.[oppositeAccess.id] ?? DEFAULT_MOVEMENT_DISTRIBUTION;

  return {
    referenceYear: record.referenceYear,
    designHourTotal: profile.designHourTotal,
    mainDirectionHour: profile.mainDirectionHour,
    oppositeDirectionHour: profile.oppositeDirectionHour,
    accesses: [
      createEstimatedAccessFlow(mainAccess, 'main', profile.mainDirectionHour, mainDistribution),
      createEstimatedAccessFlow(oppositeAccess, 'opposite', profile.oppositeDirectionHour, oppositeDistribution),
    ],
  };
}

export function parseRoadTrafficCsv(csv: string): RoadTrafficRecord[] {
  const lines = csv
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length < 2) throw new Error('El CSV no contiene filas de datos.');

  const headers = splitCsvLine(lines[0]).map((header) => header.trim());
  const tdpaColumn = findLatestTdpaColumn(headers);

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
      referenceYear: tdpaColumn.year,
      annualDailyTraffic: parseNumber(row.get(tdpaColumn.header), tdpaColumn.header),
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
    referenceYear: record.referenceYear,
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
  const preserveObservedSource = (study.source ?? 'observed') === 'observed' && hasCapturedData(study);
  const status = preserveObservedSource
    ? study.status === 'exported' ? 'validated' : study.status
    : 'draft';

  return {
    ...study,
    currentStep: 6,
    source: preserveObservedSource ? 'observed' : 'estimated_tdpa',
    tdpaEstimate: createTdpaEstimate(record),
    status,
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
