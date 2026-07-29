import { projectReportsList, trafficVolumeByHour, vehicleClassBreakdown, weeklyTrafficTrend } from '@/lib/mockData';
import type { PeakHour, ProjectReport, ReportAnalytics } from '@/types/report';

export type { PeakHour, ProjectReport, ReportAnalytics };

const peakHours: PeakHour[] = [
  { hour: '08:00', vehicles: 3762, road: 'A406 East' },
  { hour: '17:30', vehicles: 3648, road: 'A406 East' },
  { hour: '18:00', vehicles: 3412, road: 'A406 East' },
  { hour: '08:15', vehicles: 3290, road: 'Parramatta Rd' },
  { hour: '09:00', vehicles: 2981, road: 'M5 J14' },
];

export const ReportService = {
  async getProjectReports(projectId: string): Promise<ProjectReport[]> {
    return Promise.resolve(projectReportsList[projectId] ?? []);
  },
  async getReportAnalytics(): Promise<ReportAnalytics> {
    return Promise.resolve({ trafficVolumeByHour, vehicleClassBreakdown, weeklyTrafficTrend, peakHours });
  },
};

export { projectReportsList, trafficVolumeByHour, vehicleClassBreakdown, weeklyTrafficTrend, peakHours };
