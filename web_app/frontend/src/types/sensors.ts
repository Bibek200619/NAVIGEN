export interface SensorStatusInfo {
  name: string;
  topic: string;
  isActive: boolean;
  frequency?: number;
  lastUpdated?: number;
}
