import { Global, Module } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { HttpExceptionFilter } from './filters/http-exception.filter';
import { RequestIdInterceptor } from './interceptors/request-id.interceptor';
import { TransformInterceptor } from './interceptors/transform.interceptor';

@Global()
@Module({
  providers: [
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
    { provide: APP_INTERCEPTOR, useClass: RequestIdInterceptor },
    { provide: APP_INTERCEPTOR, useClass: TransformInterceptor },
  ],
})
export class CommonModule {}