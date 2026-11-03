import { Moon, Sun } from 'lucide-react';
import { useTheme } from '@/app/theme-context';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * Two modes only - light and dark - flipped with a single click. The current
 * state is shown by the icon; the choice persists in localStorage.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, toggleTheme } = useTheme();

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      className={cn(className)}
      onClick={toggleTheme}
      aria-label={resolvedTheme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {resolvedTheme === 'dark' ? <Sun /> : <Moon />}
    </Button>
  );
}
