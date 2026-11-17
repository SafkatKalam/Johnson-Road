import { isAxiosError } from 'axios';
import { api } from '@/services/api';

/**
 * Real client for projects, uploaded videos, and analysis settings (F20 to F26).
 * The screens still use sample data from project.service.ts; they are moved over in F27.
 */

export interface ProjectItem {
  id: string;
  name: string;
  location: string;
  description: string;
  ownerUserId: string | null;
  archived: boolean;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  uploadCount: number;
  jobCount: number;
  reportCount: number;
}

export interface Page<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

export interface VideoMetadata {
  cameraId: string | null;
  roadName: string | null;
  recordedDate: string | null;
  recordedStartTime: string | null;
  recordedEndTime: string | null;
  weather: string | null;
  notes: string | null;
}

export interface VideoItem {
  id: string;
  projectId: string;
  name: string;
  status: 'ready';
  sizeBytes: number;
  durationSeconds: number;
  widthPx: number;
  heightPx: number;
  frameRate: number;
  frameCount: number;
  hasPreview: boolean;
  metadata: VideoMetadata;
  jobCount: number;
  createdAt: string;
}

export interface Point { x: number; y: number }
export interface LineShape { id?: string; name: string; start: Point; end: Point; direction: 'forward' | 'backward' | 'both' }
export interface ZoneShape { id?: string; name: string; points: Point[] }

export interface ConfigurationInput {
  model?: string;
  tracker?: 'bytetrack' | 'botsort' | 'sort';
  confidenceThreshold?: number;
  iouThreshold?: number;
  frameSkip?: number;
  batchSize?: number;
  classes?: string[];
  bucketSeconds?: number;
  generateReport?: boolean;
  annotatedOutput?: boolean;
  lines: LineShape[];
  zones: ZoneShape[];
}

export interface SavedConfiguration extends Required<Omit<ConfigurationInput, 'lines' | 'zones'>> {
  id: string;
  uploadId: string;
  version: number;
  locked: boolean;
  createdAt: string;
  lines: LineShape[];
  zones: ZoneShape[];
}

export interface ConfigurationOptions {
  models: string[];
  trackers: string[];
  classes: string[];
  defaults: Record<string, unknown>;
  limits: { maxLines: number; maxZones: number; maxZonePoints: number };
}

export interface MethodTotals { total: number; byClass: Record<string, number>; byDirection: Record<string, number> }
export interface AnalyticsSummary {
  isEstimate: boolean;
  basis: string;
  videosAnalysed: number;
  lastCompletedAt: string | null;
  lineCrossing: MethodTotals;
  zonePresence: MethodTotals;
  byProject: Record<string, { lineCrossing: number; zonePresence: number }>;
  jobsByStatus: Record<string, number>;
}

export interface ReportItem {
  id: string;
  projectId: string;
  jobId: string;
  title: string;
  type: 'summary' | 'peak';
  method: 'line_crossing' | 'zone_presence';
  version: number;
  vehiclesCounted: number;
  generatedAt: string;
  isEstimate: boolean;
}

export interface ReportDetail extends ReportItem {
  options: { classes: string[] | null; directions: string[] | null };
  bucketSeconds: number;
  analysisVersion: string;
  totalsByClass: Record<string, number>;
  totalsByDirection: Record<string, number>;
  series: { index: number; startSeconds: number; count: number }[];
  peak: { index: number; startSeconds: number; count: number } | null;
  rows: { index: number; startSeconds: number; class: string; direction: string; line: string | null; zone: string | null; count: number }[];
}

export interface ActivityItem {
  id: number;
  at: string;
  action: string;
  outcome: string;
  entityType: string | null;
  entityId: string | null;
  actor: string;
}

export type JobStatusName ='queued' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface JobItem {
  id: string;
  projectId: string;
  uploadId: string;
  status: JobStatusName;
  stage: string;
  progressPercent: number;
  framesDone: number;
  /** null when the total is not known: then no percentage or time estimate is shown. */
  framesTotal: number | null;
  processingFps: number | null;
  attempt: number;
  retryable: boolean;
  error: { code: string; message: string; diagnosticId: string } | null;
  cancelRequested: boolean;
  queuePosition: number | null;
  device: string | null;
  model: string | null;
  videoName: string | null;
  projectName: string | null;
  queuedAt: string;
  startedAt: string | null;
  finishedAt: string | null;
}

export interface JobResults {
  isEstimate: boolean;
  method: 'line_crossing' | 'zone_presence';
  vehiclesCounted: number;
  totalsByClass: Record<string, number>;
  bucketSeconds: number;
  framesProcessed: number;
  provenance: { model: string; modelSha256: string; codeVersion: string; device: string | null };
  artifacts: { id: string; kind: string; contentType: string; sizeBytes: number }[];
}

