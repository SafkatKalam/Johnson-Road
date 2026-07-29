import {
  aiInsights,
  aiTimeline,
  dashboardKpis,
  insightDetails,
  recentActivity,
  quickActions,
  segmentDetails,
  trafficByProject,
  trafficVolumeByHour,
  vehicleClassBreakdown,
  weeklyTrafficTrend,
} from '@/lib/mockData';
import type {
  AiInsight,
  AiTimelineItem,
  DashboardKpis,
  InsightDetail,
  QuickAction,
  RecentActivityItem,
  SegmentDetail,
  TrafficByProjectMap,
  TrafficPoint,
  VehicleClassBreakdownItem,
  WeeklyTrafficTrendPoint,
} from '@/types/dashboard';

export interface DashboardData {
  dashboardKpis: DashboardKpis;
  trafficVolumeByHour: TrafficPoint[];
  vehicleClassBreakdown: VehicleClassBreakdownItem[];
  weeklyTrafficTrend: WeeklyTrafficTrendPoint[];
  aiInsights: AiInsight[];
  aiTimeline: AiTimelineItem[];
  recentActivity: RecentActivityItem[];
  quickActions: QuickAction[];
  trafficByProject: TrafficByProjectMap;
  segmentDetails: Record<string, SegmentDetail>;
  insightDetails: Record<string, InsightDetail>;
}

const dashboardData: DashboardData = {
  dashboardKpis,
  trafficVolumeByHour,
  vehicleClassBreakdown,
  weeklyTrafficTrend,
  aiInsights,
  aiTimeline,
  recentActivity,
  quickActions,
  trafficByProject,
  segmentDetails,
  insightDetails,
};

export const TrafficService = {
  async getDashboardData(): Promise<DashboardData> {
    return Promise.resolve(dashboardData);
  },
  async getTrafficVolumeByHour(): Promise<TrafficPoint[]> {
    return Promise.resolve(trafficVolumeByHour);
  },
  async getVehicleClassBreakdown(): Promise<VehicleClassBreakdownItem[]> {
    return Promise.resolve(vehicleClassBreakdown);
  },
  async getWeeklyTrafficTrend(): Promise<WeeklyTrafficTrendPoint[]> {
    return Promise.resolve(weeklyTrafficTrend);
  },
};

export {
  aiInsights,
  aiTimeline,
  dashboardKpis,
  insightDetails,
  recentActivity,
  quickActions,
  segmentDetails,
  trafficByProject,
  trafficVolumeByHour,
  vehicleClassBreakdown,
  weeklyTrafficTrend,
  dashboardData,
};
