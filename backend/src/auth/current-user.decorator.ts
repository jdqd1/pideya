import { createParamDecorator, ExecutionContext } from '@nestjs/common'
import { RequestUser } from './jwt.guard'

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): RequestUser | undefined => {
    const request = ctx.switchToHttp().getRequest()
    return request.user as RequestUser | undefined
  },
)
