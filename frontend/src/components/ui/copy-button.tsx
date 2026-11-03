import { Check, Copy } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Button, type ButtonProps } from '@/components/ui/button';
import { Tooltip } from '@/components/ui/tooltip';
import { copyToClipboard } from '@/lib/utils';

interface CopyButtonProps extends Omit<ButtonProps, 'onClick' | 'children'> {
  /** The exact value to copy. Never logged, never rendered. */
  value: string;
  /** Human label for the toast, e.g. "Password". */
  label?: string;
  withText?: boolean;
}

export function CopyButton({
  value,
  label = 'Value',
  withText = false,
  variant = 'ghost',
  size = 'icon-sm',
  ...props
}: CopyButtonProps) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  async function handleCopy() {
    const ok = await copyToClipboard(value);
    if (!ok) {
      toast.error('Your browser blocked clipboard access', {
        description: 'Reveal the value and copy it manually instead.',
      });
      return;
    }

    setCopied(true);
    toast.success(`${label} copied to clipboard`);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <Tooltip content={`Copy ${label.toLowerCase()}`} disabled={withText}>
      <Button
        type="button"
        variant={variant}
        size={withText ? 'sm' : size}
        onClick={handleCopy}
        aria-label={`Copy ${label.toLowerCase()}`}
        {...props}
      >
        {copied ? <Check className="text-success" /> : <Copy />}
        {withText ? <span>{copied ? 'Copied' : 'Copy'}</span> : null}
      </Button>
    </Tooltip>
  );
}
