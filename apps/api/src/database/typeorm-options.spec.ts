import { buildDataSourceOptions } from './typeorm-options.js';

const db = { url: 'postgres://u:p@h:5432/d', caCert: null, poolMax: 3, migrationsRun: true };

describe('buildDataSourceOptions', () => {
  it('never synchronizes and uses a small pool', () => {
    const options = buildDataSourceOptions(db);
    expect(options).toMatchObject({ type: 'postgres', synchronize: false, ssl: false, extra: { max: 3 } });
  });

  it('enables verified TLS when a CA is configured', () => {
    const options = buildDataSourceOptions({ ...db, caCert: 'PEM' });
    expect(options).toMatchObject({ ssl: { ca: 'PEM', rejectUnauthorized: true } });
  });
});
