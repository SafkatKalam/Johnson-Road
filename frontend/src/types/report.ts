import type { TrafficPoint, VehicleClassBreakdownItem, WeeklyTrafficTrendPoint } from './dashboard';

export interface ProjectReport {
  id: string;
  title: string;
  date: string;
  type: 'weekly' | 'daily' | 'summary' | 'peak';
  vehicleCount: number;
}

export interface PeakHour {
  hour: string;
  vehicles: number;
  road: string;
}

export interface ReportAnalytics {
  trafficVolumeByHour: TrafficPoint[];
  vehicleClassBreakdown: VehicleClassBreakdownItem[];
  weeklyTrafficTrend: WeeklyTrafficTrendPoint[];
  peakHours: PeakHour[];
}
