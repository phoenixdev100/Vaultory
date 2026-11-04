import {
  BadgeCheck,
  Braces,
  Cloud,
  Coins,
  CreditCard,
  Database,
  FileKey,
  Fingerprint,
  Globe,
  KeyRound,
  type LucideIcon,
  Mail,
  Server,
  ShieldCheck,
  Smartphone,
  StickyNote,
  User,
  Variable,
  Wifi,
} from 'lucide-react';
import type { SecretCategory, SecretPayload } from '@/types/api';

export interface SecretField {
  key: string;
  label: string;
  type: 'text' | 'password' | 'textarea' | 'url' | 'number' | 'date' | 'select';
  placeholder?: string;
  /** Hidden behind a reveal control and treated as a secret value. */
  masked?: boolean;
  required?: boolean;
  options?: readonly string[];
  mono?: boolean;
  /** Narrow fields pair up on wide screens. */
  half?: boolean;
}

export interface CategoryMeta {
  category: SecretCategory;
  label: string;
  short: string;
  description: string;
  icon: LucideIcon;
  accent: string;
  fields: readonly SecretField[];
  /** Field used as the value when exporting to `.env`. */
  envField?: string;
  /** Field shown as the row subtitle in lists. */
  subtitleField?: string;
  supportsCustomFields?: boolean;
  /** Prominent risk notice shown above the fields (e.g. seed phrases). */
  warning?: string;
}

const NOTE_FIELD: SecretField = {
  key: 'notes',
  label: 'Notes',
  type: 'textarea',
  placeholder: 'Anything else worth remembering',
};

/** Optional expiry/rotation date - surfaces in dashboard expiry alerts. */
const EXPIRY_FIELD: SecretField = {
  key: 'expiresAt',
  label: 'Expires / rotation due',
  type: 'date',
  half: true,
};

