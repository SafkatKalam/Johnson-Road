import { locationSuggestions } from '@/lib/mockData';
import type { UploadFile } from '@/types/upload';

export type { UploadFile };

const initialUploadFiles: UploadFile[] = [
  { id: 'f1', name: 'cam_01_northbound_20260725.mp4', size: 9_660_000_000, duration: '8h 00m', resolution: '1920×1080', fps: 30, progress: 100, status: 'done' },
  { id: 'f2', name: 'cam_02_southbound_20260725.mp4', size: 9_840_000_000, duration: '8h 00m', resolution: '1920×1080', fps: 30, progress: 100, status: 'done' },
];

export const UploadService = {
  async getInitialUploadFiles(): Promise<UploadFile[]> {
    return Promise.resolve(initialUploadFiles);
  },
  async getUploadLocationSuggestions(): Promise<string[]> {
    return Promise.resolve(locationSuggestions);
  },
};

export { initialUploadFiles, locationSuggestions };
