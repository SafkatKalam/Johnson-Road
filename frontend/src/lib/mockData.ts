// Mock data for Johnson Road — AI traffic analytics platform.
// All data is synthetic and used for frontend demonstration only.

export type ProjectStatus = 'completed' | 'processing' | 'queued' | 'failed';

export interface Project {
  id: string;
  name: string;
  location: string;
  status: ProjectStatus;
  duration: number; // hours of footage
  videoCount: number;
  vehicleCount: number;
  avgFlow: number; // vehicles/hour
  peakHour: string;
  createdAt: string;
  thumbnail: string;
  confidence: number;
  updatedAt?: string;
  reportCount?: number;
  aiJobCount?: number;
  storageUsed?: number; // GB
}

export const projects: Project[] = [
  {
    id: 'prj_8f2a',
    name: 'M5 Junction 14 — Northbound',
    location: 'Bristol, UK',
    status: 'completed',
    duration: 18,
    videoCount: 3,
    vehicleCount: 84230,
    avgFlow: 4679,
    peakHour: '08:00',
    createdAt: '2026-07-21T09:14:00Z',
    updatedAt: '2026-07-23T16:30:00Z',
    thumbnail: 'amber',
    confidence: 0.97,
    reportCount: 4,
    aiJobCount: 3,
    storageUsed: 38.4,
  },
  {
    id: 'prj_1c9b',
    name: 'A406 North Circular — East',
    location: 'London, UK',
    status: 'processing',
    duration: 24,
    videoCount: 4,
    vehicleCount: 112400,
    avgFlow: 4683,
    peakHour: '17:30',
    createdAt: '2026-07-25T13:22:00Z',
    updatedAt: '2026-07-29T14:22:00Z',
    thumbnail: 'sky',
    confidence: 0.94,
    reportCount: 1,
    aiJobCount: 1,
    storageUsed: 45.2,
  },
  {
    id: 'prj_4d7e',
    name: 'Parramatta Road — Camperdown',
    location: 'Sydney, AU',
    status: 'completed',
    duration: 12,
    videoCount: 2,
    vehicleCount: 51280,
    avgFlow: 4273,
    peakHour: '08:15',
    createdAt: '2026-07-18T07:00:00Z',
    updatedAt: '2026-07-20T11:15:00Z',
    thumbnail: 'emerald',
    confidence: 0.96,
    reportCount: 3,
    aiJobCount: 2,
    storageUsed: 22.8,
  },
  {
    id: 'prj_9a1f',
    name: 'Marine Drive — Bandra',
    location: 'Mumbai, IN',
    status: 'queued',
    duration: 16,
    videoCount: 3,
    vehicleCount: 0,
    avgFlow: 0,
    peakHour: '—',
    createdAt: '2026-07-28T16:40:00Z',
    updatedAt: '2026-07-28T16:40:00Z',
    thumbnail: 'violet',
    confidence: 0,
    reportCount: 0,
    aiJobCount: 0,
    storageUsed: 0,
  },
  {
    id: 'prj_6b2c',
    name: 'Sheikh Zayed Road — Sector 3',
    location: 'Dubai, UAE',
    status: 'completed',
    duration: 24,
    videoCount: 4,
    vehicleCount: 138900,
    avgFlow: 5787,
    peakHour: '18:00',
    createdAt: '2026-07-12T11:30:00Z',
    updatedAt: '2026-07-15T09:45:00Z',
    thumbnail: 'rose',
    confidence: 0.98,
    reportCount: 5,
    aiJobCount: 4,
    storageUsed: 58.6,
  },
  {
    id: 'prj_3e8d',
    name: 'Highway 101 — Mountain View',
    location: 'California, US',
    status: 'failed',
    duration: 8,
    videoCount: 1,
    vehicleCount: 0,
    avgFlow: 0,
    peakHour: '—',
    createdAt: '2026-07-27T22:10:00Z',
    updatedAt: '2026-07-27T22:15:00Z',
    thumbnail: 'slate',
    confidence: 0,
    reportCount: 0,
    aiJobCount: 1,
    storageUsed: 8.1,
  },
];

export interface ProcessingJob {
  id: string;
  projectName: string;
  progress: number;
  stage: string;
  eta: string;
  status: 'processing' | 'queued' | 'completed';
  fps: number;
  currentFrame: string;
  vehicleCount: number;
}

