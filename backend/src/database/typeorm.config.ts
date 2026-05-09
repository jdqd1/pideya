import { TypeOrmModuleOptions } from '@nestjs/typeorm'
import { getDatabaseUrl, loadLocalEnv } from '../config/env'

loadLocalEnv()

export const typeOrmConfig = (): TypeOrmModuleOptions => {
  const url = getDatabaseUrl()
  const isSsl = process.env.DB_SSL !== 'false'
  const sslOptions = isSsl ? { rejectUnauthorized: false } : false

  return {
    type: 'postgres',
    url,
    autoLoadEntities: true,
    synchronize: false,
    migrationsRun: true,
    migrations: [`${__dirname}/migrations/*{.ts,.js}`],
    ssl: sslOptions,
    extra: isSsl ? { ssl: sslOptions } : undefined,
  }
}
