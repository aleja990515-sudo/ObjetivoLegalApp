import { loadAppConfig } from './app-config.js';

const base = { DATABASE_URL: 'postgres://u:p@localhost:5432/db' };
const PEM = '-----BEGIN CERTIFICATE-----\\nMIIB\\n-----END CERTIFICATE-----';

describe('loadAppConfig', () => {
  it('applies defaults', () => {
    const config = loadAppConfig(base);
    expect(config).toMatchObject({
      port: 3000,
      appPassword: 'cambiar-esta-clave',
      sessionSecret: null,
      cronSecret: null,
      revisionCron: '0 11 * * *',
      database: { url: base.DATABASE_URL, caCert: null, poolMax: 5, migrationsRun: true },
    });
  });

  it('requires DATABASE_URL', () => {
    expect(() => loadAppConfig({})).toThrow(/DATABASE_URL is required/);
  });

  it('rejects non-postgres URLs and invalid numbers together', () => {
    expect(() => loadAppConfig({ DATABASE_URL: 'mysql://x', PORT: 'abc' })).toThrow(
      /DATABASE_URL must be a postgres:\/\/ URL; PORT must be a positive integer/,
    );
  });

  it('turns escaped newlines in DATABASE_CA_CERT into real PEM content', () => {
    const config = loadAppConfig({ ...base, DATABASE_CA_CERT: PEM });
    expect(config.database.caCert).toBe('-----BEGIN CERTIFICATE-----\nMIIB\n-----END CERTIFICATE-----');
  });

  it('rejects a CA that is not PEM', () => {
    expect(() => loadAppConfig({ ...base, DATABASE_CA_CERT: 'not a cert' })).toThrow(/DATABASE_CA_CERT/);
  });

  it('disables the review cron with "off"', () => {
    expect(loadAppConfig({ ...base, REVISION_CRON: 'off' }).revisionCron).toBeNull();
    expect(loadAppConfig({ ...base, REVISION_CRON: 'OFF' }).revisionCron).toBeNull();
  });

  it('rejects malformed cron expressions', () => {
    expect(() => loadAppConfig({ ...base, REVISION_CRON: 'every day' })).toThrow(/REVISION_CRON/);
  });

  it('keeps APP_PASSWORD untrimmed and treats empty secrets as unset', () => {
    const config = loadAppConfig({ ...base, APP_PASSWORD: ' clave ', SESSION_SECRET: '', CRON_SECRET: '' });
    expect(config.appPassword).toBe(' clave ');
    expect(config.sessionSecret).toBeNull();
    expect(config.cronSecret).toBeNull();
  });

  it('accepts DATA_ENCRYPTION_KEY only as base64 of 32 bytes', () => {
    const clave = Buffer.alloc(32, 7).toString('base64');
    expect(loadAppConfig({ ...base, DATA_ENCRYPTION_KEY: clave }).dataEncryptionKey).toBe(clave);
    expect(loadAppConfig(base).dataEncryptionKey).toBeNull();
    expect(() => loadAppConfig({ ...base, DATA_ENCRYPTION_KEY: 'corta' })).toThrow(/DATA_ENCRYPTION_KEY/);
    expect(() => loadAppConfig({ ...base, DATA_ENCRYPTION_KEY: Buffer.alloc(16).toString('base64') })).toThrow(
      /DATA_ENCRYPTION_KEY/,
    );
  });
});
