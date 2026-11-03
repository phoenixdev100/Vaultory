import { LogOut, Settings, ShieldEllipsis } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useCurrentUser } from '@/features/auth/auth-context';
import { useLogout } from '@/features/auth/use-auth-mutations';
import { initialsOf } from '@/lib/utils';

export function UserMenu() {
  const user = useCurrentUser();
  const navigate = useNavigate();
  const logout = useLogout();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" className="rounded-full" aria-label="Account menu">
          <span className="flex size-7 items-center justify-center rounded-full bg-primary-soft text-[11px] font-semibold text-primary">
            {initialsOf(user.name, user.email)}
          </span>
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent className="min-w-60">
        <div className="flex items-center gap-2.5 px-2.5 py-2">
          <span className="flex size-9 items-center justify-center rounded-full bg-primary-soft text-xs font-semibold text-primary">
            {initialsOf(user.name, user.email)}
          </span>
          <div className="min-w-0">
            <p className="truncate text-[13px] font-medium text-fg">{user.name ?? 'Vaultory user'}</p>
            <p className="truncate text-xs text-fg-muted">{user.email}</p>
          </div>
        </div>

        <DropdownMenuSeparator />

        <DropdownMenuItem onSelect={() => void navigate('/security')}>
          <ShieldEllipsis />
          Security
        </DropdownMenuItem>

        <DropdownMenuItem onSelect={() => void navigate('/settings')}>
          <Settings />
          Settings
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          destructive
          onSelect={() => {
            logout.mutate(undefined, {
              onSettled: () => {
                toast.success('Signed out');
                void navigate('/login', { replace: true });
              },
            });
          }}
        >
          <LogOut />
          Sign out
        </DropdownMenuItem>

        <DropdownMenuSeparator />
        <DropdownMenuItem asChild disabled>
          <p className="px-2.5 py-1.5 text-[11px] leading-4 text-fg-subtle">
            Encrypted in your browser with AES-256-GCM
          </p>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
