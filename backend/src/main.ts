import { NestFactory } from '@nestjs/core'
import { ValidationPipe } from '@nestjs/common'
import { AppModule } from './app.module'
import { LoggingInterceptor } from './logging.interceptor'

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { cors: true })

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  )
  app.useGlobalInterceptors(new LoggingInterceptor())

  // Aumentar límites para subida de fotos base64
  const express = await import('express')
  app.use(express.json({ limit: '50mb' }))
  app.use(express.urlencoded({ limit: '50mb', extended: true }))

  const port = process.env.PORT || 3001
  await app.listen(port, '0.0.0.0')
  // eslint-disable-next-line no-console
  console.log(`API en puerto ${port}`)
}

bootstrap()
