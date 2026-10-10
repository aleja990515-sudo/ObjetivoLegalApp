import { All, Controller, HttpCode } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { Public } from '../auth/infrastructure/http/public.decorator.js';
import type { DataSource } from 'typeorm';
import { LEGACY_DEFAULT_PASSWORD, type AppConfig } from '../config/app-config.js';
import { InjectAppConfig } from '../config/app-config.provider.js';

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
  ) {}

  @All()
  @HttpCode(200)
  async salud(): Promise<SaludResponse> {
    return {
      // Live CPNU reachability is wired once the CPNU port exists (T4).
      rama: 'sin verificar',
      baseDeDatos: (await this.databaseReachable()) ? 'postgres' : 'sin configurar',
      claveConfigurada: this.config.appPassword !== LEGACY_DEFAULT_PASSWORD,
      region: this.config.vercelRegion ?? 'local',
    };
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
