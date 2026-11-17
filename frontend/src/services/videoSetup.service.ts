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

const MESSAGES: Record<string, string> = {
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

  // --- jobs (F28) ---
  /** The same key on a retry returns the same job instead of queueing a second one. */
  async queueJob(projectId: string, uploadId: string, idempotencyKey: string): Promise<{ job: { id: string; status: string }; replayed: boolean }> {
    return (await api.post(`/projects/${projectId}/uploads/${uploadId}/jobs`, {}, { headers: { 'Idempotency-Key': idempotencyKey } })).data;
  },
};
