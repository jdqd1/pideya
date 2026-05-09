import { IsUUID } from 'class-validator'

export class InspectCouponDto {
  @IsUUID()
  couponId!: string
}
