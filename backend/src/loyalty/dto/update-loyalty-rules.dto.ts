import { IsArray, IsNumber, IsOptional } from 'class-validator'
import type { LevelDefinition, RewardDefinition } from '../loyalty.rules'

export class UpdateLoyaltyRulesDto {
  @IsOptional()
  @IsNumber()
  pointsPerProduct?: number

  @IsOptional()
  @IsNumber()
  firstThreshold?: number

  @IsOptional()
  @IsNumber()
  thresholdStep?: number

  @IsOptional()
  @IsNumber()
  couponExpiryDays?: number

  @IsOptional()
  @IsNumber()
  levelMonthlyCouponExpiryDays?: number

  @IsOptional()
  @IsNumber()
  levelMonthlyCouponRenewDay?: number

  @IsOptional()
  @IsNumber()
  levelWindowDays?: number

  @IsOptional()
  @IsArray()
  rewardLadder?: RewardDefinition[]

  @IsOptional()
  @IsArray()
  levelLadder?: LevelDefinition[]
}
