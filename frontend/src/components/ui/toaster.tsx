import { Toaster as SonnerToaster } from 'sonner';
import { useTheme } from '@/app/theme-context';

export function Toaster() {
  const { resolvedTheme } = useTheme();

  return (
    <SonnerToaster
      theme={resolvedTheme}
      position="bottom-right"
      closeButton
      duration={4000}
      toastOptions={{
        classNames: {
          toast:
            '!rounded-[var(--radius-card)] !border !border-line !bg-elevated !text-fg !shadow-pop !font-sans !text-[13px]',
          description: '!text-fg-muted',
          actionButton: '!bg-primary !text-primary-fg',
          cancelButton: '!bg-surface-muted !text-fg-muted',
          closeButton: '!border-line !bg-elevated !text-fg-muted',
        },
      }}
    />
  );
}
