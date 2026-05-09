import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { isUUID } from 'class-validator'

export interface RequestUser {
  sub: string
  email: string
  role: string
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) { }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest()
    const authHeader = request.headers['authorization'] as string | undefined
    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Falta token')
    }
    const token = authHeader.slice(7)
    try {
      const payload = this.jwtService.verify<RequestUser>(token)
      if (!payload?.sub || !isUUID(payload.sub)) {
        throw new UnauthorizedException('Token inv\u00e1lido')
      }
      request.user = payload
      return true
    } catch (e) {
      throw new UnauthorizedException('Token inv\u00e1lido')
    }
  }
}
