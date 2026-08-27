import { Controller, Get, HttpCode, HttpException, HttpStatus } from '@nestjs/common';
import { Public } from '../identity/auth/jwt-auth.guard';
import { HealthCheckResult, HealthReadyResult, HealthService } from './health.service';

@Controller('health')
@Public()
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
