import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule, TypeOrmModuleOptions } from '@nestjs/typeorm';
import { AppConfigModule } from '@config/appconfig.module';
import { DbConfigService } from '@config/services/dbconfig.service';
import { ProductModule } from '@providers/products/module/product.module';
import { ReportsModule } from '@reports/reports.module';
import { CacheModule } from '@nestjs/cache-manager';
import * as redisStore from 'cache-manager-redis-store';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    CacheModule.register({
      isGlobal: true,
      store: redisStore,
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
    }),
    AppConfigModule,
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule, AppConfigModule],
      inject: [DbConfigService],
      useFactory: async (dbConfigService: DbConfigService): Promise<TypeOrmModuleOptions> => {
        const dbConfig = await dbConfigService.getDbConfig();
        return {
          ...dbConfig,
        };
      },
    }),
    ProductModule,
    ReportsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
