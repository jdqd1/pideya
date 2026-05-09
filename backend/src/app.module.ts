import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { TypeOrmModule } from '@nestjs/typeorm'
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler'
import { APP_GUARD } from '@nestjs/core'
import { CacheModule } from '@nestjs/cache-manager'
import { BullModule } from '@nestjs/bull'
import * as redisStore from 'cache-manager-redis-store'
import { RedisThrottlerStorage } from './common/redis-throttler.storage'
import { getEnvFilePaths, loadLocalEnv } from './config/env'
import { typeOrmConfig } from './database/typeorm.config'
import { AppController } from './app.controller'
import { AppService } from './app.service'
import { LoyaltyModule } from './loyalty/loyalty.module'
import { AuthModule } from './auth/auth.module'

loadLocalEnv()

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: getEnvFilePaths(),
    }),
    TypeOrmModule.forRootAsync({
      useFactory: typeOrmConfig,
    }),
    CacheModule.register({
      isGlobal: true,
      store: redisStore,
      ttl: 60 * 60, // seconds in store v4 (or ms in v5, safest is seconds if v4) -> actually nestjs wraps it. Let's use standard dict.
      // Render provides REDIS_URL
      url: process.env.REDIS_URL,
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
    }),
    BullModule.forRoot({
      url: process.env.REDIS_URL,
      redis: process.env.REDIS_URL ? undefined : {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
      },
    }),
    ThrottlerModule.forRoot({
      throttlers: [{
        ttl: 60000,
        limit: 100,
      }],
      storage: new RedisThrottlerStorage(),
    }),
    LoyaltyModule,
    AuthModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule { }
