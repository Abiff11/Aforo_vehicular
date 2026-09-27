export type MovementKey = 'left' | 'through' | 'right' | 'uTurn';

export type VerificationStatus = 'verified' | 'pending';

export interface Intersection {
  id: string;
  mapNumber: number;
  name: string;
  municipality: string;
  locality: string;
  verificationStatus: VerificationStatus;
  latitude: number;
  longitude: number;
  notes: string;
}

export interface AccessConfig {
  id: string;
  name: string;
  lanes: number;
  movements: Record<MovementKey, boolean>;
}

export interface SignalProgram {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  cycleSeconds: number | null;
  phases: number | null;
  greenSeconds: number | null;
  amberSeconds: number | null;
  redSeconds: number | null;
  clearanceSeconds: number | null;
  phaseTimings: SignalPhaseTiming[];
  notes: string;
}

export interface SignalPhaseTiming {
  id: string;
  name: string;
  cycleSeconds: number | null;
  greenSeconds: number | null;
  amberSeconds: number | null;
  redSeconds: number | null;
}

export interface IntersectionConfig {
  intersectionId: string;
  inherited: boolean;
  accesses: AccessConfig[];
  programs: SignalProgram[];
  updatedAt: string;
}

export interface IntervalBlock {
  id: string;
  start: string;
  end: string;
  label: string;
}

export type NumericCaptureValue = number | null;

export interface CaptureRow {
  id: string;
  intervalId: string;
  intervalLabel: string;
  intervalStart: string;
  intervalEnd: string;
  accessId: string;
  accessName: string;
  left: NumericCaptureValue;
  through: NumericCaptureValue;
  right: NumericCaptureValue;
  uTurn: NumericCaptureValue;
  heavy: NumericCaptureValue;
  motorcycles: NumericCaptureValue;
  bicycles: NumericCaptureValue;
  pedestrians: NumericCaptureValue;
  maxQueue: NumericCaptureValue;
  averageQueue: NumericCaptureValue;
  queueLength: NumericCaptureValue;
  stoppedVehiclesPerCycle: NumericCaptureValue;
  observedCycle: NumericCaptureValue;
  observedProgram: string;
  notes: string;
}

export interface StudyMetadata {
  date: string;
  startTime: string;
  endTime: string;
  intervalMinutes: number;
  surveyor: string;
  weather: string;
  observedSaturationFlowPerLane: NumericCaptureValue;
  notes: string;
}

export interface Study {
  id: string;
  intersectionId: string;
  relatedIntersectionIds: string[];
  currentStep: number;
  metadata: StudyMetadata;
  configurationSnapshot: IntersectionConfig;
  intervals: IntervalBlock[];
  rows: CaptureRow[];
  status: 'draft' | 'validated' | 'exported';
  createdAt: string;
  updatedAt: string;
}

export interface PeakHourSummary {
  label: string;
  volume: number;
  maxIntervalVolume: number;
  factor: number | null;
  factorLabel: 'FHP' | 'Factor de uniformidad de hora pico';
}

export interface IntervalSummary {
  intervalId: string;
  label: string;
  start: string;
  end: string;
  left: number;
  through: number;
  right: number;
  uTurn: number;
  total: number;
  heavy: number;
  motorcycles: number;
  bicycles: number;
  pedestrians: number;
  notes: string;
}

export interface QueueAccessSummary {
  accessId: string;
  accessName: string;
  maxQueue: number | null;
  averageQueue: number | null;
  maxQueueLength: number | null;
  stoppedVehiclesPerCycle: number | null;
  notes: string;
}

export interface SignalIndicators {
  peakHourFlow: number | null;
  cycleSeconds: number | null;
  effectiveGreenSeconds: number | null;
  greenRatio: number | null;
  saturationFlowPerLane: number | null;
  capacity: number | null;
  volumeCapacityRatio: number | null;
}

export interface StudySummary {
  totalMotorized: number;
  totalHeavy: number;
  totalMotorcycles: number;
  totalBicycles: number;
  totalPedestrians: number;
  peakInterval: { label: string; volume: number } | null;
  peakHour: PeakHourSummary | null;
  averageIntervalVolume: number;
  byInterval: IntervalSummary[];
  byAccess: Array<{ accessId: string; accessName: string; volume: number }>;
  byMovement: Array<{ movement: string; volume: number; percent: number }>;
  queueByAccess: QueueAccessSummary[];
  signalIndicators: SignalIndicators;
  dataQuality: string[];
  issues: string[];
}

export interface StoredState {
  catalogVersion: string;
  intersectionConfigs: Record<string, IntersectionConfig>;
  lastConfiguration: IntersectionConfig | null;
  activeStudy: Study | null;
  preferences: {
    intervalMinutes: number;
  };
}

export interface VersionedStoredState extends StoredState {
  schemaVersion: 1;
}
