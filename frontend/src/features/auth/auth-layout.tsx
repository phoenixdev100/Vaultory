import { motion } from 'framer-motion';
import { ArrowLeft, Check } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Logo } from '@/components/layout/logo';
import { ThemeToggle } from '@/components/layout/theme-toggle';

const HIGHLIGHTS = [
  'Values are encrypted in your browser with AES-256-GCM',
  'The server only ever stores ciphertext and metadata',
  'Logins, API keys, databases, servers, notes and more',
  'Import and export .env files without uploading them',
];

interface AuthLayoutProps {
  title: string;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}

export function AuthLayout({ title, description, children, footer }: AuthLayoutProps) {
  return (
    <div className="flex min-h-dvh bg-canvas">
      <div className="flex w-full flex-col px-4 py-6 sm:px-8 lg:w-[54%]">
        <div className="flex items-center justify-between">
          <Link to="/" aria-label="Vaultory home">
            <Logo size="sm" />
          </Link>
          <div className="flex items-center gap-2">
            <Link
              to="/"
              className="hidden items-center gap-1.5 rounded-md px-2 py-1 text-[13px] text-fg-muted transition-colors hover:text-fg sm:inline-flex"
            >
              <ArrowLeft className="size-3.5" />
              Back to site
            </Link>
            <ThemeToggle />
          </div>
        </div>

        <div className="flex flex-1 items-center justify-center py-10">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="w-full max-w-sm"
          >
            <div className="mb-6 flex flex-col gap-1.5">
              <h1 className="text-2xl font-semibold tracking-[-0.02em] text-fg">{title}</h1>
              {description ? <p className="text-[13px] leading-5 text-fg-muted">{description}</p> : null}
            </div>

            {children}

            {footer ? <div className="mt-6 text-[13px] text-fg-muted">{footer}</div> : null}
          </motion.div>
        </div>
      </div>

      {/* Marketing panel: hidden on small screens to keep the form the focus. */}
      <div className="relative hidden overflow-hidden border-l border-line bg-surface lg:flex lg:w-[46%] lg:flex-col lg:justify-center">
        <div className="absolute inset-0 bg-dot-grid opacity-40" aria-hidden />
        <div
          className="absolute -top-24 -right-16 size-80 rounded-full bg-primary/15 blur-3xl"
          aria-hidden
        />
        <div className="relative z-10 flex flex-col gap-8 px-12">
          <div className="flex flex-col gap-3">
            <p className="inline-flex w-fit items-center gap-1.5 rounded-full border border-primary-line bg-primary-soft px-2.5 py-1 text-[11px] font-medium text-primary">
              Client-side encryption
            </p>
            <h2 className="max-w-sm text-3xl leading-[1.15] font-semibold tracking-[-0.03em] text-fg text-balance">
              Your secrets, fully in <span className="text-primary">your control.</span>
            </h2>
            <p className="max-w-sm text-[13px] leading-6 text-fg-muted">
              A personal vault for every credential you own - encrypted before it leaves your device.
            </p>
          </div>

          <ul className="flex flex-col gap-3">
            {HIGHLIGHTS.map((item) => (
              <li key={item} className="flex items-start gap-2.5 text-[13px] leading-5 text-fg-muted">
                <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary">
                  <Check className="size-2.5 stroke-[3]" />
                </span>
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