export const processingJobs: ProcessingJob[] = [
  {
    id: 'job_1c9b',
    projectName: 'A406 North Circular — East',
    progress: 67,
    stage: 'Object Tracking',
    eta: '1h 24m',
    status: 'processing',
    fps: 38,
    currentFrame: '14:22:08',
    vehicleCount: 75240,
  },
  {
    id: 'job_9a1f',
    projectName: 'Marine Drive — Bandra',
    progress: 0,
    stage: 'Queued',
    eta: '—',
    status: 'queued',
    fps: 0,
    currentFrame: '00:00:00',
    vehicleCount: 0,
  },
  {
    id: 'job_8f2a',
    projectName: 'M5 Junction 14 — Northbound',
    progress: 100,
    stage: 'Report Generation',
    eta: 'Done',
    status: 'completed',
    fps: 0,
    currentFrame: '18:00:00',
    vehicleCount: 84230,
  },
];

export interface LogEntry {
  id: string;
  time: string;
  level: 'info' | 'success' | 'warn' | 'error';
  message: string;
}

export const processingLogs: LogEntry[] = [
  { id: '1', time: '14:22:41', level: 'info', message: 'Loaded frame 51984/77840 — segment 3/4' },
  { id: '2', time: '14:22:39', level: 'success', message: 'Tracking 42 vehicles in current frame' },
  { id: '3', time: '14:22:37', level: 'info', message: 'YOLOv8x inference: 38.2 FPS' },
  { id: '4', time: '14:22:34', level: 'warn', message: 'Low-light frame at 14:21:58 — confidence dipped to 0.71' },
  { id: '5', time: '14:22:31', level: 'success', message: 'Segment 2 complete — 28,140 vehicles detected' },
  { id: '6', time: '14:22:28', level: 'info', message: 'ByteTrack ID assignment — 318 active tracks' },
  { id: '7', time: '14:22:24', level: 'info', message: 'GPU utilization 94% — NVIDIA A100' },
  { id: '8', time: '14:22:21', level: 'success', message: 'Vehicle classification: car 71%, truck 12%, bus 9%, motorcycle 8%' },
  { id: '9', time: '14:22:18', level: 'info', message: 'Writing results to prj_1c9b/results.parquet' },
  { id: '10', time: '14:22:14', level: 'warn', message: 'Occlusion detected at frame 51960 — tracker re-acquired' },
  { id: '11', time: '14:22:11', level: 'info', message: 'Optical flow estimation stable — 0.91 quality' },
  { id: '12', time: '14:22:08', level: 'success', message: 'Batch of 256 frames processed in 6.7s' },
];

export interface TimelineStage {
  id: string;
  label: string;
  status: 'completed' | 'active' | 'pending';
  startedAt: string;
  duration: string;
}

export const timelineStages: TimelineStage[] = [
  { id: '1', label: 'Upload & Validation', status: 'completed', startedAt: '13:22:00', duration: '4m 12s' },
  { id: '2', label: 'Preprocessing', status: 'completed', startedAt: '13:26:12', duration: '8m 40s' },
  { id: '3', label: 'Object Detection (YOLOv8x)', status: 'completed', startedAt: '13:34:52', duration: '22m 18s' },
  { id: '4', label: 'Object Tracking (ByteTrack)', status: 'active', startedAt: '13:57:10', duration: 'in progress' },
  { id: '5', label: 'Vehicle Classification', status: 'pending', startedAt: '—', duration: '—' },
  { id: '6', label: 'Statistics Aggregation', status: 'pending', startedAt: '—', duration: '—' },
  { id: '7', label: 'Report Generation', status: 'pending', startedAt: '—', duration: '—' },
];

export interface Segment {
  id: string;
  range: string;
  duration: string;
  vehicles: number;
  status: 'completed' | 'processing' | 'pending';
}

export const segments: Segment[] = [
  { id: '1', range: '00:00 — 06:00', duration: '6h', vehicles: 19840, status: 'completed' },
  { id: '2', range: '06:00 — 12:00', duration: '6h', vehicles: 28140, status: 'completed' },
  { id: '3', range: '12:00 — 18:00', duration: '6h', vehicles: 27260, status: 'processing' },
  { id: '4', range: '18:00 — 24:00', duration: '6h', vehicles: 0, status: 'pending' },
];

// Dashboard KPIs
export const dashboardKpis = {
  totalVehicles: 387490,
  totalVehiclesDelta: 12.4,
  activeJobs: 1,
  activeJobsDelta: 0,
  completedReports: 14,
  completedReportsDelta: 8.3,
  avgConfidence: 96.2,
  avgConfidenceDelta: 1.1,
  hoursAnalyzed: 158,
  hoursAnalyzedDelta: 22.7,
};

