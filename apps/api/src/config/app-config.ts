// Typed, validated application configuration built from environment variables.
// Every variable is documented in the repository `.env.example`.

export const DEFAULT_REVISION_CRON = '0 11 * * *';

/** Default of `ESTADOS_CRON`: every 6 hours (UTC). */
export const DEFAULT_ESTADOS_CRON = '0 */6 * * *';

export interface DatabaseConfig {
  url: string;
  /** PEM content of the server CA; enables verified TLS when present. */
  caCert: string | null;
  /**
   * Opt-in escape hatch (DATABASE_SSL_NO_VERIFY=true): TLS without certificate verification.
   * Only used when no CA is configured. Insecure: anyone on the network path could impersonate the database.
   */
  sslNoVerify: boolean;
  poolMax: number;
  migrationsRun: boolean;
}

export interface AppConfig {
  port: number;
  nodeEnv: string;
  publicDir: string | null;
  database: DatabaseConfig;
  /** 32-byte key (base64) for AES-256-GCM and the lookup index of personal data; `null` when unset. */
  dataEncryptionKey: string | null;
  /** Signs session cookies and the calendar token. Required, at least 32 characters. */
  sessionSecret: string;
  cronSecret: string | null;
  /** Cron expression (UTC) for the automatic review, or `null` when disabled. */
  revisionCron: string | null;
  /** Cron expression (UTC) for the estados sweep, or `null` when disabled. */
  estadosCron: string | null;
  /** Set by Vercel: Secure cookie and the client IP taken from `x-forwarded-for`. */
  vercel: boolean;
  vercelRegion: string | null;
}

type Env = Record<string, string | undefined>;

const blank = (value: string | undefined): string | null => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
};

function positiveInt(env: Env, key: string, fallback: number, errors: string[]): number {
  const raw = blank(env[key]);
  if (raw === null) return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) {
    errors.push(`${key} must be a positive integer`);
    return fallback;
  }
  return value;
}

function bool(env: Env, key: string, fallback: boolean, errors: string[]): boolean {
  const raw = blank(env[key])?.toLowerCase();
  if (raw === undefined || raw === null) return fallback;
  if (['true', '1', 'yes'].includes(raw)) return true;
  if (['false', '0', 'no'].includes(raw)) return false;
  errors.push(`${key} must be true or false`);
  return fallback;
}

/** Five or six whitespace-separated fields; fine-grained parsing is left to the cron library. */
const CRON_SHAPE = /^\S+(\s+\S+){4,5}$/;

/** True when the value is the canonical base64 encoding of exactly 32 bytes. */
export function isDataKey(value: string): boolean {
  const bytes = Buffer.from(value, 'base64');
  return bytes.length === 32 && bytes.toString('base64') === value;
}

/**
 * Validates the raw environment and returns the typed configuration.
 * Throws a single error listing every invalid variable.
 */
export function loadAppConfig(env: Env): AppConfig {
  const errors: string[] = [];

  const url = blank(env.DATABASE_URL);
  if (url === null) errors.push('DATABASE_URL is required');
  else if (!/^postgres(ql)?:\/\//.test(url)) errors.push('DATABASE_URL must be a postgres:// URL');

  const caRaw = blank(env.DATABASE_CA_CERT);
  const caCert = caRaw === null ? null : caRaw.replace(/\\n/g, '\n');
  if (caCert !== null && !caCert.includes('-----BEGIN CERTIFICATE-----')) {
    errors.push('DATABASE_CA_CERT must be PEM content (-----BEGIN CERTIFICATE-----)');
  }

  const cronRaw = blank(env.REVISION_CRON) ?? DEFAULT_REVISION_CRON;
  const revisionCron = cronRaw.toLowerCase() === 'off' ? null : cronRaw;
  if (revisionCron !== null && !CRON_SHAPE.test(revisionCron)) {
    errors.push('REVISION_CRON must be a cron expression or "off"');
  }

  const estadosRaw = blank(env.ESTADOS_CRON) ?? DEFAULT_ESTADOS_CRON;
  const estadosCron = estadosRaw.toLowerCase() === 'off' ? null : estadosRaw;
  if (estadosCron !== null && !CRON_SHAPE.test(estadosCron)) {
    errors.push('ESTADOS_CRON must be a cron expression or "off"');
  }

  const dataKey = blank(env.DATA_ENCRYPTION_KEY);
  if (dataKey !== null && !isDataKey(dataKey)) {
    errors.push('DATA_ENCRYPTION_KEY must be 32 random bytes in base64');
  }

  const sessionSecret = blank(env.SESSION_SECRET);
  if (sessionSecret === null) errors.push('SESSION_SECRET is required');
  else if (sessionSecret.length < 32) errors.push('SESSION_SECRET must be at least 32 characters');

  const config: AppConfig = {
    port: positiveInt(env, 'PORT', 3000, errors),
    nodeEnv: blank(env.NODE_ENV) ?? 'development',
    publicDir: blank(env.PUBLIC_DIR),
    database: {
      url: url ?? '',
      caCert,
      sslNoVerify: bool(env, 'DATABASE_SSL_NO_VERIFY', false, errors),
      poolMax: positiveInt(env, 'DATABASE_POOL_MAX', 5, errors),
      migrationsRun: bool(env, 'DATABASE_MIGRATIONS_RUN', true, errors),
    },
    dataEncryptionKey: dataKey,
    sessionSecret: sessionSecret ?? '',
    cronSecret: env.CRON_SECRET || null,
    revisionCron,
    estadosCron,
    vercel: Boolean(env.VERCEL),
    vercelRegion: blank(env.VERCEL_REGION),
  };

  if (errors.length) throw new Error(`Invalid environment: ${errors.join('; ')}`);
  return config;
}
