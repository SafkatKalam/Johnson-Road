import type { ProjectStatus } from '@/lib/mockData';

export function statusTone(status: ProjectStatus): 'brand' | 'sky' | 'amber' | 'rose' | 'slate' {
  switch (status) {
    case 'completed':
      return 'brand';
    case 'processing':
      return 'sky';
    case 'queued':
      return 'amber';
    case 'failed':
      return 'rose';
    default:
      return 'slate';
  }
}

export function statusLabel(status: ProjectStatus): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export function thumbnailGradient(thumb: string): string {
  const map: Record<string, string> = {
    amber: 'from-warn-500/30 to-err-500/10',
    sky: 'from-accent-500/30 to-accent-600/10',
    emerald: 'from-brand-500/30 to-brand-600/10',
    violet: 'from-violet-500/30 to-violet-600/10',
    rose: 'from-err-500/30 to-rose-600/10',
    slate: 'from-ink-600/30 to-ink-700/10',
  };
  return map[thumb] ?? map.slate;
}
