export type JobStatus = 'running' | 'queued' | 'completed' | 'processing' | 'failed' | 'cancelled';
export type JobPriority = 'high' | 'normal' | 'low';

export interface JobQueueItem {
  id: string;
  projectName: string;
  projectId: string;
  progress: number;
  eta: string;
  status: JobStatus;
  priority: JobPriority;
  stage: string;
  fps: number;
  gpu: number;
  cpu: number;
  memory: number;
  queuePosition?: number;
  startedAt: string;
}

export interface ProcessingJob {
  id: string;
  projectName: string;
  progress: number;
  stage: string;
  eta: string;
  status: JobStatus;
  fps: number;
  currentFrame: string;
  vehicleCount: number;
}

export interface LogEntry {
  id: string;
  time: string;
  level: 'info' | 'success' | 'warn' | 'error';
  message: string;
}

export interface TimelineStage {
  id: string;
  label: string;
  status: 'completed' | 'active' | 'pending';
  startedAt: string;
  duration: string;
}

export interface Segment {
  id: string;
  range: string;
  duration: string;
  vehicles: number;
  status: 'completed' | 'processing' | 'pending';
}
