import { motion, useReducedMotion } from 'framer-motion';
import {
  ArrowRight,
  BadgeCheck,
  Braces,
  Check,
  Clock,
  Cloud,
  Coins,
  Copy,
  CreditCard,
  Database,
  Eye,
  EyeOff,
  FileDown,
  FileKey,
  FileUp,
  Fingerprint,
  Folder,
  Globe,
  History,
  KeyRound,
  LayoutDashboard,
  Lock,
  Mail,
  Search,
  Server,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Star,
  StickyNote,
  User,
  Variable,
  Wifi,
  Wand2,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Logo, LogoMark } from '@/components/layout/logo';
import { ThemeToggle } from '@/components/layout/theme-toggle';
import { useAuth } from '@/features/auth/auth-context';
import { cn } from '@/lib/utils';

/**
 * Public landing page. Everything follows the app theme (light and dark)
 * through the semantic tokens - only the product "screenshots" (the mock
 * browser and the code block) stay dark, since they represent the product UI.
 */
export default function LandingPage() {
  const { status } = useAuth();
  const reduceMotion = useReducedMotion();
  const signedIn = status === 'authenticated';

  const fadeUp = (delay = 0) =>
    reduceMotion
      ? {}
      : {
          initial: { opacity: 0, y: 14 },
          whileInView: { opacity: 1, y: 0 },
          viewport: { once: true, margin: '-40px' },
          transition: { duration: 0.45, delay, ease: [0.16, 1, 0.3, 1] as const },
        };

  return (
    <div className="min-h-dvh bg-canvas text-fg antialiased selection:bg-primary/30">
      {/* Top navigation */}
      <header className="sticky top-0 z-40 border-b border-line bg-canvas/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link to="/" className="flex items-center gap-2 [&_span]:text-fg">
            <Logo size="md" />
          </Link>
          <nav className="hidden items-center gap-6 text-[13px] text-fg-muted md:flex">
            <a href="#features" className="transition-colors hover:text-fg">
              Features
            </a>
            <a href="#security" className="transition-colors hover:text-fg">
              Security
            </a>
            <a href="#categories" className="transition-colors hover:text-fg">
              Categories
            </a>
            <a href="#faq" className="transition-colors hover:text-fg">
              FAQ
            </a>
          </nav>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            {signedIn ? (
              <Link
                to="/dashboard"
                className="rounded-lg bg-primary px-3.5 py-1.5 text-[13px] font-medium text-primary-fg transition-colors hover:bg-primary-hover"
              >
                Open vault
              </Link>
            ) : (
              <>
                <Link
                  to="/login"
                  className="hidden rounded-lg px-3 py-1.5 text-[13px] font-medium text-fg-muted transition-colors hover:text-fg sm:block"
                >
                  Sign in
                </Link>
                <Link
                  to="/signup"
                  className="rounded-lg bg-primary px-3.5 py-1.5 text-[13px] font-medium text-primary-fg transition-colors hover:bg-primary-hover"
                >
                  Get started
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 dark:hidden"
          style={{
            background:
              'radial-gradient(60% 50% at 50% 0%, rgba(79,70,229,0.15) 0%, rgba(79,70,229,0.05) 45%, transparent 70%)',
          }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 hidden dark:block"
          style={{
            background:
              'radial-gradient(60% 50% at 50% 0%, rgba(79,70,229,0.28) 0%, rgba(79,70,229,0.08) 45%, transparent 70%)',
          }}
        />
        <div className="relative mx-auto flex max-w-6xl flex-col items-center px-4 pt-20 pb-20 text-center sm:px-6 sm:pt-28 sm:pb-24">
          <motion.div {...fadeUp()}>
            <span className="inline-flex items-center gap-2 rounded-full border border-primary-line bg-primary-soft px-3 py-1 text-xs font-medium text-primary">
              <ShieldCheck className="size-3.5" />
              AES-256-GCM · encrypted in your browser
            </span>
          </motion.div>

          <motion.h1
            {...fadeUp(0.05)}
            className="mt-6 max-w-3xl text-4xl leading-[1.08] font-semibold tracking-[-0.03em] text-balance text-fg sm:text-6xl"
          >
            Every credential you own, in one{' '}
            <span className="bg-gradient-to-r from-[#0284c7] via-[#4f46e5] to-[#9333ea] bg-clip-text text-transparent dark:from-[#38bdf8] dark:via-[#818cf8] dark:to-[#c084fc]">
              encrypted vault
            </span>
          </motion.h1>

          <motion.p {...fadeUp(0.1)} className="mt-5 max-w-xl text-base leading-7 text-fg-muted sm:text-lg">
            Vaultory is a personal password and secrets manager. Logins, API keys, database credentials, SSH
            access and secure notes - encrypted before they ever leave your device.
          </motion.p>

          <motion.div {...fadeUp(0.15)} className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              to={signedIn ? '/dashboard' : '/signup'}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-fg shadow-[0_8px_30px_rgba(79,70,229,0.35)] transition-colors hover:bg-primary-hover"
            >
              {signedIn ? 'Open your vault' : 'Create your vault'}
              <ArrowRight className="size-4" />
            </Link>
            <a
              href="#security"
              className="inline-flex items-center gap-2 rounded-lg border border-line bg-surface px-5 py-2.5 text-sm font-medium text-fg-muted transition-colors hover:border-line-strong hover:text-fg"
            >
              How it stays private
            </a>
          </motion.div>

          <motion.p {...fadeUp(0.2)} className="mt-4 text-xs text-fg-subtle">
            Free for personal use · no master key to remember · your password is the only secret
          </motion.p>
        </div>
      </section>

      {/* Product preview */}
      <section id="preview" className="relative border-t border-line">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
          <motion.div {...fadeUp()} className="mx-auto max-w-xl text-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1 text-xs font-medium text-fg-muted">
              Inside the app
            </span>
            <h2 className="mt-5 text-2xl font-semibold tracking-[-0.02em] text-balance text-fg sm:text-3xl">
              A vault that reads like your favourite editor
            </h2>
            <p className="mt-3 text-[15px] leading-7 text-fg-muted">
              Search, folders, favorites and reveal-on-demand. Values stay masked until you ask.
            </p>
          </motion.div>

          <motion.div {...fadeUp(0.1)} className="relative mx-auto mt-12 max-w-5xl">
            <div className="overflow-hidden rounded-xl border border-line bg-surface shadow-card">
              {/* Browser chrome */}
              <div className="flex items-center gap-2 border-b border-line bg-surface-muted/60 px-4 py-2.5">
                <span className="size-2.5 rounded-full bg-[#ff5f57]/80" />
                <span className="size-2.5 rounded-full bg-[#febc2e]/80" />
                <span className="size-2.5 rounded-full bg-[#28c840]/80" />
                <span className="ml-3 inline-flex items-center gap-1.5 rounded-md border border-line bg-surface px-2.5 py-0.5 font-mono text-[10px] text-fg-subtle">
                  <Lock className="size-2.5" />
                  vaultory.app/vault
                </span>
              </div>

              <div className="flex text-left">
                {/* Mock sidebar */}
                <div className="hidden w-44 shrink-0 flex-col border-r border-line bg-surface-muted/40 p-3 sm:flex">
                  <div className="flex flex-col gap-0.5">
                    {[
                      { icon: LayoutDashboard, label: 'Dashboard' },
                      { icon: KeyRound, label: 'Vault', active: true },
                      { icon: Folder, label: 'Folders' },
                      { icon: Star, label: 'Favorites' },
                      { icon: Clock, label: 'Recent' },
                      { icon: History, label: 'Activity' },
                    ].map((item) => (
                      <span
                        key={item.label}
                        className={cn(
                          'flex items-center gap-2 rounded-md px-2.5 py-1.5 text-xs font-medium',
                          item.active ? 'bg-primary-soft text-primary' : 'text-fg-subtle',
                        )}
                      >
                        <item.icon className="size-3.5" />
                        {item.label}
                      </span>
                    ))}
                  </div>
                  <div className="mt-auto flex items-center gap-2 rounded-md border border-line bg-surface px-2.5 py-2">
                    <span className="flex size-5 items-center justify-center rounded-full bg-primary-soft text-[8px] font-semibold text-primary">
                      RS
                    </span>
                    <span className="truncate text-[10px] text-fg-subtle">rohan@vaultory.app</span>
                  </div>
                </div>

                {/* Mock vault list */}
                <div className="min-w-0 flex-1 p-4">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-fg">Vault</span>
                    <div className="flex items-center gap-2">
                      <span className="hidden items-center gap-1.5 rounded-md border border-line bg-surface-muted px-2.5 py-1 text-[10px] text-fg-subtle sm:inline-flex">
                        <Search className="size-3" />
                        Search…
                      </span>
                      <span className="rounded-md bg-primary px-2 py-1 text-[10px] font-medium text-primary-fg">
                        + New secret
                      </span>
                    </div>
                  </div>
                  <ul className="flex flex-col gap-1.5">
                    {[
                      { icon: Globe, label: 'GitHub', sub: 'you@example.com', tint: 'bg-primary-soft text-primary', fav: true },
                      { icon: Database, label: 'Production Postgres', sub: 'db.internal', tint: 'bg-success-soft text-success' },
                      { icon: KeyRound, label: 'Stripe API key', sub: 'sk_live_…', tint: 'bg-warning-soft text-warning' },
                      { icon: Server, label: 'Deploy server', sub: '203.0.113.10', tint: 'bg-danger-soft text-danger' },
                    ].map((row) => (
                      <li
                        key={row.label}
                        className="flex items-center gap-2.5 rounded-lg border border-line bg-surface px-3 py-2.5 transition-colors hover:border-primary-line"
                      >
                        <span className={cn('flex size-7 items-center justify-center rounded-md', row.tint)}>
                          <row.icon className="size-3.5" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-1.5 text-xs font-medium text-fg">
                            {row.label}
                            {row.fav ? <Star className="size-3 fill-warning text-warning" /> : null}
                          </span>
                          <span className="block truncate text-[10px] text-fg-subtle">{row.sub}</span>
                        </span>
                        <span className="font-mono text-[10px] tracking-widest text-fg-subtle/70">••••••</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Mock detail panel */}
                <div className="hidden w-60 shrink-0 flex-col gap-3 border-l border-line bg-surface-muted/40 p-4 lg:flex">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-fg">GitHub</span>
                    <Star className="size-3.5 fill-warning text-warning" />
                  </div>
                  <span className="w-fit rounded-full border border-line bg-surface px-2 py-0.5 text-[9px] font-medium text-fg-subtle">
                    Website / App login
                  </span>
                  {[
                    { label: 'Username', value: 'you@example.com', masked: false },
                    { label: 'Password', value: '••••••••••', masked: true },
                    { label: 'Website', value: 'github.com', masked: false },
                  ].map((field) => (
                    <div key={field.label} className="flex flex-col gap-1">
                      <span className="text-[9px] font-medium tracking-wide text-fg-subtle uppercase">
                        {field.label}
                      </span>
                      <span className="flex items-center justify-between rounded-md border border-line bg-surface px-2.5 py-1.5">
                        <span className={cn('truncate text-[10px] text-fg', field.masked && 'font-mono tracking-widest')}>
                          {field.value}
                        </span>
                        <span className="flex items-center gap-1 text-fg-subtle">
                          {field.masked ? <Eye className="size-3" /> : null}
                          <Copy className="size-3" />
                        </span>
                      </span>
                    </div>
                  ))}
                  <div className="mt-auto flex gap-1.5">
                    {['work', 'dev'].map((tag) => (
                      <span key={tag} className="rounded-full bg-primary-soft px-2 py-0.5 text-[9px] font-medium text-primary">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-8 -bottom-10 h-24 rounded-[100%] bg-primary/25 blur-3xl"
            />
          </motion.div>
        </div>
      </section>

      {/* How it works */}
      <section className="border-y border-line bg-surface-muted/60">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <motion.div {...fadeUp()} className="max-w-xl">
            <h2 className="text-2xl font-semibold tracking-[-0.02em] text-fg sm:text-3xl">
              Your password does three jobs - without ever being sent
            </h2>
            <p className="mt-3 text-[15px] leading-7 text-fg-muted">
              Everything happens on your device first. The server only ever sees what it needs to.
            </p>
          </motion.div>

          <div className="mt-12 grid gap-4 md:grid-cols-3">
            {[
              {
                icon: Fingerprint,
                step: '01',
                title: 'Derive two keys',
                text: 'Argon2id runs in your browser and splits your password into a sign-in verifier and an encryption key.',
              },
              {
                icon: Lock,
                step: '02',
                title: 'Encrypt locally',
                text: 'AES-256-GCM seals every username, password and note before anything leaves the page.',
              },
              {
                icon: Database,
                step: '03',
                title: 'Store ciphertext only',
                text: 'The API persists opaque ciphertext in Postgres. Your devices hold the only key that opens it.',
              },
            ].map((step, index) => (
              <motion.div
                key={step.step}
                {...fadeUp(0.06 * index)}
                className="relative rounded-xl border border-line bg-surface p-6 shadow-subtle"
              >
                <span className="absolute top-5 right-5 font-mono text-[11px] text-fg-subtle/60">{step.step}</span>
                <span className="flex size-9 items-center justify-center rounded-lg border border-primary-line bg-primary-soft text-primary">
                  <step.icon className="size-4" />
                </span>
                <h3 className="mt-4 text-[15px] font-semibold text-fg">{step.title}</h3>
                <p className="mt-1.5 text-[13px] leading-6 text-fg-muted">{step.text}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <motion.div {...fadeUp()} className="max-w-xl">
          <h2 className="text-2xl font-semibold tracking-[-0.02em] text-fg sm:text-3xl">
            Built like the tools you already trust
          </h2>
          <p className="mt-3 text-[15px] leading-7 text-fg-muted">
            Everything a personal vault needs, nothing it does not. No teams, no billing, no enterprise
            administration.
          </p>
        </motion.div>

        <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[
            {
              icon: Lock,
              title: 'Encrypted before upload',
              text: 'AES-256-GCM encryption happens in your browser. The API only ever stores ciphertext.',
            },
            {
              icon: KeyRound,
              title: 'One password, no master key',
              text: 'Argon2id derives separate keys for sign-in and encryption. Nothing extra to remember or lose.',
            },
            {
              icon: Folder,
              title: 'Folders, tags & favorites',
              text: 'Group credentials your way, star daily drivers, and find anything with instant search.',
            },
            {
              icon: Wand2,
              title: 'Password generator',
              text: 'Cryptographically random passwords with length, character and look-alike controls.',
            },
            {
              icon: FileUp,
              title: '.env import & export',
              text: 'Move developer secrets in and out with a local parser - files never get uploaded.',
            },
            {
              icon: FileKey,
              title: 'Encrypted file attachments',
              text: 'Attach .env files, PEM/PPK keys, keystores or VPN configs to any item - encrypted in the browser before upload, decrypted on download.',
            },
            {
              icon: History,
              title: 'Version history & activity',
              text: 'Every edit keeps an encrypted snapshot you can restore. Every action leaves a trace.',
            },
          ].map((feature, index) => (
            <motion.div
              key={feature.title}
              {...fadeUp(0.05 * index)}
              className="rounded-xl border border-line bg-surface p-5 shadow-subtle transition-colors hover:border-primary-line"
            >
              <span className="flex size-9 items-center justify-center rounded-lg border border-primary-line bg-primary-soft text-primary">
                <feature.icon className="size-4" />
              </span>
              <h3 className="mt-3.5 text-[15px] font-semibold text-fg">{feature.title}</h3>
              <p className="mt-1.5 text-[13px] leading-6 text-fg-muted">{feature.text}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Security */}
      <section id="security" className="border-y border-line bg-surface-muted/60">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-20 sm:px-6 lg:grid-cols-[1fr_1.1fr] lg:items-stretch">
          <motion.div {...fadeUp()}>
            <span className="inline-flex items-center gap-2 rounded-full border border-success/30 bg-success-soft px-3 py-1 text-xs font-medium text-success">
              <ShieldCheck className="size-3.5" />
              Honest security model
            </span>
            <h2 className="mt-5 text-2xl font-semibold tracking-[-0.02em] text-balance text-fg sm:text-3xl">
              Your password never leaves the browser
            </h2>
            <p className="mt-4 text-[15px] leading-7 text-fg-muted">
              Vaultory derives two independent keys from your password with Argon2id: an authentication verifier
              the server can check, and a wrapping key it never sees. The verifier cannot be turned back into
              your encryption key.
            </p>
            <ul className="mt-6 flex flex-col gap-3">
              {[
                'Secret values are AES-256-GCM ciphertext at rest and in transit',
                'Unique nonce per item - never reused under the same key',
                'Session cookies are httpOnly, SameSite and CSRF-protected',
                'Forgot your password? Verified email reset restores your vault',
              ].map((point) => (
                <li key={point} className="flex items-start gap-2.5 text-[13px] leading-6 text-fg-muted">
                  <Check className="mt-1 size-4 shrink-0 text-success" />
                  {point}
                </li>
              ))}
            </ul>
            <p className="mt-6 text-xs leading-5 text-fg-subtle">
              Transparent by design: a copy of your vault key is escrowed to the server - itself encrypted, usable
              only through an email-verified reset - so a forgotten password cannot orphan your data.
            </p>
          </motion.div>

          <motion.div
            {...fadeUp(0.1)}
            className="flex h-full flex-col overflow-hidden rounded-xl border border-line bg-surface shadow-card"
          >
            <div className="flex items-center gap-2 border-b border-line bg-surface-muted/50 px-4 py-2.5 font-mono text-[11px] text-fg-subtle">
              <Sparkles className="size-3.5 text-primary" />
              what the server stores
            </div>
            <pre className="flex-1 overflow-x-auto p-5 font-mono text-[12.5px] leading-7 text-fg">
{`{
  `}<span className="text-fg-muted">"id"</span>{`: `}<span className="text-success">"sec_9f2c…"</span>{`,
  `}<span className="text-fg-muted">"title"</span>{`: `}<span className="text-success">"Production Postgres"</span>{`,   `}<span className="text-fg-subtle">// searchable</span>{`
  `}<span className="text-fg-muted">"category"</span>{`: `}<span className="text-success">"DATABASE"</span>{`,               `}<span className="text-fg-subtle">// searchable</span>{`
  `}<span className="text-fg-muted">"tags"</span>{`: [`}<span className="text-success">"prod"</span>{`],                     `}<span className="text-fg-subtle">// searchable</span>{`
  `}<span className="text-fg-muted">"isFavorite"</span>{`: `}<span className="text-warning">true</span>{`,
  `}<span className="text-fg-muted">"encVersion"</span>{`: `}<span className="text-warning">1</span>{`,
  `}<span className="text-fg-muted">"keyVersion"</span>{`: `}<span className="text-warning">2</span>{`,
  `}<span className="text-fg-muted">"nonce"</span>{`: `}<span className="text-success">"kX9…fQ=="</span>{`,
  `}<span className="text-fg-muted">"ciphertext"</span>{`: `}<span className="text-success">"2vBn…9sL=="</span>{`         `}<span className="text-fg-subtle">// ← your secrets, sealed</span>{`
}`}
            </pre>
            <div className="flex items-center gap-2 border-t border-line px-4 py-3 text-[11px] text-fg-subtle">
              <EyeOff className="size-3.5 text-success" />
              Passwords, tokens and keys never appear here in plaintext
            </div>
          </motion.div>
        </div>
      </section>

      {/* Categories */}
      <section id="categories" className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <motion.div {...fadeUp()} className="max-w-xl">
          <h2 className="text-2xl font-semibold tracking-[-0.02em] text-fg sm:text-3xl">One vault for every kind of secret</h2>
          <p className="mt-3 text-[15px] leading-7 text-fg-muted">
            Eighteen credential types with fields that fit - plus custom key/value entries and encrypted file
            attachments for .env files, keys and configs.
          </p>
        </motion.div>

        <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {[
            { icon: Globe, label: 'Website / App login' },
            { icon: KeyRound, label: 'API key / token' },
            { icon: Database, label: 'Database credential' },
            { icon: Server, label: 'Server / SSH' },
            { icon: Cloud, label: 'Cloud & hosting' },
            { icon: Variable, label: 'Environment variables' },
            { icon: Wifi, label: 'Wi-Fi / VPN' },
            { icon: FileKey, label: 'Private key / cert' },
            { icon: ShieldCheck, label: 'Recovery code' },
            { icon: BadgeCheck, label: 'License key' },
            { icon: CreditCard, label: 'Payment & business' },
            { icon: Mail, label: 'Email & SMTP' },
            { icon: Fingerprint, label: 'Identity & SSO' },
            { icon: Smartphone, label: 'Mobile & app dev' },
            { icon: Coins, label: 'Blockchain & crypto' },
            { icon: User, label: 'Personal' },
            { icon: StickyNote, label: 'Secure note' },
            { icon: Braces, label: 'Custom secret' },
          ].map((category, index) => (
            <motion.div
              key={category.label}
              {...fadeUp(0.03 * index)}
              className="flex items-center gap-3 rounded-xl border border-line bg-surface px-4 py-3.5 shadow-subtle"
            >
              <category.icon className="size-4 shrink-0 text-primary" />
              <span className="text-[13px] font-medium text-fg-muted">{category.label}</span>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Stats strip */}
      <section className="border-y border-line bg-surface-muted/60">
        <div className="mx-auto grid max-w-6xl grid-cols-2 px-4 py-12 sm:grid-cols-4 sm:px-6">
          {[
            { value: '18', label: 'secret categories' },
            { value: '256-bit', label: 'AES-GCM encryption' },
            { value: '0', label: 'plaintext values stored' },
            { value: '100%', label: 'keys derived on-device' },
          ].map((stat, index) => (
            <motion.div key={stat.label} {...fadeUp(0.05 * index)} className="px-4 py-4 text-center">
              <p className="bg-gradient-to-r from-[#0284c7] to-[#4f46e5] bg-clip-text text-3xl font-semibold tracking-[-0.02em] text-transparent dark:from-[#38bdf8] dark:to-[#a5b4fc]">
                {stat.value}
              </p>
              <p className="mt-1.5 text-xs text-fg-subtle">{stat.label}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <motion.div {...fadeUp()} className="max-w-xl">
          <h2 className="text-2xl font-semibold tracking-[-0.02em] text-fg sm:text-3xl">Questions, answered honestly</h2>
          <p className="mt-3 text-[15px] leading-7 text-fg-muted">
            No marketing gloss - the same answers the security documentation gives.
          </p>
        </motion.div>

        <div className="mt-10 grid gap-3 md:grid-cols-2">
          {[
            {
              q: 'Can Vaultory read my passwords?',
              a: 'Values are encrypted in your browser before upload - the database only ever holds ciphertext. One caveat, stated plainly: a copy of your vault key is escrowed to the server so password resets can recover your data, so this is not a strict zero-knowledge design.',
            },
            {
              q: 'What happens if I forget my password?',
              a: 'A verified email link restores everything. The escrowed vault key is handed back to your browser over an encrypted channel and re-wrapped to your new password - every saved item keeps decrypting.',
            },
            {
              q: 'Where is my data stored?',
              a: 'In a Postgres database (Neon serverless by default) that the API talks to. Only metadata like titles and tags stays plaintext so search still works.',
            },
            {
              q: 'Does it work on my phone?',
              a: 'Yes - Vaultory is a responsive web app. The same unlock flow, vault and settings adapt from desktop down to small screens.',
            },
          ].map((faq, index) => (
            <motion.div
              key={faq.q}
              {...fadeUp(0.05 * index)}
              className="rounded-xl border border-line bg-surface p-5 shadow-subtle"
            >
              <h3 className="text-[14px] font-semibold text-fg">{faq.q}</h3>
              <p className="mt-2 text-[13px] leading-6 text-fg-muted">{faq.a}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
        <motion.div
          {...fadeUp()}
          className="relative overflow-hidden rounded-2xl border border-primary-line bg-gradient-to-b from-primary-soft to-transparent px-6 py-14 text-center sm:px-12"
        >
          <LogoMark className="mx-auto size-12" />
          <h2 className="mt-5 text-2xl font-semibold tracking-[-0.02em] text-fg sm:text-3xl">
            Your credentials deserve better than a spreadsheet
          </h2>
          <p className="mx-auto mt-3 max-w-md text-[15px] leading-7 text-fg-muted">
            Create your vault in under a minute. Your password is the only thing you need to remember.
          </p>
          <Link
            to={signedIn ? '/dashboard' : '/signup'}
            className="mt-7 inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-medium text-primary-fg shadow-[0_8px_30px_rgba(79,70,229,0.35)] transition-colors hover:bg-primary-hover"
          >
            {signedIn ? 'Open your vault' : 'Create your free vault'}
            <ArrowRight className="size-4" />
          </Link>
          <p className="mt-4 flex items-center justify-center gap-1.5 text-xs text-fg-subtle">
            <FileDown className="size-3.5" />
            Export your data anytime - no lock-in
          </p>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 py-6 text-xs text-fg-subtle sm:flex-row sm:px-6">
          <span className="flex items-center gap-2 [&_span]:text-fg">
            <Logo size="sm" />
          </span>
          <p>Encrypted in your browser · Open about its security model · No audits claimed</p>
          <div className="flex items-center gap-4">
            <Link to="/login" className="transition-colors hover:text-fg">
              Sign in
            </Link>
            <Link to="/signup" className="transition-colors hover:text-fg">
              Create account
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
