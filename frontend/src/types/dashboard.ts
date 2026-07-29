export type ProjectStatus = 'completed' | 'processing' | 'queued' | 'failed';

export interface DashboardKpis {
  totalVehicles: number;
  totalVehiclesDelta: number;
  activeJobs: number;
  completedReports: number;
  completedReportsDelta: number;
  avgConfidence: number;
  avgConfidenceDelta: number;
  hoursAnalyzed: number;
  hoursAnalyzedDelta: number;
}

export interface TrafficPoint {
  hour: string;
  vehicles: number;
  flow: string;
}

export interface VehicleClassBreakdownItem {
  name: string;
  value: number;
  color: string;
}

export interface WeeklyTrafficTrendPoint {
  day: string;
  vehicles: number;
  peak: number;
}

export interface AiInsight {
  id: string;
  title: string;
  detail: string;
  severity: 'info' | 'warn' | 'success';
  icon: string;
}

export interface AiTimelineItem {
  id: string;
  time: string;
  label: string;
  status: 'active' | 'completed';
}

export interface RecentActivityItem {
  id: string;
  projectName: string;
  action: string;
  time: string;
  status: ProjectStatus;
  projectId?: string;
}

export interface QuickAction {
  id: string;
  label: string;
  icon: string;
  to: string;
}

export interface SegmentDetail {
  id: string;
  range: string;
  vehicleCount: number;
  avgSpeed: number;
  peakDensity: number;
  events: string[];
}

export interface InsightDetail {
  trend: string;
  reason: string;
  recommendation: string;
}

export type TrafficByProjectMap = Record<string, TrafficPoint[]>;
