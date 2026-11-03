import { useRef } from 'react';
import { cn } from '@/lib/utils';

interface OtpInputProps {
  /** Current digits (0..length characters). */
  value: string;
  onChange: (value: string) => void;
  length?: number;
  autoFocus?: boolean;
  disabled?: boolean;
  /** Base id - boxes are `${id}-0` … `${id}-5` so tests can target them. */
  id?: string;
  invalid?: boolean;
}

/**
 * Split-box one-time-code input - the enterprise pattern: one digit per box,
 * type moves right, backspace moves left, pasting fills the row. Keeps a plain
 * string in `value` so forms treat it like a single field.
 */
export function OtpInput({
  value,
  onChange,
  length = 6,
  autoFocus = false,
  disabled = false,
  id,
  invalid = false,
}: OtpInputProps) {
  const boxes = useRef<Array<HTMLInputElement | null>>([]);

  const digits = Array.from({ length }, (_, index) => value[index] ?? '');

  function focusBox(index: number) {
    const clamped = Math.max(0, Math.min(length - 1, index));
    boxes.current[clamped]?.focus();
    boxes.current[clamped]?.select();
  }

  function write(next: string, focusIndex: number) {
    onChange(next.slice(0, length));
    if (focusIndex >= 0) focusBox(focusIndex);
  }

  function handleChange(index: number, raw: string) {
    const cleaned = raw.replace(/\D/g, '');
    if (!cleaned) {
      // Cleared the box.
      write(value.slice(0, index) + value.slice(index + 1), -1);
      return;
    }
    // Typing or an IME burst: take every digit entered, place from this index.
    const next = (value.slice(0, index) + cleaned + value.slice(index + cleaned.length)).slice(0, length);
    write(next, index + cleaned.length >= length ? length - 1 : index + cleaned.length);
  }

  function handleKeyDown(index: number, event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Backspace') {
      if (digits[index]) {
        write(value.slice(0, index) + value.slice(index + 1), -1);
      } else if (index > 0) {
        write(value.slice(0, index - 1) + value.slice(index), index - 1);
      }
      event.preventDefault();
    } else if (event.key === 'ArrowLeft' && index > 0) {
      focusBox(index - 1);
      event.preventDefault();
    } else if (event.key === 'ArrowRight' && index < length - 1) {
      focusBox(index + 1);
      event.preventDefault();
    }
  }

  function handlePaste(index: number, event: React.ClipboardEvent<HTMLInputElement>) {
    const pasted = event.clipboardData.getData('text').replace(/\D/g, '');
    if (!pasted) return;
    event.preventDefault();
    const next = (value.slice(0, index) + pasted + value.slice(index + pasted.length)).slice(0, length);
    write(next, Math.min(index + pasted.length, length - 1));
  }

  return (
    <div className="flex justify-center gap-2 sm:gap-2.5" role="group" aria-label="Verification code" id={id}>
      {digits.map((digit, index) => (
        <input
          key={index}
          ref={(el) => {
            boxes.current[index] = el;
          }}
          id={id ? `${id}-${index}` : undefined}
          type="text"
          inputMode="numeric"
          autoComplete={index === 0 ? 'one-time-code' : 'off'}
          maxLength={length}
          disabled={disabled}
          autoFocus={autoFocus && index === 0}
          value={digit}
          aria-label={`Digit ${index + 1} of ${length}`}
          aria-invalid={invalid || undefined}
          onChange={(event) => handleChange(index, event.target.value)}
          onKeyDown={(event) => handleKeyDown(index, event)}
          onPaste={(event) => handlePaste(index, event)}
          onFocus={(event) => event.target.select()}
          className={cn(
            'size-10 rounded-[var(--radius-control)] border bg-surface text-center font-mono text-lg font-semibold text-fg shadow-subtle transition-colors sm:size-11',
            'focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/30',
            'disabled:cursor-not-allowed disabled:opacity-50',
            invalid ? 'border-danger' : 'border-line hover:border-line-strong',
          )}
        />
      ))}
    </div>
  );
}