// Traffic volume by hour (24h) — composite of analyzed roads
export const trafficVolumeByHour = [
  { hour: '00', vehicles: 412, flow: 'low' },
  { hour: '01', vehicles: 287, flow: 'low' },
  { hour: '02', vehicles: 201, flow: 'low' },
  { hour: '03', vehicles: 168, flow: 'low' },
  { hour: '04', vehicles: 224, flow: 'low' },
  { hour: '05', vehicles: 538, flow: 'moderate' },
  { hour: '06', vehicles: 1284, flow: 'moderate' },
  { hour: '07', vehicles: 2890, flow: 'high' },
  { hour: '08', vehicles: 3762, flow: 'peak' },
  { hour: '09', vehicles: 2981, flow: 'high' },
  { hour: '10', vehicles: 2240, flow: 'moderate' },
  { hour: '11', vehicles: 2468, flow: 'moderate' },
  { hour: '12', vehicles: 2612, flow: 'moderate' },
  { hour: '13', vehicles: 2390, flow: 'moderate' },
  { hour: '14', vehicles: 2534, flow: 'moderate' },
  { hour: '15', vehicles: 2812, flow: 'high' },
  { hour: '16', vehicles: 3190, flow: 'high' },
  { hour: '17', vehicles: 3648, flow: 'peak' },
  { hour: '18', vehicles: 3412, flow: 'peak' },
  { hour: '19', vehicles: 2680, flow: 'high' },
  { hour: '20', vehicles: 1924, flow: 'moderate' },
  { hour: '21', vehicles: 1412, flow: 'moderate' },
  { hour: '22', vehicles: 884, flow: 'low' },
  { hour: '23', vehicles: 542, flow: 'low' },
];

export const vehicleClassBreakdown = [
  { name: 'Cars', value: 271243, color: '#10b981' },
  { name: 'Trucks', value: 46498, color: '#38bdf8' },
  { name: 'Buses', value: 34974, color: '#fbbf24' },
  { name: 'Motorcycles', value: 34775, color: '#f87171' },
];

export const weeklyTrafficTrend = [
  { day: 'Mon', vehicles: 51200, peak: 3762 },
  { day: 'Tue', vehicles: 54810, peak: 3890 },
  { day: 'Wed', vehicles: 49230, peak: 3540 },
  { day: 'Thu', vehicles: 58640, peak: 4120 },
  { day: 'Fri', vehicles: 64280, peak: 4680 },
  { day: 'Sat', vehicles: 41900, peak: 2890 },
  { day: 'Sun', vehicles: 32140, peak: 2120 },
];

export const aiInsights = [
  {
    id: '1',
    title: 'Morning peak shifted 15 min earlier',
    detail: 'A406 peak congestion moved from 08:30 to 08:15 this week. Consider retiming signals at the Camden interchange.',
    severity: 'info' as const,
    icon: 'trending',
  },
  {
    id: '2',
    title: 'Heavy vehicle share rising on M5',
    detail: 'Truck proportion up 3.4% vs last analysis. HGV flow now 14.2% of northbound traffic at J14.',
    severity: 'warn' as const,
    icon: 'truck',
  },
  {
    id: '3',
    title: 'Anomaly-free window detected',
    detail: 'Parramatta Road showed 6.2 hours of steady free-flow between 10:00 and 16:15 with no incidents.',
    severity: 'success' as const,
    icon: 'check',
  },
];

export const aiTimeline = [
  { id: '1', time: '14:22', label: 'Detection model pass 3/4', status: 'active' as const },
  { id: '2', time: '14:18', label: 'Tracking initialized on segment 3', status: 'completed' as const },
  { id: '3', time: '13:57', label: 'Preprocessing pipeline finished', status: 'completed' as const },
  { id: '4', time: '13:26', label: 'Video ingest validated', status: 'completed' as const },
  { id: '5', time: '13:22', label: 'Upload received — 4 files, 38.4 GB', status: 'completed' as const },
];

export const quickActions = [
  { id: 'upload', label: 'Upload Footage', icon: 'upload', to: '/upload' },
  { id: 'report', label: 'Generate Report', icon: 'file', to: '/reports' },
  { id: 'projects', label: 'Browse Projects', icon: 'folder', to: '/projects' },
  { id: 'processing', label: 'View Processing', icon: 'cpu', to: '/processing' },
];

export const recentActivity = [
  { id: '1', projectName: 'A406 North Circular — East', action: 'started processing', time: '12m ago', status: 'processing' as ProjectStatus, projectId: 'prj_1c9b' },
  { id: '2', projectName: 'M5 Junction 14 — Northbound', action: 'report generated', time: '2h ago', status: 'completed' as ProjectStatus, projectId: 'prj_8f2a' },
  { id: '3', projectName: 'Marine Drive — Bandra', action: 'queued for analysis', time: '4h ago', status: 'queued' as ProjectStatus, projectId: 'prj_9a1f' },
  { id: '4', projectName: 'Highway 101 — Mountain View', action: 'failed — corrupted segment', time: '6h ago', status: 'failed' as ProjectStatus, projectId: 'prj_3e8d' },
  { id: '5', projectName: 'Sheikh Zayed Road — Sector 3', action: 'report generated', time: '1d ago', status: 'completed' as ProjectStatus, projectId: 'prj_6b2c' },
];

// ============ USER PROFILE ============
export const userProfile = {
  name: 'Shadiatun Alam',
  initials: 'SA',
  email: 'shadiatun.alam@johnsonroad.io',
  organization: 'Greater London Transport Authority',
  role: 'Senior Traffic Analyst',
  subscription: 'Enterprise',
  plan: 'Enterprise',
  avatarGradient: 'from-brand-400 to-accent-500',
};

// ============ NOTIFICATIONS ============
export interface AppNotification {
  id: string;
  type: 'completed' | 'failed' | 'report' | 'started' | 'warning';
  title: string;
  detail: string;
  time: string;
  to: string;
}

export const notifications: AppNotification[] = [
  { id: 'n1', type: 'started', title: 'Processing started', detail: 'A406 North Circular — East began analysis', time: '12m ago', to: '/processing' },
  { id: 'n2', type: 'report', title: 'Report generated', detail: 'M5 Junction 14 — Northbound report is ready', time: '2h ago', to: '/reports' },
  { id: 'n3', type: 'warning', title: 'Storage warning', detail: 'Compute quota at 68% — 1,360 / 2,000 GPU-hours used', time: '5h ago', to: '/billing' },
  { id: 'n4', type: 'failed', title: 'Upload failed', detail: 'Highway 101 — Mountain View segment corrupted', time: '6h ago', to: '/projects' },
  { id: 'n5', type: 'completed', title: 'Analysis completed', detail: 'Sheikh Zayed Road — Sector 3 finished 24h analysis', time: '1d ago', to: '/reports' },
  { id: 'n6', type: 'report', title: 'Report generated', detail: 'Parramatta Road — Camperdown weekly summary ready', time: '2d ago', to: '/reports' },
];

// ============ GLOBAL SEARCH INDEX ============
export interface SearchResult {
  id: string;
  label: string;
  category: 'Projects' | 'Reports' | 'Processing' | 'Uploads' | 'Analytics' | 'Settings';
  to: string;
  icon: string;
}

export const searchIndex: SearchResult[] = [
  { id: 's1', label: 'M5 Junction 14 — Northbound', category: 'Projects', to: '/projects/prj_8f2a', icon: 'folder' },
  { id: 's2', label: 'A406 North Circular — East', category: 'Projects', to: '/projects/prj_1c9b', icon: 'folder' },
  { id: 's3', label: 'Parramatta Road — Camperdown', category: 'Projects', to: '/projects/prj_4d7e', icon: 'folder' },
  { id: 's4', label: 'Marine Drive — Bandra', category: 'Projects', to: '/projects/prj_9a1f', icon: 'folder' },
  { id: 's5', label: 'Sheikh Zayed Road — Sector 3', category: 'Projects', to: '/projects/prj_6b2c', icon: 'folder' },
  { id: 's6', label: 'Highway 101 — Mountain View', category: 'Projects', to: '/projects/prj_3e8d', icon: 'folder' },
  { id: 's7', label: 'M5 Junction 14 — Weekly Summary', category: 'Reports', to: '/reports', icon: 'file' },
  { id: 's8', label: 'Sheikh Zayed — Peak Hour Report', category: 'Reports', to: '/reports', icon: 'file' },
  { id: 's9', label: 'Parramatta Road — Daily Report', category: 'Reports', to: '/reports', icon: 'file' },
  { id: 's10', label: 'A406 Processing Job', category: 'Processing', to: '/processing', icon: 'cpu' },
  { id: 's11', label: 'Marine Drive — Queued', category: 'Processing', to: '/processing', icon: 'cpu' },
  { id: 's12', label: 'Upload Center', category: 'Uploads', to: '/upload', icon: 'upload' },
  { id: 's13', label: 'Traffic Volume Analytics', category: 'Analytics', to: '/reports', icon: 'chart' },
  { id: 's14', label: 'Vehicle Classification Analytics', category: 'Analytics', to: '/reports', icon: 'chart' },
  { id: 's15', label: 'Peak Hour Analysis', category: 'Analytics', to: '/reports', icon: 'chart' },
  { id: 's16', label: 'Billing & Subscription', category: 'Settings', to: '/billing', icon: 'settings' },
  { id: 's16b', label: 'My Profile', category: 'Settings', to: '/profile', icon: 'settings' },
  { id: 's16c', label: 'Organization', category: 'Settings', to: '/organization', icon: 'settings' },
  { id: 's17', label: 'Support & Documentation', category: 'Settings', to: '/support', icon: 'settings' },
  { id: 's18', label: 'Job Queue', category: 'Processing', to: '/job-queue', icon: 'cpu' },
];

// ============ JOB QUEUE ============
export type JobStatus = 'running' | 'queued' | 'completed' | 'failed' | 'cancelled';
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

export const jobQueue: JobQueueItem[] = [
  { id: 'job_1c9b', projectName: 'A406 North Circular — East', projectId: 'prj_1c9b', progress: 67, eta: '1h 24m', status: 'running', priority: 'high', stage: 'Object Tracking', fps: 38, gpu: 94, cpu: 72, memory: 68, startedAt: '13:22' },
  { id: 'job_9a1f', projectName: 'Marine Drive — Bandra', projectId: 'prj_9a1f', progress: 0, eta: '4h 30m', status: 'queued', priority: 'normal', stage: 'Queued', fps: 0, gpu: 0, cpu: 0, memory: 0, queuePosition: 1, startedAt: '—' },
  { id: 'job_8f2a', projectName: 'M5 Junction 14 — Northbound', projectId: 'prj_8f2a', progress: 100, eta: 'Done', status: 'completed', priority: 'normal', stage: 'Completed', fps: 0, gpu: 0, cpu: 0, memory: 0, startedAt: '09:14' },
  { id: 'job_4d7e', projectName: 'Parramatta Road — Camperdown', projectId: 'prj_4d7e', progress: 100, eta: 'Done', status: 'completed', priority: 'normal', stage: 'Completed', fps: 0, gpu: 0, cpu: 0, memory: 0, startedAt: '07:00' },
  { id: 'job_3e8d', projectName: 'Highway 101 — Mountain View', projectId: 'prj_3e8d', progress: 34, eta: '—', status: 'failed', priority: 'high', stage: 'Corrupted segment', fps: 0, gpu: 0, cpu: 0, memory: 0, startedAt: '22:10' },
  { id: 'job_6b2c', projectName: 'Sheikh Zayed Road — Sector 3', projectId: 'prj_6b2c', progress: 100, eta: 'Done', status: 'completed', priority: 'low', stage: 'Completed', fps: 0, gpu: 0, cpu: 0, memory: 0, startedAt: '11:30' },
  { id: 'job_x1', projectName: 'A406 Segment Re-run', projectId: 'prj_1c9b', progress: 0, eta: '—', status: 'cancelled', priority: 'low', stage: 'Cancelled by user', fps: 0, gpu: 0, cpu: 0, memory: 0, startedAt: '10:05' },
];

// ============ SUBSCRIPTION ============
export interface Invoice {
  id: string;
  date: string;
  amount: number;
  description: string;
  status: 'paid' | 'pending' | 'failed';
}

export const subscriptionData = {
  plan: 'Enterprise',
  price: 2499,
  cycle: 'monthly',
  renewalDate: '2026-08-25',
  storageUsed: 682,
  storageTotal: 1000,
  projectsUsed: 6,
  projectsTotal: 50,
  processingHoursUsed: 1360,
  processingHoursTotal: 2000,
};

export const invoices: Invoice[] = [
  { id: 'inv_001', date: '2026-07-25', amount: 2499, description: 'Enterprise plan — July 2026', status: 'paid' },
  { id: 'inv_002', date: '2026-06-25', amount: 2499, description: 'Enterprise plan — June 2026', status: 'paid' },
  { id: 'inv_003', date: '2026-05-25', amount: 1999, description: 'Pro plan — May 2026 (upgraded)', status: 'paid' },
  { id: 'inv_004', date: '2026-04-25', amount: 1999, description: 'Pro plan — April 2026', status: 'paid' },
  { id: 'inv_005', date: '2026-03-25', amount: 1999, description: 'Pro plan — March 2026', status: 'paid' },
  { id: 'inv_006', date: '2026-08-25', amount: 2499, description: 'Enterprise plan — August 2026', status: 'pending' },
];

// ============ SUPPORT ============
export interface FaqItem {
  id: string;
  question: string;
  answer: string;
}

