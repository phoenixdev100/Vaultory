import * as DialogPrimitive from '@radix-ui/react-dialog';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { X } from 'lucide-react';
import { type ComponentProps, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

interface DialogContentProps {
  title: string;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
  /** Hide the title visually while keeping it for screen readers. */
  hideTitle?: boolean;
}

/**
 * Animated dialog. Radix handles focus trapping, escape and aria wiring;
 * Framer Motion adds a short, reduced-motion-aware entrance.
 */
export function DialogContent({
  title,
  description,
  children,
  footer,
  className,
  hideTitle = false,
}: DialogContentProps) {
  const reduceMotion = useReducedMotion();
  const duration = reduceMotion ? 0 : 0.18;

  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay asChild>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration }}
          className="fixed inset-0 z-50 bg-[#0b0b14]/55 backdrop-blur-[2px]"
        />
      </DialogPrimitive.Overlay>

      <DialogPrimitive.Content asChild>
        <motion.div
          initial={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.97, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.98, y: 4 }}
          transition={{ duration, ease: [0.16, 1, 0.3, 1] }}
          className={cn(
            'fixed top-1/2 left-1/2 z-50 flex max-h-[92dvh] w-[calc(100vw-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-[var(--radius-card)] border border-line bg-elevated shadow-pop',
            className,
          )}
        >
          <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
            <div className="flex flex-col gap-1">
              <DialogPrimitive.Title className={cn('text-base font-semibold text-fg', hideTitle && 'sr-only')}>
                {title}
              </DialogPrimitive.Title>
              {description ? (
                <DialogPrimitive.Description className="text-[13px] leading-5 text-fg-muted">
                  {description}
                </DialogPrimitive.Description>
              ) : null}
            </div>
            <DialogPrimitive.Close
              className="-mr-1 -mt-1 rounded-md p-1.5 text-fg-subtle transition-colors hover:bg-surface-muted hover:text-fg"
              aria-label="Close"
            >
              <X className="size-4" />
            </DialogPrimitive.Close>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>

          {footer ? (
            <div className="flex items-center justify-end gap-2 border-t border-line bg-surface/60 px-5 py-3.5">
              {footer}
            </div>
          ) : null}
        </motion.div>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

/** Wrapper that keeps exit animations working with Radix's unmount behaviour. */
export function AnimatedDialog({
  open,
  onOpenChange,
  children,
  ...props
}: ComponentProps<typeof DialogPrimitive.Root>) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange} {...props}>
      <AnimatePresence>{open ? children : null}</AnimatePresence>
    </DialogPrimitive.Root>
  );
}

interface SheetContentProps {
  title: string;
  children: ReactNode;
  className?: string;
}

/**
 * Left edge slide-in panel (the mobile nav drawer). Same Radix dialog plumbing
 * as DialogContent - focus trap, escape, aria - but enters from the side like
 * the desktop sidebar instead of appearing as a centred popup.
 */
export function SheetContent({ title, children, className }: SheetContentProps) {
  const reduceMotion = useReducedMotion();
  const duration = reduceMotion ? 0 : 0.22;

  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay asChild>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration }}
          className="fixed inset-0 z-50 bg-[#0b0b14]/55 backdrop-blur-[2px]"
        />
      </DialogPrimitive.Overlay>

      <DialogPrimitive.Content asChild>
        <motion.div
          initial={reduceMotion ? { opacity: 0 } : { x: '-100%' }}
          animate={reduceMotion ? { opacity: 1 } : { x: 0 }}
          exit={reduceMotion ? { opacity: 0 } : { x: '-100%' }}
          transition={{ duration, ease: [0.16, 1, 0.3, 1] }}
          className={cn(
            'fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col overflow-hidden border-r border-line bg-sidebar shadow-pop',
            className,
          )}
        >
          <DialogPrimitive.Title className="sr-only">{title}</DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">{title}</DialogPrimitive.Description>

          <DialogPrimitive.Close
            className="absolute top-3.5 right-3.5 rounded-md p-1.5 text-fg-subtle transition-colors hover:bg-surface-muted hover:text-fg"
            aria-label="Close navigation"
          >
            <X className="size-4" />
          </DialogPrimitive.Close>

          <div className="min-h-0 flex-1 overflow-y-auto p-4">{children}</div>
        </motion.div>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}
