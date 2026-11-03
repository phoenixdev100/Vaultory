import * as AlertDialogPrimitive from '@radix-ui/react-alert-dialog';
import { motion, useReducedMotion } from 'framer-motion';
import { AlertTriangle } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  children?: ReactNode;
}

/** Keyboard-accessible confirmation used for every destructive action. */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false,
  loading = false,
  onConfirm,
  children,
}: ConfirmDialogProps) {
  const reduceMotion = useReducedMotion();
  const duration = reduceMotion ? 0 : 0.16;

  return (
    <AlertDialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialogPrimitive.Portal>
        <AlertDialogPrimitive.Overlay className="fixed inset-0 z-50 bg-[#0b0b14]/55 backdrop-blur-[2px]" />
        <AlertDialogPrimitive.Content asChild>
          <motion.div
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.97, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration, ease: [0.16, 1, 0.3, 1] }}
            className="fixed top-1/2 left-1/2 z-50 w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-[var(--radius-card)] border border-line bg-elevated p-5 shadow-pop"
          >
            <div className="flex gap-3.5">
              <div
                className={cn(
                  'flex size-9 shrink-0 items-center justify-center rounded-full',
                  destructive ? 'bg-danger-soft text-danger' : 'bg-primary-soft text-primary',
                )}
              >
                <AlertTriangle className="size-[18px]" />
              </div>
              <div className="flex min-w-0 flex-col gap-1.5">
                <AlertDialogPrimitive.Title className="text-base font-semibold text-fg">
                  {title}
                </AlertDialogPrimitive.Title>
                <AlertDialogPrimitive.Description className="text-[13px] leading-5 text-fg-muted">
                  {description}
                </AlertDialogPrimitive.Description>
              </div>
            </div>

            {children ? <div className="mt-4">{children}</div> : null}

            <div className="mt-5 flex items-center justify-end gap-2">
              <AlertDialogPrimitive.Cancel asChild>
                <Button variant="secondary" size="sm" disabled={loading}>
                  {cancelLabel}
                </Button>
              </AlertDialogPrimitive.Cancel>
              <Button
                variant={destructive ? 'danger' : 'primary'}
                size="sm"
                loading={loading}
                onClick={onConfirm}
              >
                {confirmLabel}
              </Button>
            </div>
          </motion.div>
        </AlertDialogPrimitive.Content>
      </AlertDialogPrimitive.Portal>
    </AlertDialogPrimitive.Root>
  );
}
