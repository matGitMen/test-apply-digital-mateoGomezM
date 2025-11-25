import { Module } from '@nestjs/common';
import { DbConfigService } from './services/dbconfig.service';
import { ConfigService } from '@nestjs/config';

@Module({
  providers: [DbConfigService, ConfigService],
  exports: [DbConfigService],
})
export class AppConfigModule {}