export const faqs: FaqItem[] = [
  { id: 'f1', question: 'What video formats are supported?', answer: 'Johnson Road supports MP4, MKV, and AVI formats. We recommend H.264 or H.265 encoded video for optimal processing speed. Maximum file size per video is 12GB.' },
  { id: 'f2', question: 'How long does processing take?', answer: 'Processing time depends on video length and resolution. As a rule of thumb, 1 hour of 1080p footage takes approximately 15-20 minutes on our GPU infrastructure. 4K footage takes roughly 2.5x longer.' },
  { id: 'f3', question: 'What detection models are available?', answer: 'We offer YOLOv8x (highest accuracy), YOLOv8l (balanced), and YOLOv8m (fastest). For tracking, you can choose ByteTrack, BoT-SORT, or DeepSORT.' },
  { id: 'f4', question: 'Can I export reports as PDF or Excel?', answer: 'Yes. Every completed analysis can be exported as PDF, Excel (XLSX), or CSV. You can also share reports via a secure link or print directly from the Reports page.' },
  { id: 'f5', question: 'How is my data stored and protected?', answer: 'All uploaded videos and generated reports are encrypted at rest and in transit. Data is stored in your designated region and is never shared with third parties. You can delete data at any time.' },
  { id: 'f6', question: 'What are the plan limits?', answer: 'Enterprise: 1TB storage, 2,000 GPU-hours/month, 50 projects. Pro: 500GB storage, 800 GPU-hours/month, 20 projects. Starter: 100GB storage, 200 GPU-hours/month, 5 projects.' },
];

export const releaseNotes = [
  { id: 'r1', version: 'v3.4.0', date: '2026-07-28', changes: ['Added interactive detection zone drawing', 'New count-line overlay with direction arrows', 'Live frame preview during processing', 'Job queue with priority management'] },
  { id: 'r2', version: 'v3.3.2', date: '2026-07-15', changes: ['Improved vehicle classification accuracy by 2.1%', 'Fixed memory leak on long 24h videos', 'Added CSV export for hourly breakdown'] },
  { id: 'r3', version: 'v3.3.0', date: '2026-07-01', changes: ['Redesigned dashboard with AI insights', 'New notification system', 'Weekly traffic trend charts'] },
];

// ============ SEGMENT DETAIL ============
export interface SegmentDetail {
  id: string;
  range: string;
  vehicleCount: number;
  avgSpeed: number;
  peakDensity: number;
  events: string[];
}

export const segmentDetails: Record<string, SegmentDetail> = {
  '1': { id: '1', range: '00:00 — 06:00', vehicleCount: 19840, avgSpeed: 62, peakDensity: 4.2, events: ['Low overnight flow', 'Minor congestion at 02:15 due to roadworks', 'Clear conditions 04:00–06:00'] },
  '2': { id: '2', range: '06:00 — 12:00', vehicleCount: 28140, avgSpeed: 48, peakDensity: 7.8, events: ['Morning rush 07:30–09:15', 'Peak density 8.1 veh/min at 08:00', 'School zone effect at 08:45'] },
  '3': { id: '3', range: '12:00 — 18:00', vehicleCount: 27260, avgSpeed: 52, peakDensity: 6.4, events: ['Lunchtime dip 12:30–13:30', 'Afternoon buildup from 15:00', 'Processing in progress — partial data'] },
  '4': { id: '4', range: '18:00 — 24:00', vehicleCount: 0, avgSpeed: 0, peakDensity: 0, events: ['Pending analysis'] },
};

// ============ AI INSIGHT DETAIL ============
export interface InsightDetail {
  trend: string;
  reason: string;
  recommendation: string;
}

export const insightDetails: Record<string, InsightDetail> = {
  '1': {
    trend: 'Morning peak has been gradually shifting earlier over the past 4 weeks, moving from 08:30 to 08:15.',
    reason: 'Post-pandemic hybrid work schedules have compressed morning commute windows. More commuters are leaving 15-20 minutes earlier to avoid the 08:30 rush.',
    recommendation: 'Retiming traffic signals at the Camden interchange to favor northbound flow from 08:00-08:20 could reduce average delay by an estimated 12%.',
  },
  '2': {
    trend: 'Heavy goods vehicle (HGV) proportion on M5 northbound at J14 has risen 3.4% over the last analysis period.',
    reason: 'A new logistics depot opened 8km south of J14 in June, adding approximately 180 HGV trips per day through this junction.',
    recommendation: 'Consider designating a dedicated HGV lane or adjusting speed limits for mixed-traffic safety. Monitor truck routing via A38 as an alternative.',
  },
  '3': {
    trend: 'A 6.2-hour continuous free-flow window was detected on Parramatta Road with zero congestion events.',
    reason: 'School holiday period reduced baseline traffic by approximately 18%. Weather conditions were clear with no incidents or roadworks reported.',
    recommendation: 'Use this period as a baseline for optimal flow capacity. Signal timing from this window can serve as a reference configuration for off-peak periods.',
  },
};

