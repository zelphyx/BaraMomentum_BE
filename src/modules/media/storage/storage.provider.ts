import { FactoryProvider } from '@nestjs/common';
import { StorageProvider } from './storage-provider';
import { S3StorageProvider } from './s3-storage.provider';
import { LocalStorageProvider } from './local-storage.provider';
import { StorageProvider as StorageProviderEnum, loadEnvConfig } from '../../../config/configuration';

export const STORAGE_TOKEN = 'STORAGE_PROVIDER';

export function provideStorageProvider(): FactoryProvider<StorageProvider> {
  return {
    provide: STORAGE_TOKEN,
    useFactory: () => {
      const env = loadEnvConfig();
      if (env.STORAGE_PROVIDER === StorageProviderEnum.S3) {
        return new S3StorageProvider();
      }
      return new LocalStorageProvider();
    },
  };
}