export const CATEGORIES: Record<SecretCategory, CategoryMeta> = {
  LOGIN: {
    category: 'LOGIN',
    label: 'Website / App login',
    short: 'Login',
    description: 'Username and password for a site or application.',
    icon: Globe,
    accent: 'bg-primary-soft text-primary border-primary-line',
    envField: 'password',
    subtitleField: 'username',
    fields: [
      { key: 'url', label: 'Website URL', type: 'url', placeholder: 'https://github.com' },
      { key: 'username', label: 'Username or email', type: 'text', placeholder: 'you@example.com' },
      { key: 'password', label: 'Password', type: 'password', masked: true, required: true },
      NOTE_FIELD,
    ],
  },
  API_KEY: {
    category: 'API_KEY',
    label: 'API key / token',
    short: 'API key',
    description: 'Access tokens, personal access keys, webhook secrets.',
    icon: KeyRound,
    accent: 'bg-[#eef6ff] text-[#1d4ed8] border-[#cfe0ff] dark:bg-[#111a33] dark:text-[#93b4ff] dark:border-[#1f2d52]',
    envField: 'token',
    subtitleField: 'service',
    fields: [
      { key: 'service', label: 'Service', type: 'text', placeholder: 'Stripe, OpenAI, GitHub…' },
      { key: 'expiresAt', label: 'Expires / rotation due', type: 'date', half: true },
      { key: 'token', label: 'Key or token', type: 'password', masked: true, mono: true, required: true },
      { key: 'endpoint', label: 'Endpoint', type: 'url', placeholder: 'https://api.stripe.com' },
      NOTE_FIELD,
    ],
  },
  DATABASE: {
    category: 'DATABASE',
    label: 'Database credential',
    short: 'Database',
    description: 'Connection details for Postgres, MySQL, Mongo and friends.',
    icon: Database,
    accent: 'bg-[#eefaf3] text-[#15803d] border-[#cdebda] dark:bg-[#0e2318] dark:text-[#5fd394] dark:border-[#1b3c29]',
    envField: 'connectionString',
    subtitleField: 'host',
    fields: [
      {
        key: 'dbType',
        label: 'Engine',
        type: 'select',
        options: ['PostgreSQL', 'MySQL', 'MariaDB', 'MongoDB', 'Redis', 'SQLite', 'SQL Server', 'Other'],
        half: true,
      },
      { key: 'host', label: 'Host', type: 'text', placeholder: 'db.internal', half: true },
      { key: 'port', label: 'Port', type: 'number', placeholder: '5432', half: true },
      { key: 'database', label: 'Database name', type: 'text', placeholder: 'app_production', half: true },
      { key: 'username', label: 'Username', type: 'text', half: true },
      { key: 'password', label: 'Password', type: 'password', masked: true, half: true },
      {
        key: 'connectionString',
        label: 'Connection string',
        type: 'password',
        masked: true,
        mono: true,
        placeholder: 'postgresql://user:password@host:5432/db',
      },
      NOTE_FIELD,
    ],
  },
  SERVER_SSH: {
    category: 'SERVER_SSH',
    label: 'Server / SSH',
    short: 'Server',
    description: 'Hosts, SSH users, keys and passphrases.',
    icon: Server,
    accent: 'bg-[#f4f0ff] text-[#6d28d9] border-[#e0d7ff] dark:bg-[#1a142e] dark:text-[#b9a4ff] dark:border-[#2f2552]',
    envField: 'password',
    subtitleField: 'host',
    fields: [
      { key: 'host', label: 'Hostname or IP', type: 'text', placeholder: '203.0.113.10', half: true },
      { key: 'port', label: 'Port', type: 'number', placeholder: '22', half: true },
      { key: 'username', label: 'Username', type: 'text', placeholder: 'deploy', half: true },
      { key: 'password', label: 'Password', type: 'password', masked: true, half: true },
      {
        key: 'privateKey',
        label: 'Private key',
        type: 'textarea',
        masked: true,
        mono: true,
        placeholder: '-----BEGIN OPENSSH PRIVATE KEY-----',
      },
      { key: 'passphrase', label: 'Key passphrase', type: 'password', masked: true },
      NOTE_FIELD,
    ],
  },
  CLOUD: {
    category: 'CLOUD',
    label: 'Cloud & hosting',
    short: 'Cloud',
    description: 'AWS, GCP, Azure, Cloudflare, Vercel, domains and CDN credentials.',
    icon: Cloud,
    accent: 'bg-[#eef4ff] text-[#3b5bdb] border-[#d5e2ff] dark:bg-[#101a33] dark:text-[#9db8ff] dark:border-[#22305c]',
    envField: 'secretAccessKey',
    subtitleField: 'provider',
    fields: [
      {
        key: 'provider',
        label: 'Provider',
        type: 'select',
        options: [
          'AWS',
          'Google Cloud',
          'Azure',
          'Cloudflare',
          'Vercel',
          'Netlify',
          'DigitalOcean',
          'Domain registrar / DNS',
          'Other',
        ],
        half: true,
      },
      { key: 'account', label: 'Account / project', type: 'text', placeholder: 'prod-account, my-project…', half: true },
      { key: 'accessKeyId', label: 'Access key ID', type: 'text', mono: true, placeholder: 'AKIA…', half: true },
      { key: 'region', label: 'Region', type: 'text', placeholder: 'us-east-1', half: true },
      { key: 'secretAccessKey', label: 'Secret access key', type: 'password', masked: true, mono: true },
      { key: 'token', label: 'API / deployment token', type: 'password', masked: true, mono: true },
      { key: 'domain', label: 'Domain, bucket or resource', type: 'text', placeholder: 'example.com, s3://bucket…' },
      EXPIRY_FIELD,
      NOTE_FIELD,
    ],
  },
  ENV_VARS: {
    category: 'ENV_VARS',
    label: 'Environment variables',
    short: 'Env vars',
    description: 'A set of KEY=VALUE pairs - a whole .env file in one item. Attach the raw file too if you like.',
    icon: Variable,
    accent: 'bg-[#ecfdf5] text-[#047857] border-[#c9f0dd] dark:bg-[#0c241b] dark:text-[#6ee7b7] dark:border-[#173f2d]',
    envField: 'variables',
    subtitleField: 'project',
    fields: [
      { key: 'project', label: 'Project / app', type: 'text', placeholder: 'my-api, frontend…', half: true },
      {
        key: 'environment',
        label: 'Environment',
        type: 'select',
        options: ['development', 'staging', 'production', 'test', 'local'],
        half: true,
      },
      {
        key: 'variables',
        label: 'Variables',
        type: 'textarea',
        masked: true,
        mono: true,
        required: true,
        placeholder: 'DATABASE_URL=postgres://…\nAPI_KEY=…\nJWT_SECRET=…',
      },
      NOTE_FIELD,
    ],
  },
  WIFI_VPN: {
    category: 'WIFI_VPN',
    label: 'Wi-Fi / VPN',
    short: 'Network',
    description: 'Network names, VPN providers and shared secrets.',
    icon: Wifi,
    accent: 'bg-[#eff9fb] text-[#0e7490] border-[#cbe9f1] dark:bg-[#0c2228] dark:text-[#67e8f9] dark:border-[#164050]',
    envField: 'password',
    subtitleField: 'network',
    fields: [
      { key: 'network', label: 'Network or provider', type: 'text', placeholder: 'Home Wi-Fi, NordVPN…' },
      { key: 'username', label: 'Username', type: 'text' },
      { key: 'password', label: 'Password or shared secret', type: 'password', masked: true, required: true },
      { key: 'server', label: 'Server', type: 'text', placeholder: 'vpn.example.com' },
      EXPIRY_FIELD,
      NOTE_FIELD,
    ],
  },
  PRIVATE_KEY: {
    category: 'PRIVATE_KEY',
    label: 'Private key / certificate',
    short: 'Key / cert',
    description: 'SSH, GPG/PGP and TLS key material. Attach PEM/PPK files directly on the saved item.',
    icon: FileKey,
    accent: 'bg-[#f5f3ff] text-[#7c3aed] border-[#e4dcff] dark:bg-[#1d1433] dark:text-[#c4b5fd] dark:border-[#352659]',
    envField: 'keyMaterial',
    subtitleField: 'keyType',
    fields: [
      {
        key: 'keyType',
        label: 'Key type',
        type: 'select',
        options: ['SSH', 'GPG / PGP', 'TLS / SSL', 'Code signing', 'Encryption', 'Other'],
        half: true,
      },
      { key: 'fingerprint', label: 'Fingerprint', type: 'text', mono: true, half: true },
      {
        key: 'keyMaterial',
        label: 'Key material',
        type: 'textarea',
        masked: true,
        mono: true,
        required: true,
        placeholder: '-----BEGIN PRIVATE KEY-----',
      },
      { key: 'passphrase', label: 'Passphrase', type: 'password', masked: true, half: true },
      { key: 'expiresAt', label: 'Expires', type: 'date', half: true },
      NOTE_FIELD,
    ],
  },
  RECOVERY_CODE: {
    category: 'RECOVERY_CODE',
    label: 'Recovery / backup code',
    short: 'Recovery',
    description: 'One-time backup codes for account recovery.',
    icon: ShieldCheck,
    accent: 'bg-[#fff7ed] text-[#b45309] border-[#f7e2c3] dark:bg-[#271b0b] dark:text-[#fbbf24] dark:border-[#4a3415]',
    envField: 'value',
    subtitleField: 'issuer',
    fields: [
      { key: 'issuer', label: 'Issued by', type: 'text', placeholder: 'Google, GitHub…', half: true },
      { key: 'expiresAt', label: 'Expires', type: 'date', half: true },
      {
        key: 'value',
        label: 'Codes',
        type: 'textarea',
        masked: true,
        mono: true,
        required: true,
        placeholder: 'One code per line',
      },
      NOTE_FIELD,
    ],
  },
  LICENSE_KEY: {
    category: 'LICENSE_KEY',
    label: 'License key',
    short: 'License',
    description: 'Software licences and activation keys.',
    icon: BadgeCheck,
    accent: 'bg-[#fdf2f8] text-[#be185d] border-[#f6d4e4] dark:bg-[#2a0f1d] dark:text-[#f9a8d4] dark:border-[#4d1d35]',
    envField: 'value',
    subtitleField: 'issuer',
    fields: [
      { key: 'issuer', label: 'Product or vendor', type: 'text', placeholder: 'JetBrains, Sublime…', half: true },
      { key: 'expiresAt', label: 'Expires', type: 'date', half: true },
      { key: 'value', label: 'License key', type: 'password', masked: true, mono: true, required: true },
      NOTE_FIELD,
    ],
  },
  PAYMENT: {
    category: 'PAYMENT',
    label: 'Payment & business',
    short: 'Payment',
    description: 'Payment gateways, merchant dashboards, store and accounting credentials.',
    icon: CreditCard,
    accent: 'bg-[#fff1f2] text-[#be123c] border-[#fbd5dc] dark:bg-[#2b1016] dark:text-[#fda4af] dark:border-[#4c1d27]',
    envField: 'apiKey',
    subtitleField: 'provider',
    fields: [
      { key: 'provider', label: 'Provider', type: 'text', placeholder: 'Stripe, Razorpay, Shopify…', half: true },
      { key: 'merchantId', label: 'Merchant / account ID', type: 'text', mono: true, half: true },
      { key: 'username', label: 'Dashboard login', type: 'text', half: true },
      { key: 'password', label: 'Dashboard password', type: 'password', masked: true, half: true },
      { key: 'apiKey', label: 'API key / secret key', type: 'password', masked: true, mono: true },
      { key: 'webhookSecret', label: 'Webhook signing secret', type: 'password', masked: true, mono: true },
      { key: 'dashboardUrl', label: 'Dashboard URL', type: 'url', placeholder: 'https://dashboard.stripe.com' },
      EXPIRY_FIELD,
      NOTE_FIELD,
    ],
  },
  EMAIL_SERVICE: {
    category: 'EMAIL_SERVICE',
    label: 'Email & communication',
    short: 'Email',
    description: 'SMTP, IMAP/POP, transactional email APIs, bots and webhooks.',
    icon: Mail,
    accent: 'bg-[#eff6ff] text-[#1d4ed8] border-[#d3e3fd] dark:bg-[#0f1c33] dark:text-[#93c5fd] dark:border-[#1e3358]',
    envField: 'apiKey',
    subtitleField: 'provider',
    fields: [
      { key: 'provider', label: 'Provider', type: 'text', placeholder: 'Gmail, SendGrid, Resend…', half: true },
      {
        key: 'protocol',
        label: 'Protocol',
        type: 'select',
        options: ['SMTP', 'IMAP', 'POP3', 'API', 'Webhook / bot', 'Other'],
        half: true,
      },
      { key: 'host', label: 'Host', type: 'text', placeholder: 'smtp.gmail.com', half: true },
      { key: 'port', label: 'Port', type: 'number', placeholder: '587', half: true },
      { key: 'username', label: 'Username', type: 'text', half: true },
      { key: 'password', label: 'Password', type: 'password', masked: true, half: true },
      { key: 'apiKey', label: 'API key / bot token', type: 'password', masked: true, mono: true },
      NOTE_FIELD,
    ],
  },
  IDENTITY: {
    category: 'IDENTITY',
    label: 'Identity & SSO',
    short: 'Identity',
    description: 'OAuth apps, SAML certificates, identity-provider secrets and MFA recovery.',
    icon: Fingerprint,
    accent: 'bg-[#fdf4ff] text-[#a21caf] border-[#f5d0fe] dark:bg-[#2a1030] dark:text-[#f0abfc] dark:border-[#4a1d52]',
    envField: 'clientSecret',
    subtitleField: 'provider',
    fields: [
      { key: 'provider', label: 'Provider', type: 'text', placeholder: 'Auth0, Okta, Keycloak, Clerk…', half: true },
      {
        key: 'flowType',
        label: 'Type',
        type: 'select',
        options: ['OAuth app', 'SSO', 'SAML', 'MFA recovery', 'Other'],
        half: true,
      },
      { key: 'clientId', label: 'Client ID', type: 'text', mono: true },
      { key: 'clientSecret', label: 'Client secret', type: 'password', masked: true, mono: true },
      { key: 'issuerUrl', label: 'Issuer / metadata URL', type: 'url', placeholder: 'https://idp.example.com' },
      {
        key: 'certificate',
        label: 'Signing certificate',
        type: 'textarea',
        masked: true,
        mono: true,
        placeholder: '-----BEGIN CERTIFICATE-----',
      },
      EXPIRY_FIELD,
      NOTE_FIELD,
    ],
  },
  MOBILE: {
    category: 'MOBILE',
    label: 'Mobile & app dev',
    short: 'Mobile',
    description: 'Android keystores, iOS signing, Play Console, App Store Connect and Firebase. Attach keystore files to the saved item.',
    icon: Smartphone,
    accent: 'bg-[#f0fdf4] text-[#15803d] border-[#d3f2dd] dark:bg-[#0d2318] dark:text-[#86efac] dark:border-[#1c3d2b]',
    envField: 'apiKey',
    subtitleField: 'platform',
    fields: [
      {
        key: 'platform',
        label: 'Platform',
        type: 'select',
        options: ['Android', 'iOS', 'Firebase', 'Push notifications', 'Cross-platform', 'Other'],
        half: true,
      },
      { key: 'account', label: 'Console account / project', type: 'text', placeholder: 'Play Console, App Store Connect…', half: true },
      { key: 'keyAlias', label: 'Key alias', type: 'text', mono: true, half: true },
      { key: 'keystorePassword', label: 'Keystore password', type: 'password', masked: true, half: true },
      { key: 'keyPassword', label: 'Key password', type: 'password', masked: true, half: true },
      { key: 'apiKey', label: 'API key / issuer secret', type: 'password', masked: true, mono: true, half: true },
      EXPIRY_FIELD,
      NOTE_FIELD,
    ],
  },
  CRYPTO: {
    category: 'CRYPTO',
    label: 'Blockchain & crypto',
    short: 'Crypto',
    description: 'Wallet seed phrases, private keys, exchange and RPC credentials.',
    icon: Coins,
    accent: 'bg-[#fefce8] text-[#a16207] border-[#f5e9b8] dark:bg-[#281f08] dark:text-[#fde047] dark:border-[#4a3a12]',
    warning:
      'Seed phrases and private keys control real funds. Vaultory has not been independently security-audited - do not store keys that protect real funds here until it has been.',
    envField: 'privateKey',
    subtitleField: 'asset',
    fields: [
      { key: 'asset', label: 'Asset / wallet', type: 'text', placeholder: 'Ethereum main wallet…', half: true },
      { key: 'network', label: 'Network', type: 'text', placeholder: 'mainnet, testnet…', half: true },
      {
        key: 'seedPhrase',
        label: 'Seed phrase',
        type: 'textarea',
        masked: true,
        mono: true,
        placeholder: 'twelve recovery words…',
      },
      { key: 'privateKey', label: 'Private key', type: 'password', masked: true, mono: true },
      { key: 'exchangeApiKey', label: 'Exchange / RPC API key', type: 'password', masked: true, mono: true },
      { key: 'rpcUrl', label: 'RPC endpoint', type: 'url', placeholder: 'https://mainnet.infura.io/v3/…' },
      NOTE_FIELD,
    ],
  },
  PERSONAL: {
    category: 'PERSONAL',
    label: 'Personal & everyday',
    short: 'Personal',
    description: 'Device passcodes, computer accounts and password-protected files.',
    icon: User,
    accent: 'bg-[#f8fafc] text-[#475569] border-[#e2e8f0] dark:bg-[#1a2230] dark:text-[#94a3b8] dark:border-[#2b3648]',
    envField: 'password',
    subtitleField: 'item',
    fields: [
      { key: 'item', label: 'Device / account', type: 'text', placeholder: 'Work laptop, home PC…', half: true },
      { key: 'username', label: 'Username', type: 'text', half: true },
      { key: 'password', label: 'Password', type: 'password', masked: true, required: true },
      { key: 'pin', label: 'PIN / passcode', type: 'password', masked: true, half: true },
      NOTE_FIELD,
    ],
  },
  SECURE_NOTE: {
    category: 'SECURE_NOTE',
    label: 'Secure note',
    short: 'Note',
    description: 'Free-form encrypted text.',
    icon: StickyNote,
    accent: 'bg-surface-muted text-fg-muted border-line',
    envField: 'notes',
    fields: [
      {
        key: 'notes',
        label: 'Note',
        type: 'textarea',
        masked: true,
        required: true,
        placeholder: 'Only you can read this.',
      },
    ],
  },
  CUSTOM: {
    category: 'CUSTOM',
    label: 'Custom secret',
    short: 'Custom',
    description: 'Any set of key/value pairs you need.',
    icon: Braces,
    accent: 'bg-surface-muted text-fg border-line-strong',
    supportsCustomFields: true,
    fields: [NOTE_FIELD],
  },
};

