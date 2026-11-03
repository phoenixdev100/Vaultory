import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

const baseField =
  'w-full rounded-[var(--radius-control)] border border-line bg-surface text-sm text-fg shadow-subtle transition-[border-color,box-shadow] placeholder:text-fg-subtle outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring/25 disabled:cursor-not-allowed disabled:opacity-60 aria-invalid:border-danger aria-invalid:focus-visible:ring-danger/25';

export function Input({ className, type = 'text', ...props }: ComponentProps<'input'>) {
  return <input type={type} className={cn(baseField, 'h-9 px-3 py-1.5', className)} {...props} />;
}

export function Textarea({ className, rows = 4, ...props }: ComponentProps<'textarea'>) {
  return <textarea rows={rows} className={cn(baseField, 'min-h-20 resize-y px-3 py-2', className)} {...props} />;
}

export function FieldHint({ className, ...props }: ComponentProps<'p'>) {
  return <p className={cn('text-xs text-fg-subtle', className)} {...props} />;
}

export function FieldError({ className, children, ...props }: ComponentProps<'p'>) {
  if (!children) return null;
  return (
    <p role="alert" className={cn('text-xs font-medium text-danger', className)} {...props}>
      {children}
    </p>
  );
}
