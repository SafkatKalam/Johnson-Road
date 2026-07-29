export interface DashboardStat {
  id: number;
  title: string;
  value: string;
  change: string;
  positive: boolean;
}

export interface ProcessingJob {
  id: number;
  project: string;
  progress: number;
  status: string;
  eta: string;
}

export interface ProjectItem {
  id: number;
  name: string;
  uploaded: string;
  videos: number;
  status: string;
}