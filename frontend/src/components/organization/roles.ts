import { Crown, Shield, FlaskConical } from 'lucide-react';
import type { OrgRole } from '@/services/organization.service';

export const roleConfig: Record<OrgRole, { icon: typeof Crown; tone: 'brand' | 'sky' | 'slate'; label: string }> = {
  owner: { icon: Crown, tone: 'brand', label: 'Owner' },
  admin: { icon: Shield, tone: 'sky', label: 'Administrator' },
  researcher: { icon: FlaskConical, tone: 'slate', label: 'Researcher' },
};
