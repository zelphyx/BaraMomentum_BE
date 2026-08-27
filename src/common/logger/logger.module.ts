import { Global, Module } from '@nestjs/common';
import { LoggerModule as PinoLoggerModule } from 'nestjs-pino';
import { pinoConfig } from './pino.config';

@Global()
@Module({
  imports: [PinoLoggerModule.forRoot(pinoConfig())],
  exports: [PinoLoggerModule],
})
export class AppLoggerModule {}