const MESSAGES: Record<string, string> = {
  job_not_found: 'That job was not found.',
  job_not_cancellable: 'This job has already finished, so it cannot be cancelled.',
  job_not_retryable: 'Only a failed job that can be retried may be retried.',
  job_not_finished: 'Only a finished job can be run again.',
  source_removed: 'The video file has been removed, so it cannot be processed.',
  configuration_missing: 'Save the analysis settings, with at least one counting line or zone, first.',
  result_not_available: 'This job has no result yet.',
  too_many_jobs: 'Your organisation already has the maximum number of jobs waiting or running. Wait for some to finish.',
  too_many_versions: 'This report already has the maximum number of versions.',
  storage_quota_exceeded: "Your organisation's video storage is full. Remove videos you no longer need.",
  frame_count_mismatch: 'The video is much longer than its file header says, so it was stopped.',
  pdf_not_available: 'PDF export is not available yet. Use the CSV export.',
  project_not_found: 'That project was not found.',
  project_name_taken: 'A project with that name already exists.',
  project_archived: 'This project is archived. Restore it before changing it.',
  upload_not_found: 'That video was not found.',
  upload_in_progress: 'This upload is already being received.',
  upload_in_use: 'This video has been queued or analysed, so it cannot be removed.',
  metadata_locked: 'This video has been analysed, so only its notes can be changed.',
  invalid_time_range: 'The end time must be after the start time.',
  unsupported_video_type: 'Only .mp4, .mkv and .avi videos are accepted.',
  not_a_video: 'That file is not the kind of video its name says it is.',
  unreadable_video: 'That video could not be read. It may be damaged or use an unsupported format.',
  empty_video: 'That video has no frames.',
  video_too_long: 'That video is longer than the allowed duration.',
  frame_too_large: "That video's picture size is larger than allowed.",
  file_too_large: 'That video is larger than the allowed size.',
  storage_unavailable: 'Video storage is not available right now. Please try again.',
  unsupported_model: 'That model is not available.',
  forbidden: 'You are not allowed to do this.',
};

/** Plain words for a failed call. The server's own message is used for anything not listed (it never holds paths or traces). */
export function describeSetupError(error: unknown): string {
  if (isAxiosError(error)) {
    const body = error.response?.data?.error;
    if (body?.code && MESSAGES[body.code]) return MESSAGES[body.code];
    if (error.response && error.response.status < 500 && typeof body?.message === 'string') return body.message;
    if (error.response?.status && error.response.status >= 500) {
      return `Something went wrong on our side.${body?.diagnosticId ? ` Quote ${body.diagnosticId} if you ask for help.` : ''}`;
    }
    if (!error.response) return 'Could not reach the server. Check your connection and try again.';
  }
  return 'Something went wrong. Please try again.';
}

