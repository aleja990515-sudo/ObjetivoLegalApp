import { All, Controller, HttpCode, Inject } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { Public } from '../auth/infrastructure/http/public.decorator.js';
import type { DataSource } from 'typeorm';
import { LEGACY_DEFAULT_PASSWORD, type AppConfig } from '../config/app-config.js';
import { InjectAppConfig } from '../config/app-config.provider.js';
import { errorMessage } from '../procesos/application/error-message.js';
import { CPNU_PORT, type CpnuPort } from '../procesos/application/ports/cpnu.port.js';

/** Known public radicado used to check that CPNU answers. */
export const HEALTH_CHECK_RADICADO = '11001310300120190012300';

export interface SaludResponse {
  rama: string;
  baseDeDatos: 'postgres' | 'sin configurar';
  claveConfigurada: boolean;
  region: string;
}

/** Public diagnostics endpoint; accepts any method like the legacy API. */
@Public()
@Controller('salud')
export class SaludController {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectAppConfig() private readonly config: AppConfig,
    @Inject(CPNU_PORT) private readonly cpnu: CpnuPort,
  ) {}

  @All()
  @HttpCode(200)
  async salud(): Promise<SaludResponse> {
    return {
      rama: await this.ramaStatus(),
      baseDeDatos: (await this.databaseReachable()) ? 'postgres' : 'sin configurar',
      claveConfigurada: this.config.appPassword !== LEGACY_DEFAULT_PASSWORD,
      region: this.config.vercelRegion ?? 'local',
    };
  }

  /** `'ok'` when CPNU answers, otherwise the error message. */
  private async ramaStatus(): Promise<string> {
    try {
      await this.cpnu.searchRadicado(HEALTH_CHECK_RADICADO);
      return 'ok';
    } catch (e) {
      return errorMessage(e);
    }
  }

  private async databaseReachable(): Promise<boolean> {
    try {
      await this.dataSource.query('SELECT 1');
      return true;
    } catch {
      return false;
    }
  }
}
