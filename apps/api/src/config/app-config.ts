// Typed, validated application configuration built from environment variables.
// Every variable is documented in the repository `.env.example`.

export const LEGACY_DEFAULT_PASSWORD = 'cambiar-esta-clave';
export const DEFAULT_REVISION_CRON = '0 11 * * *';

export interface DatabaseConfig {
  url: string;
  /** PEM content of the server CA; enables verified TLS when present. */
  caCert: string | null;
  poolMax: number;
  migrationsRun: boolean;
}

export interface AppConfig {
  port: number;
  nodeEnv: string;
  publicDir: string | null;
  database: DatabaseConfig;
  appPassword: string;
  sessionSecret: string | null;
  cronSecret: string | null;
  /** Cron expression (UTC) for the automatic review, or `null` when disabled. */
  revisionCron: string | null;
  /** Set by Vercel; kept for legacy-compatible behaviour (Secure cookie, login 503, /salud region). */
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

  const config: AppConfig = {
    port: positiveInt(env, 'PORT', 3000, errors),
    nodeEnv: blank(env.NODE_ENV) ?? 'development',
    publicDir: blank(env.PUBLIC_DIR),
    database: {
      url: url ?? '',
      caCert,
      poolMax: positiveInt(env, 'DATABASE_POOL_MAX', 5, errors),
      migrationsRun: bool(env, 'DATABASE_MIGRATIONS_RUN', true, errors),
    },
    // Not trimmed: the password is compared byte for byte like the legacy server.
    appPassword: env.APP_PASSWORD || LEGACY_DEFAULT_PASSWORD,
    sessionSecret: env.SESSION_SECRET || null,
    cronSecret: env.CRON_SECRET || null,
    revisionCron,
    vercel: Boolean(env.VERCEL),
    vercelRegion: blank(env.VERCEL_REGION),
  };

  if (errors.length) throw new Error(`Invalid environment: ${errors.join('; ')}`);
  return config;
}
