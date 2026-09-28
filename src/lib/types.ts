export type MovementKey = 'left' | 'through' | 'right' | 'uTurn';
export type StudySource = 'observed' | 'estimated_tdpa';
export type RowState = 'complete' | 'incomplete' | 'error';
export type StudyStatus = 'draft' | 'incomplete' | 'validated' | 'exported';
export type SaturationSource = 'measured' | 'estimated' | 'unknown';
export type SignalValidationCode =
  | 'program-overlap'
  | 'invalid-program-cycle'
  | 'invalid-program-phase'
  | 'invalid-assignment-program'
  | 'invalid-assignment-phase'
  | 'invalid-effective-green';

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
  linkedCsvFileName?: string;
  relatedIntersectionIds?: string[];
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

export interface SignalMovementAssignment {
  id: string;
  accessId: string;
  movement: MovementKey;
  programId: string;
  phaseId: string;
  lanes: number | null;
  saturationFlowPerLane: number | null;
  saturationSource: SaturationSource;
  effectiveGreenSeconds: number | null;
}

export interface SignalValidationIssue {
  code: SignalValidationCode;
  message: string;
  programId?: string;
  assignmentId?: string;
}

export interface IntersectionConfig {
  intersectionId: string;
  inherited: boolean;
  accesses: AccessConfig[];
  programs: SignalProgram[];
  signalMovementAssignments?: SignalMovementAssignment[];
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
  notes: string;
}

export interface TdpaEstimate {
  road: string;
  route: string;
  point: string;
  kilometer: number;
  dailyTraffic: number;
  designHourFactor: number;
  directionalDistribution: number;
  designHourTotal: number;
  mainDirectionHour: number;
  oppositeDirectionHour: number;
  hourlyMotorcycles: number;
  hourlyHeavyVehicles: number;
  motorcycleShare: number;
  heavyVehicleShare: number;
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
  status: StudyStatus;
  source?: StudySource;
  tdpaEstimate?: TdpaEstimate | null;
  legacyUnverified?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface RowValidationResult {
  rowId: string;
  state: RowState;
  issues: string[];
}

export interface PeakHourSummary {
  label: string;
  volume: number;
  maxIntervalVolume: number;
  factor: number | null;
  factorLabel: 'FHP' | 'Factor de uniformidad de hora pico';
  intervalIds?: string[];
  tie?: boolean;
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
  complete?: boolean;
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

export interface CycleObservationSummary {
  accessId: string;
  accessName: string;
  averageObservedCycle: number | null;
  minObservedCycle: number | null;
  maxObservedCycle: number | null;
  programmedCycleSeconds: number | null;
  averageDifferenceSeconds: number | null;
}

export interface SignalGroupIndicator {
  assignmentId: string;
  accessId: string;
  accessName: string;
  movement: MovementKey;
  movementLabel: string;
  programId: string;
  phaseId: string;
  peakHourVolume: number | null;
  saturationFlowPerLane: number | null;
  lanes: number | null;
  cycleSeconds: number | null;
  effectiveGreenSeconds: number | null;
  greenRatio: number | null;
  capacity: number | null;
  volumeCapacityRatio: number | null;
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
  cycleSummaries?: CycleObservationSummary[];
  signalGroupIndicators?: SignalGroupIndicator[];
  signalValidationIssues?: SignalValidationIssue[];
  signalIndicators: SignalIndicators;
  completeRows: number;
  incompleteRows: number;
  errorRows: number;
  completionPercent: number;
  isComplete: boolean;
  isPartial: boolean;
  rowValidation?: RowValidationResult[];
  dataQuality: string[];
  issues: string[];
  warnings?: string[];
}

export interface StoredState {
  catalogVersion: string;
  customIntersections?: Intersection[];
  intersectionConfigs: Record<string, IntersectionConfig>;
  lastConfiguration: IntersectionConfig | null;
  activeStudy: Study | null;
  studyTemplate?: StudyMetadata;
  studiesByIntersection?: Record<string, Study>;
  preferences: {
    intervalMinutes: number;
  };
}

export interface VersionedStoredState extends StoredState {
  schemaVersion: 1 | 2 | 3;
}
