import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule, TypeOrmModuleOptions } from '@nestjs/typeorm';
import { AppConfigModule } from '@config/appconfig.module';
import { DbConfigService } from '@config/services/dbconfig.service';
import { ProductModule } from '@providers/products/module/product.module';
import { ReportsModule } from '@reports/reports.module';
import { CacheModule } from '@nestjs/cache-manager';
import { redisStore } from 'cache-manager-redis-yet';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    CacheModule.registerAsync({
      isGlobal: true,
      useFactory: async () => ({
        store: await redisStore({
          socket: {
            host: process.env.REDIS_HOST || 'localhost',
            port: parseInt(process.env.REDIS_PORT || '6379', 10),
          },
        }),
      }),
    }),
    AppConfigModule,
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule, AppConfigModule],
      inject: [DbConfigService],
      useFactory: (dbConfigService: DbConfigService): TypeOrmModuleOptions => {
        const dbConfig = dbConfigService.getDbConfig();
        return {
          ...dbConfig,
        };
      },
    }),
    ProductModule,
    ReportsModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