// ============ LOCATION AUTOCOMPLETE ============
export const locationSuggestions = [
  'London, UK',
  'Bristol, UK',
  'Manchester, UK',
  'Birmingham, UK',
  'Sydney, AU',
  'Melbourne, AU',
  'Mumbai, IN',
  'Delhi, IN',
  'Dubai, UAE',
  'Abu Dhabi, UAE',
  'California, US',
  'New York, US',
  'Toronto, CA',
  'Singapore, SG',
  'Tokyo, JP',
];

// ============ PROJECT DETAIL DATA ============
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

export const projectVideos: Record<string, ProjectVideo[]> = {
  prj_8f2a: [
    { id: 'v1', name: 'cam_01_northbound_20260721.mp4', duration: '6h 00m', resolution: '1920×1080', fps: 30, size: '8.2 GB', status: 'analyzed', camera: 'CAM-NB-01' },
    { id: 'v2', name: 'cam_02_southbound_20260721.mp4', duration: '6h 00m', resolution: '1920×1080', fps: 30, size: '8.1 GB', status: 'analyzed', camera: 'CAM-SB-01' },
    { id: 'v3', name: 'cam_03_junction_20260721.mp4', duration: '6h 00m', resolution: '1920×1080', fps: 25, size: '7.8 GB', status: 'analyzed', camera: 'CAM-JCT-01' },
  ],
  prj_1c9b: [
    { id: 'v1', name: 'cam_01_northbound_20260725.mp4', duration: '6h 00m', resolution: '1920×1080', fps: 30, size: '9.2 GB', status: 'analyzed', camera: 'CAM-NB-03' },
    { id: 'v2', name: 'cam_02_southbound_20260725.mp4', duration: '6h 00m', resolution: '1920×1080', fps: 30, size: '9.4 GB', status: 'analyzed', camera: 'CAM-SB-03' },
    { id: 'v3', name: 'cam_03_junction_20260725.mp4', duration: '6h 00m', resolution: '1920×1080', fps: 30, size: '9.0 GB', status: 'processing', camera: 'CAM-JCT-03' },
    { id: 'v4', name: 'cam_04_overview_20260725.mp4', duration: '6h 00m', resolution: '3840×2160', fps: 25, size: '11.2 GB', status: 'queued', camera: 'CAM-OV-03' },
  ],
  prj_4d7e: [
    { id: 'v1', name: 'cam_01_camperdown_20260718.mp4', duration: '6h 00m', resolution: '1920×1080', fps: 30, size: '7.5 GB', status: 'analyzed', camera: 'CAM-PR-01' },
    { id: 'v2', name: 'cam_02_broadway_20260718.mp4', duration: '6h 00m', resolution: '1920×1080', fps: 30, size: '7.3 GB', status: 'analyzed', camera: 'CAM-PR-02' },
  ],
  prj_9a1f: [
    { id: 'v1', name: 'cam_01_bandra_20260728.mp4', duration: '6h 00m', resolution: '1920×1080', fps: 25, size: '6.8 GB', status: 'queued', camera: 'CAM-MD-01' },
  ],
  prj_6b2c: [
    { id: 'v1', name: 'cam_01_szb_n_20260712.mp4', duration: '6h 00m', resolution: '1920×1080', fps: 30, size: '8.6 GB', status: 'analyzed', camera: 'CAM-SZ-N' },
    { id: 'v2', name: 'cam_02_szb_s_20260712.mp4', duration: '6h 00m', resolution: '1920×1080', fps: 30, size: '8.4 GB', status: 'analyzed', camera: 'CAM-SZ-S' },
    { id: 'v3', name: 'cam_03_szb_jct_20260712.mp4', duration: '6h 00m', resolution: '3840×2160', fps: 25, size: '12.1 GB', status: 'analyzed', camera: 'CAM-SZ-J' },
    { id: 'v4', name: 'cam_04_szb_ov_20260712.mp4', duration: '6h 00m', resolution: '1920×1080', fps: 30, size: '8.2 GB', status: 'analyzed', camera: 'CAM-SZ-OV' },
  ],
  prj_3e8d: [
    { id: 'v1', name: 'cam_01_mtview_20260727.mp4', duration: '8h 00m', resolution: '1920×1080', fps: 30, size: '8.1 GB', status: 'queued', camera: 'CAM-MV-01' },
  ],
};

