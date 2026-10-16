import { loadAppConfig } from './app-config.js';

const base = { DATABASE_URL: 'postgres://u:p@localhost:5432/db', SESSION_SECRET: 'x'.repeat(32) };
const PEM = '-----BEGIN CERTIFICATE-----\\nMIIB\\n-----END CERTIFICATE-----';

describe('loadAppConfig', () => {
  it('applies defaults', () => {
    const config = loadAppConfig(base);
    expect(config).toMatchObject({
      port: 3000,
      sessionSecret: 'x'.repeat(32),
      dataEncryptionKey: null,
      cronSecret: null,
      revisionCron: '0 11 * * *',
      estadosCron: '0 */6 * * *',
      database: { url: base.DATABASE_URL, caCert: null, poolMax: 5, migrationsRun: true },
    });
  });

  it('requires DATABASE_URL', () => {
    expect(() => loadAppConfig({})).toThrow(/DATABASE_URL is required/);
  });

  it('rejects non-postgres URLs and invalid numbers together', () => {
    expect(() => loadAppConfig({ DATABASE_URL: 'mysql://x', SESSION_SECRET: 'x'.repeat(32), PORT: 'abc' })).toThrow(
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

  it('disables the estados cron with "off"', () => {
    expect(loadAppConfig({ ...base, ESTADOS_CRON: 'off' }).estadosCron).toBeNull();
    expect(loadAppConfig({ ...base, ESTADOS_CRON: 'OFF' }).estadosCron).toBeNull();
    expect(loadAppConfig({ ...base, ESTADOS_CRON: '0 3 * * *' }).estadosCron).toBe('0 3 * * *');
  });

  it('rejects a malformed ESTADOS_CRON', () => {
    expect(() => loadAppConfig({ ...base, ESTADOS_CRON: 'cada seis horas' })).toThrow(/ESTADOS_CRON/);
  });

  it('treats an empty CRON_SECRET as unset', () => {
    expect(loadAppConfig({ ...base, CRON_SECRET: '' }).cronSecret).toBeNull();
  });

  it('requires SESSION_SECRET with at least 32 characters and ignores APP_PASSWORD', () => {
    expect(() => loadAppConfig({ DATABASE_URL: base.DATABASE_URL, APP_PASSWORD: 'vieja-clave' })).toThrow(
      /SESSION_SECRET is required/,
    );
    expect(() => loadAppConfig({ ...base, SESSION_SECRET: 'corto' })).toThrow(/at least 32 characters/);
    expect(loadAppConfig({ ...base, APP_PASSWORD: 'vieja-clave' })).not.toHaveProperty('appPassword');
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
