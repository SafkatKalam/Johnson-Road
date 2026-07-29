import { jobQueue, processingJobs, processingLogs, segments, timelineStages } from '@/lib/mockData';
import type { JobPriority, JobQueueItem, JobStatus, LogEntry, ProcessingJob, Segment, TimelineStage } from '@/types/processing';

export type { JobPriority, JobQueueItem, JobStatus, LogEntry, ProcessingJob, Segment, TimelineStage };

export const ProcessingService = {
  async getProcessingJobs(): Promise<ProcessingJob[]> {
    return Promise.resolve(processingJobs);
  },
  async getProcessingLogs(): Promise<LogEntry[]> {
    return Promise.resolve(processingLogs);
  },
  async getTimelineStages(): Promise<TimelineStage[]> {
    return Promise.resolve(timelineStages);
  },
  async getSegments(): Promise<Segment[]> {
    return Promise.resolve(segments);
  },
  async getJobQueue(): Promise<JobQueueItem[]> {
    return Promise.resolve(jobQueue);
  },
};

export const jobQueueList = jobQueue as JobQueueItem[];
export const processingJobList = processingJobs as ProcessingJob[];
export const processingLogList = processingLogs as LogEntry[];
export const segmentList = segments as Segment[];
export const timelineStageList = timelineStages as TimelineStage[];

export { jobQueueList as jobQueue, processingJobList as processingJobs, processingLogList as processingLogs, segmentList as segments, timelineStageList as timelineStages };