export const VideoSetupService = {
  // --- projects (F20) ---
  async listProjects(params: { q?: string; state?: 'active' | 'archived' | 'all'; limit?: number; offset?: number } = {}): Promise<Page<ProjectItem>> {
    return (await api.get('/projects', { params })).data;
  },
  async getProject(id: string): Promise<ProjectItem> {
    return (await api.get(`/projects/${id}`)).data.project;
  },
  async createProject(body: { name: string; location?: string; description?: string }): Promise<ProjectItem> {
    return (await api.post('/projects', body)).data.project;
  },
  async updateProject(id: string, body: Partial<{ name: string; location: string; description: string }>): Promise<ProjectItem> {
    return (await api.patch(`/projects/${id}`, body)).data.project;
  },
  async archiveProject(id: string): Promise<ProjectItem> {
    return (await api.post(`/projects/${id}/archive`)).data.project;
  },
  async restoreProject(id: string): Promise<ProjectItem> {
    return (await api.post(`/projects/${id}/restore`)).data.project;
  },
  async locationSuggestions(prefix?: string): Promise<string[]> {
    return (await api.get('/projects/location-suggestions', { params: prefix ? { prefix } : {} })).data.suggestions;
  },

  // --- videos (F22, F23) ---
  async listVideos(projectId: string, params: { limit?: number; offset?: number } = {}): Promise<Page<VideoItem>> {
    return (await api.get(`/projects/${projectId}/uploads`, { params })).data;
  },
  /** One video. `idempotencyKey` makes a retry after a lost response return the same video instead of a second copy. */
  async uploadVideo(
    projectId: string,
    file: File,
    metadata: Partial<Record<keyof VideoMetadata, string>> = {},
    idempotencyKey?: string,
    onProgress?: (percent: number) => void,
  ): Promise<{ upload: VideoItem; replayed: boolean }> {
    const form = new FormData();
    form.append('file', file);
    for (const [k, v] of Object.entries(metadata)) if (v) form.append(k, v);
    const res = await api.post(`/projects/${projectId}/uploads`, form, {
      headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {},
      timeout: 0, // a large video can take longer than the default
      onUploadProgress: (e) => { if (onProgress && e.total) onProgress(Math.round((e.loaded / e.total) * 100)); },
    });
    return res.data;
  },
  async updateVideo(projectId: string, uploadId: string, body: Partial<Record<keyof VideoMetadata, string | null>>): Promise<VideoItem> {
    return (await api.patch(`/projects/${projectId}/uploads/${uploadId}`, body)).data.upload;
  },
  async removeVideo(projectId: string, uploadId: string): Promise<void> {
    await api.delete(`/projects/${projectId}/uploads/${uploadId}`);
  },
  /** The preview is protected, so it is fetched with the sign-in header and shown from a temporary local URL. */
  async previewObjectUrl(projectId: string, uploadId: string): Promise<string> {
    const res = await api.get(`/projects/${projectId}/uploads/${uploadId}/preview`, { responseType: 'blob' });
    return URL.createObjectURL(res.data); // the caller revokes it with URL.revokeObjectURL when done
  },

  // --- analysis settings, lines and zones (F24 to F26) ---
  async configurationOptions(projectId: string, uploadId: string): Promise<ConfigurationOptions> {
    return (await api.get(`/projects/${projectId}/uploads/${uploadId}/configuration/options`)).data;
  },
  async getConfiguration(projectId: string, uploadId: string): Promise<SavedConfiguration | null> {
    return (await api.get(`/projects/${projectId}/uploads/${uploadId}/configuration`)).data.configuration;
  },
  async saveConfiguration(projectId: string, uploadId: string, body: ConfigurationInput): Promise<SavedConfiguration> {
    return (await api.put(`/projects/${projectId}/uploads/${uploadId}/configuration`, body)).data.configuration;
  },

  // --- analytics, reports, activity (F37, F38, F40) ---
  async analyticsSummary(params: { projectId?: string; from?: string; to?: string } = {}): Promise<AnalyticsSummary> {
    return (await api.get('/analytics/summary', { params })).data;
  },
  async listReports(params: { projectId?: string; limit?: number; offset?: number } = {}): Promise<Page<ReportItem>> {
    return (await api.get('/reports', { params })).data;
  },
  async getReport(id: string): Promise<ReportDetail> {
    return (await api.get(`/reports/${id}`)).data.report;
  },
  async createReport(jobId: string, body: { type?: 'summary' | 'peak'; classes?: string[]; directions?: string[]; newVersion?: boolean } = {}): Promise<{ report: ReportDetail; existing: boolean }> {
    return (await api.post(`/jobs/${jobId}/reports`, body)).data;
  },
  async downloadReportPdf(id: string, fileName: string): Promise<void> {
    return VideoSetupService.downloadReportFile(id, 'pdf', fileName);
  },
  async downloadReportCsv(id: string, fileName: string): Promise<void> {
    return VideoSetupService.downloadReportFile(id, 'csv', fileName);
  },
  /** Downloads an export with the sign-in header and saves it through a temporary local link. */
  async downloadReportFile(id: string, format: 'csv' | 'pdf', fileName: string): Promise<void> {
    const res = await api.get(`/reports/${id}/export.${format}`, { responseType: 'blob' });
    const url = URL.createObjectURL(res.data);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  },
  async projectActivity(projectId: string, before?: number): Promise<{ items: ActivityItem[]; nextBefore: number | null }> {
    return (await api.get(`/projects/${projectId}/activity`, { params: before ? { before } : {} })).data;
  },

  // --- jobs (F28, F35, F36) ---
  async listJobs(params: { status?: JobStatusName; projectId?: string; limit?: number; offset?: number } = {}): Promise<Page<JobItem>> {
    return (await api.get('/jobs', { params })).data;
  },
  async cancelJob(id: string): Promise<JobItem> {
    return (await api.post(`/jobs/${id}/cancel`)).data.job;
  },
  async retryJob(id: string): Promise<JobItem> {
    return (await api.post(`/jobs/${id}/retry`)).data.job;
  },
  /** A fresh key per click: a network retry of the same click returns the same new job, never two. */
  async rerunJob(id: string, idempotencyKey: string = (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `r-${Date.now()}-${Math.random().toString(36).slice(2)}`)): Promise<JobItem> {
    return (await api.post(`/jobs/${id}/rerun`, {}, { headers: { 'Idempotency-Key': idempotencyKey } })).data.job;
  },
  async jobResults(id: string): Promise<JobResults> {
    return (await api.get(`/jobs/${id}/results`)).data;
  },
  /** The annotated video is protected, so it is fetched with the sign-in header into a temporary local address. */
  async annotatedVideoUrl(id: string): Promise<string> {
    const res = await api.get(`/jobs/${id}/annotated-video`, { responseType: 'blob', timeout: 0 });
    return URL.createObjectURL(res.data);
  },
  /** The same key on a retry returns the same job instead of queueing a second one. */
  async queueJob(projectId: string, uploadId: string, idempotencyKey: string): Promise<{ job: { id: string; status: string }; replayed: boolean }> {
    return (await api.post(`/projects/${projectId}/uploads/${uploadId}/jobs`, {}, { headers: { 'Idempotency-Key': idempotencyKey } })).data;
  },
};
