import { Controller, Get, HttpCode, HttpException, HttpStatus } from '@nestjs/common';
import { HealthCheckResult, HealthReadyResult, HealthService } from './health.service';

@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get('live')
  @HttpCode(HttpStatus.OK)
  live(): HealthCheckResult {
    return this.healthService.live();
  }

  @Get('ready')
  async ready(): Promise<HealthReadyResult> {
    const result = await this.healthService.ready();
    if (result.status === 'error') {
      throw new HttpException(result, HttpStatus.SERVICE_UNAVAILABLE);
    }
    return result;
  }
}
