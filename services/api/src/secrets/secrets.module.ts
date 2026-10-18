import { Global, Module } from '@nestjs/common';
import { SecretStore } from './secret-store.service';

@Global()
@Module({ providers: [SecretStore], exports: [SecretStore] })
export class SecretsModule {}
