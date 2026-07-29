export interface UploadFile {
  id: string;
  name: string;
  size: number;
  duration: string;
  resolution: string;
  fps: number;
  progress: number;
  status: 'uploading' | 'queued' | 'done' | 'error';
}
