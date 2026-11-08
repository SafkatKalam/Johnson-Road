import { createClient } from '@supabase/supabase-js';
import { captureCallbackNotice } from '@/lib/authNotice';

// Must run before the client below is created: the client may clear an email link's error from the address.
captureCallbackNotice();

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

// A password-reset link signs the person in with a special "recovery" session. Only that kind of session may
// set a new password without typing the old one, so it is remembered (for this tab) until the password is changed.
const RECOVERY_KEY = 'jr-recovery';

function readRecoveryFlag(): boolean {
  try {
    return sessionStorage.getItem(RECOVERY_KEY) === '1';
  } catch {
    return false;
  }
}

let recovery = readRecoveryFlag();

export function isRecoverySession(): boolean {
  return recovery;
}

export function clearRecoverySession(): void {
  recovery = false;
  try {
    sessionStorage.removeItem(RECOVERY_KEY);
  } catch {
    /* storage can be blocked */
  }
}

supabase.auth.onAuthStateChange((event) => {
  if (event === 'PASSWORD_RECOVERY') {
    recovery = true;
    try {
      sessionStorage.setItem(RECOVERY_KEY, '1');
    } catch {
      /* storage can be blocked */
    }
  } else if (event === 'SIGNED_OUT') {
    clearRecoverySession();
  }
});

export type OrganizationPlan = 'starter' | 'pro' | 'enterprise';
export type MemberRole = 'owner' | 'admin' | 'researcher';
export type MemberStatus = 'active' | 'invited' | 'suspended';
export type ProjectStatus = 'completed' | 'processing' | 'queued' | 'failed';

export interface Profile {
  id: string;
  full_name: string;
  avatar_url: string | null;
  role: MemberRole;
  organization_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  plan: OrganizationPlan;
  owner_id: string;
  created_at: string;
  updated_at: string;
}

export interface OrgMember {
  id: string;
  organization_id: string;
  user_id: string | null;
  role: MemberRole;
  invited_email: string | null;
  status: MemberStatus;
  created_at: string;
  profile?: Profile | null;
}

export interface ProjectRow {
  id: string;
  organization_id: string;
  name: string;
  location: string;
  status: ProjectStatus;
  duration: number;
  video_count: number;
  vehicle_count: number;
  avg_flow: number;
  peak_hour: string;
  confidence: number;
  storage_used: number;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface VideoRow {
  id: string;
  project_id: string;
  name: string;
  resolution: string;
  camera: string;
  duration_hours: number;
  fps: number;
  file_size_gb: number;
  status: 'analyzed' | 'processing' | 'queued';
  created_at: string;
}

export interface ReportRow {
  id: string;
  project_id: string;
  title: string;
  type: string;
  vehicle_count: number;
  generated_at: string;
}

export interface JobRow {
  id: string;
  project_id: string;
  progress: number;
  eta: string;
  stage: string;
  status: 'running' | 'queued' | 'completed' | 'failed' | 'cancelled';
  fps: number;
  gpu_usage: number;
  cpu_usage: number;
  memory_usage: number;
  priority: 'high' | 'normal' | 'low';
  started_at: string;
}

export interface NotificationRow {
  id: string;
  user_id: string;
  type: string;
  title: string;
  detail: string;
  link: string | null;
  read: boolean;
  created_at: string;
}

export interface ApiKeyRow {
  id: string;
  organization_id: string;
  name: string;
  key_prefix: string;
  permissions: string[];
  last_used_at: string | null;
  created_by: string;
  created_at: string;
}

export interface InvoiceRow {
  id: string;
  organization_id: string;
  amount: number;
  description: string;
  status: 'paid' | 'pending' | 'failed';
  invoice_date: string;
  created_at: string;
}

export interface UserSessionRow {
  id: string;
  user_id: string;
  device: string;
  browser: string;
  ip_address: string;
  location: string;
  last_active: string;
  created_at: string;
}
