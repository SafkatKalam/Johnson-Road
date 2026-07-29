export type ProjectStatus = 'completed' | 'processing' | 'queued' | 'failed';

export interface Project {
  id: string;
  name: string;
  location: string;
  status: ProjectStatus;
  duration: number;
  videoCount: number;
  vehicleCount: number;
  avgFlow: number;
  peakHour: string;
  createdAt: string;
  updatedAt?: string;
  thumbnail: string;
  confidence: number;
  reportCount?: number;
  aiJobCount?: number;
  storageUsed?: number;
}

export interface ProjectVideo {
  id: string;
  name: string;
  duration: string;
  resolution: string;
  fps: number;
  size: string;
  status: 'analyzed' | 'processing' | 'queued';
  camera: string;
}

export interface ProjectReport {
  id: string;
  title: string;
  date: string;
  type: 'weekly' | 'daily' | 'summary' | 'peak';
  vehicleCount: number;
}
