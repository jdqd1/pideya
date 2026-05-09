import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { JwtModule } from '@nestjs/jwt'
import { AuthController } from './auth.controller'
import { AuthService } from './auth.service'
import { User } from '../loyalty/entities/user.entity'
import { UserActivity } from '../loyalty/entities/user-activity.entity'
import { JwtAuthGuard } from './jwt.guard'
import { MailModule } from '../mail/mail.module'

@Module({
  imports: [
    TypeOrmModule.forFeature([User, UserActivity]),
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'secret',
      signOptions: { expiresIn: '365d' },
    }),
    MailModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtAuthGuard],
  exports: [AuthService, JwtAuthGuard, JwtModule],
})
export class AuthModule { }
