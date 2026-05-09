import { IsUUID } from 'class-validator'

export class RedeemCouponDto {
  @IsUUID()
  couponId!: string
}