export const CATEGORY_LIST: CategoryMeta[] = Object.values(CATEGORIES);

export function categoryMeta(category: SecretCategory): CategoryMeta {
  return CATEGORIES[category] ?? CATEGORIES.CUSTOM;
}

/** Short, non-secret descriptor shown under a title in lists. */
export function secretSubtitle(category: SecretCategory, payload: SecretPayload | null): string | null {
  if (!payload) return null;
  const meta = categoryMeta(category);
  const field = meta.subtitleField ? payload.fields[meta.subtitleField] : undefined;
  if (field) return field;
  if (category === 'CUSTOM' && payload.custom?.length) return `${payload.custom.length} field(s)`;
  return null;
}

/** The value a `.env` export should use for this secret. */
export function envExportValue(category: SecretCategory, payload: SecretPayload | null): string {
  if (!payload) return '';
  const meta = categoryMeta(category);

  if (meta.envField === 'notes') return payload.notes ?? '';
  if (meta.envField) {
    const value = payload.fields[meta.envField];
    if (value) return value;
  }

  // Fall back to the first non-empty masked field, then any field.
  for (const field of meta.fields) {
    if (!field.masked) continue;
    const value = payload.fields[field.key];
    if (value) return value;
  }

  const firstCustom = payload.custom?.find((entry) => entry.value !== '');
  if (firstCustom) return firstCustom.value;

  return Object.values(payload.fields).find((value) => value !== '') ?? '';
}

export function emptyPayload(): SecretPayload {
  return { v: 1, fields: {}, custom: [], notes: '' };
}
