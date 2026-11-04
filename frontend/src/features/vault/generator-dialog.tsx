import { RefreshCw, Wand2 } from 'lucide-react';
import { useCallback, useState } from 'react';
import { Button } from '@/components/ui/button';
import { CopyButton } from '@/components/ui/copy-button';
import { AnimatedDialog, DialogContent } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { PasswordStrength } from '@/components/ui/password-input';
import { Slider, Switch } from '@/components/ui/toggle';
import {
  DEFAULT_PASSWORD_OPTIONS,
  generatePassword,
  MAX_PASSWORD_LENGTH,
  MIN_PASSWORD_LENGTH,
  type PasswordOptions,
} from '@/lib/crypto/generator';

const TOGGLES: Array<{ key: keyof Omit<PasswordOptions, 'length'>; label: string; hint: string }> = [
  { key: 'uppercase', label: 'Uppercase', hint: 'A-Z' },
  { key: 'lowercase', label: 'Lowercase', hint: 'a-z' },
  { key: 'numbers', label: 'Numbers', hint: '0-9' },
  { key: 'symbols', label: 'Symbols', hint: '!@#$' },
  { key: 'excludeAmbiguous', label: 'Avoid look-alikes', hint: 'No I l 1 O 0' },
];

interface GeneratorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called when the user accepts a password; nothing is sent anywhere else. */
  onUse?: (password: string) => void;
}

export function GeneratorDialog({ open, onOpenChange, onUse }: GeneratorDialogProps) {
  const [options, setOptions] = useState<PasswordOptions>(DEFAULT_PASSWORD_OPTIONS);
  // The dialog only mounts while open, so the initializer runs on every open -
  // the previous password never lingers in state.
  const [password, setPassword] = useState(() => {
    try {
      return generatePassword(DEFAULT_PASSWORD_OPTIONS);
    } catch {
      return '';
    }
  });
  const [error, setError] = useState<string | null>(null);

  const regenerate = useCallback((next: PasswordOptions) => {
    try {
      setPassword(generatePassword(next));
      setError(null);
    } catch (cause) {
      setPassword('');
      setError(cause instanceof Error ? cause.message : 'Could not generate a password');
    }
  }, []);

  function update<K extends keyof PasswordOptions>(key: K, value: PasswordOptions[K]) {
    const next = { ...options, [key]: value };
    setOptions(next);
    regenerate(next);
  }

  return (
    <AnimatedDialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title="Password generator"
        description="Generated locally with crypto.getRandomValues - nothing leaves this device until you save it."
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => onOpenChange(false)}>
              Close
            </Button>
            {onUse ? (
              <Button
                size="sm"
                disabled={password === ''}
                onClick={() => {
                  onUse(password);
                  onOpenChange(false);
                }}
              >
                <Wand2 />
                Use this password
              </Button>
            ) : null}
          </>
        }
      >
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-1.5 rounded-[var(--radius-control)] border border-line bg-surface-muted/60 p-2.5">
              <p className="min-w-0 flex-1 font-mono text-[13px] leading-5 break-all text-fg">
                {password || '-'}
              </p>
              <div className="flex shrink-0 items-center gap-0.5">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => regenerate(options)}
                  aria-label="Generate a new password"
                >
                  <RefreshCw />
                </Button>
                <CopyButton value={password} label="Password" />
              </div>
            </div>
            {error ? <p className="text-xs font-medium text-danger">{error}</p> : null}
            <PasswordStrength password={password} />
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="generator-length">Length</Label>
              <span className="font-mono text-[13px] text-fg-muted">{options.length}</span>
            </div>
            <Slider
              id="generator-length"
              min={MIN_PASSWORD_LENGTH}
              max={MAX_PASSWORD_LENGTH}
              step={1}
              value={[options.length]}
              onValueChange={([value]) => update('length', value ?? options.length)}
            />
          </div>

          <div className="flex flex-col divide-y divide-line overflow-hidden rounded-[var(--radius-control)] border border-line">
            {TOGGLES.map((toggle) => (
              <label
                key={toggle.key}
                className="flex cursor-pointer items-center justify-between gap-3 px-3 py-2.5"
                htmlFor={`generator-${toggle.key}`}
              >
                <span className="flex flex-col">
                  <span className="text-[13px] font-medium text-fg">{toggle.label}</span>
                  <span className="font-mono text-[11px] text-fg-subtle">{toggle.hint}</span>
                </span>
                <Switch
                  id={`generator-${toggle.key}`}
                  checked={options[toggle.key]}
                  onCheckedChange={(checked) => update(toggle.key, checked)}
                />
              </label>
            ))}
          </div>
        </div>
      </DialogContent>
    </AnimatedDialog>
  );
}
