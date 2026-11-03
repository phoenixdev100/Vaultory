import {
  Activity,
  Clock,
  FolderTree,
  LayoutDashboard,
  type LucideIcon,
  Share2,
  ShieldCheck,
  ShieldEllipsis,
  Star,
  Trash2,
  Vault,
} from 'lucide-react';

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  /** Also highlight the item for nested paths like /vault/:id. */
  matchPrefix?: boolean;
}

export const PRIMARY_NAV: NavItem[] = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/vault', label: 'Vault', icon: Vault, matchPrefix: true },
  { to: '/folders', label: 'Folders', icon: FolderTree },
  { to: '/favorites', label: 'Favorites', icon: Star },
  { to: '/recent', label: 'Recent', icon: Clock },
  { to: '/sharing', label: 'Sharing', icon: Share2 },
  { to: '/audit', label: 'Health', icon: ShieldCheck },
  { to: '/security', label: 'Security', icon: ShieldEllipsis },
  { to: '/activity', label: 'Activity', icon: Activity },
  { to: '/trash', label: 'Trash', icon: Trash2 },
];
