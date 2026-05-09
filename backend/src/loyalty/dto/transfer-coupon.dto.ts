import { IsEmail, IsUUID } from 'class-validator'

export class TransferCouponDto {
  @IsUUID()
  couponId!: string

  @IsEmail()
  recipientEmail!: string
}
