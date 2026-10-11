import { All, Controller, Headers, HttpCode } from '@nestjs/common';
import { Public } from '../../../auth/infrastructure/http/public.decorator.js';
import { ApiError } from '../../../common/http/api-error.js';
import { safeEqual } from '../../../common/security/safe-equal.js';
import type { AppConfig } from '../../../config/app-config.js';
import { InjectAppConfig } from '../../../config/app-config.provider.js';
import { ReviewService, type ReviewSummary } from '../../application/review.service.js';

/** External trigger of the review (any method), authorized with `Bearer $CRON_SECRET`. */
@Public()
@Controller('cron')
export class CronController {
  constructor(
    @InjectAppConfig() private readonly config: AppConfig,
    private readonly review: ReviewService,
  ) {}

  @All()
  @HttpCode(200)
  async run(@Headers('authorization') authorization: string | undefined): Promise<ReviewSummary> {
    const secret = this.config.cronSecret;
    if (!secret || !safeEqual(authorization, `Bearer ${secret}`)) throw new ApiError(401, 'No autorizado');
    return this.review.reviewAll();
  }
}
