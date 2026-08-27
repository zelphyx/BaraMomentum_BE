import { Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';
import { loadEnvConfig } from '../../../config/configuration';

const env = loadEnvConfig();

@Injectable()
export class PasswordService {
  private readonly options: argon2.Options = {
    type: argon2.argon2id,
    memoryCost: env.ARGON2_MEMORY_COST,
    timeCost: env.ARGON2_TIME_COST,
    parallelism: env.ARGON2_PARALLELISM,
  };

  hash(plain: string): Promise<string> {
    return argon2.hash(plain, this.options);
  }

  verify(hash: string, plain: string): Promise<boolean> {
    return argon2.verify(hash, plain).catch(() => false);
  }
}
