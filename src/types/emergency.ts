export type SMNAlertLevel = "VERDE" | "AMARILLO" | "NARANJA" | "ROJO";

export interface SMNAlertInfo {
  level: SMNAlertLevel;
  title: string;
  description: string;
  issuedAt: string;
  validUntil: string;
  windSpeedMaxKmH: number;
  expectedRainfallMm: number;
  hailRisk: boolean;
}

export interface RadarEchoCell {
  id: string;
  name: string;
  reflectivityDbz: number; // 15 to 65+ dBZ
  distanceKm: number;
  bearingDeg: number;
  direction: string;
  estimatedArrivalMinutes: number;
  cellType: "MODERADA" | "SEVERA" | "SUPERCELEBRA";
  affectedNeighborhoods: string[];
}

export interface HydrologicalZone {
  id: string;
  name: string;
  basin: string;
  waterLevelMeters: number;
  criticalThresholdMeters: number;
  status: "NORMAL" | "ALERTA_PREVENTIVA" | "DESBORDE_IMMINENTE" | "DESBORDADO";
  activePumps: number;
  totalPumps: number;
  vulnerablePeopleCount: number;
  cuitElectrodependientes: number;
  minorsUnder5: number;
  elderlyOver75: number;
  coordinates: [number, number];
}

export interface VulnerableGroupStats {
  totalInFloodRiskAreas: number;
  electrodependientesCount: number;
  disabilityCudCount: number;
  minorsUnder5Count: number;
  elderlyOver75Count: number;
}

export interface RadarAtmosphericMetrics {
  surfaceTempC: number;
  humidityPercent: number;
  pressureHpa: number;
  windGustsKmH: number;
  dewPointC: number;
  accumulatedRain24hMm: number;
}

export interface EmergencyRadarData {
  alert: SMNAlertInfo;
  radarCells: RadarEchoCell[];
  hydrologicalZones: HydrologicalZone[];
  vulnerableStats: VulnerableGroupStats;
  metrics: RadarAtmosphericMetrics;
  lastRadarSweep: string;
}