export const projectReportsList: Record<string, ProjectReport[]> = {
  prj_8f2a: [
    { id: 'r1', title: 'Weekly Summary — Week 30', date: '2026-07-23', type: 'weekly', vehicleCount: 84230 },
    { id: 'r2', title: 'Peak Hour Analysis', date: '2026-07-22', type: 'peak', vehicleCount: 3762 },
    { id: 'r3', title: 'Daily Report — Jul 21', date: '2026-07-21', type: 'daily', vehicleCount: 12840 },
    { id: 'r4', title: 'Analysis Summary', date: '2026-07-21', type: 'summary', vehicleCount: 84230 },
  ],
  prj_1c9b: [
    { id: 'r1', title: 'Partial Analysis Summary', date: '2026-07-29', type: 'summary', vehicleCount: 75240 },
  ],
  prj_4d7e: [
    { id: 'r1', title: 'Weekly Summary — Week 29', date: '2026-07-20', type: 'weekly', vehicleCount: 51280 },
    { id: 'r2', title: 'Peak Hour Analysis', date: '2026-07-19', type: 'peak', vehicleCount: 3290 },
    { id: 'r3', title: 'Daily Report — Jul 18', date: '2026-07-18', type: 'daily', vehicleCount: 8420 },
  ],
  prj_6b2c: [
    { id: 'r1', title: 'Weekly Summary — Week 28', date: '2026-07-15', type: 'weekly', vehicleCount: 138900 },
    { id: 'r2', title: 'Peak Hour Analysis', date: '2026-07-14', type: 'peak', vehicleCount: 4680 },
    { id: 'r3', title: 'Daily Report — Jul 13', date: '2026-07-13', type: 'daily', vehicleCount: 22140 },
    { id: 'r4', title: 'HGV Distribution Report', date: '2026-07-12', type: 'summary', vehicleCount: 19800 },
    { id: 'r5', title: '24h Full Analysis', date: '2026-07-12', type: 'summary', vehicleCount: 138900 },
  ],
  prj_9a1f: [],
  prj_3e8d: [],
};

// Traffic data per project for the dashboard chart switcher
export const trafficByProject: Record<string, Array<{ hour: string; vehicles: number; flow: string }>> = {
  prj_8f2a: Array.from({ length: 24 }, (_, h) => {
    const base = [300, 200, 150, 120, 180, 400, 900, 2100, 2800, 2200, 1700, 1800, 1900, 1750, 1850, 2100, 2400, 2700, 2500, 2000, 1500, 1100, 700, 450];
    const flows = ['low', 'low', 'low', 'low', 'low', 'moderate', 'moderate', 'high', 'peak', 'high', 'moderate', 'moderate', 'moderate', 'moderate', 'moderate', 'high', 'high', 'peak', 'peak', 'high', 'moderate', 'moderate', 'low', 'low'];
    return { hour: String(h).padStart(2, '0'), vehicles: base[h], flow: flows[h] };
  }),
  prj_1c9b: Array.from({ length: 24 }, (_, h) => {
    const base = [450, 320, 220, 180, 250, 600, 1400, 3200, 4100, 3200, 2400, 2700, 2800, 2600, 2750, 3100, 3500, 4000, 3750, 2900, 2100, 1550, 970, 600];
    const flows = ['low', 'low', 'low', 'low', 'low', 'moderate', 'moderate', 'high', 'peak', 'high', 'moderate', 'moderate', 'moderate', 'moderate', 'moderate', 'high', 'high', 'peak', 'peak', 'high', 'moderate', 'moderate', 'low', 'low'];
    return { hour: String(h).padStart(2, '0'), vehicles: base[h], flow: flows[h] };
  }),
  prj_4d7e: Array.from({ length: 24 }, (_, h) => {
    const base = [280, 190, 140, 100, 160, 380, 850, 1950, 2600, 2000, 1550, 1650, 1750, 1600, 1700, 1950, 2250, 2500, 2300, 1850, 1400, 1050, 650, 420];
    const flows = ['low', 'low', 'low', 'low', 'low', 'moderate', 'moderate', 'high', 'peak', 'high', 'moderate', 'moderate', 'moderate', 'moderate', 'moderate', 'high', 'high', 'peak', 'peak', 'high', 'moderate', 'moderate', 'low', 'low'];
    return { hour: String(h).padStart(2, '0'), vehicles: base[h], flow: flows[h] };
  }),
  prj_6b2c: Array.from({ length: 24 }, (_, h) => {
    const base = [520, 360, 250, 200, 280, 680, 1600, 3600, 4600, 3600, 2700, 3000, 3100, 2900, 3050, 3400, 3900, 4400, 4100, 3200, 2300, 1700, 1060, 660];
    const flows = ['low', 'low', 'low', 'low', 'low', 'moderate', 'moderate', 'high', 'peak', 'high', 'moderate', 'moderate', 'moderate', 'moderate', 'moderate', 'high', 'high', 'peak', 'peak', 'high', 'moderate', 'moderate', 'low', 'low'];
    return { hour: String(h).padStart(2, '0'), vehicles: base[h], flow: flows[h] };
  }),
};
